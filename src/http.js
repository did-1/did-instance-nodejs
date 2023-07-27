import crypto, { sign } from 'crypto'
import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import sqlite3 from 'sqlite3'

const db = new sqlite3.Database(
  './did.db',
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error(err.message) // Bummer, man! An error.
    }
    console.log('Connected to the did.db.') // All good, bro.
  }
)

db.run(
  `CREATE TABLE IF NOT EXISTS posts (
    signature TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    path TEXT NOT NULL,
    hash TEXT NOT NULL,
    block TEXT NOT NULL
  );`,
  (err) => {
    if (err) {
      return console.error(err.message) // If things go south, we'll know.
    }
    console.log('posts table initialized') // Success, bro!
  }
)

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  return res.send('This is DID instance node')
})

app.post('/keys', (req, res) => {
  const pair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1'
  })
  const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' })
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' })
  return res.send({ privateKey, publicKey })
})

app.post('/users/:domain/validate', async (req, res) => {
  const domain = req.params.domain
  const publicKey = req.body.publicKey
  let valid = false
  try {
    const resp = await fetch(['http:/', domain, 'did.pem'].join('/'))
    const text = await resp.text()
    console.log(text)
    if (publicKey && text.replace(/\n/g, '') === publicKey.replace(/\n/g, '')) {
      valid = true
    }
  } catch {}
  return res.send({ domain, valid })
})

app.post('/users/:domain/path/validate', async (req, res) => {
  const domain = req.params.domain
  const path = req.body.path
  let valid = false
  try {
    const resp = await fetch(['http:/', domain, path].join('/'))
    const post = await resp.text()
    // TODO: make proper validation
    if (post.includes('did:content')) {
      valid = true
    }
  } catch {}
  return res.send({ domain, valid })
})

app.post('/users/:domain/post', async (req, res) => {
  const domain = req.params.domain.toLowerCase()
  const body = req.body
  const domainChecks = [
    {
      validator: (d = '') => {
        const parts = domain.split('.')
        if (parts.length !== 2 || !parts[0].length || !parts[1].length) {
          return false
        }
        return true
      },
      message: 'Invalid domain name'
    },
    {
      validator: (d = '') => /^(?!-)[a-z0-9.-]*(?<!-)$/.test(d),
      message: 'Invalid domain name'
    }
  ]
  // 1. Validate user domain
  for (let i = 0; i < domainChecks.length; i++) {
    const check = domainChecks[i]
    if (!check.validator(domain)) {
      return res.send({ error: check.message })
    }
  }
  // 2. get public key
  const publicKeyUrl = ['http:/', domain, 'did.pem'].join('/')
  const resp = await fetch(publicKeyUrl)
  const { hash, blockHash, signature, path } = req.body
  const publicKeyPem = await resp.text()
  if (!publicKeyPem.includes('PUBLIC KEY')) {
    return res.send({ error: `Public key not found on ${publicKeyUrl}` })
  }
  let publicKey
  try {
    publicKey = crypto.createPublicKey({
      key: publicKeyPem,
      format: 'pem'
    })
  } catch (e) {
    console.error(e)
    return res.send({ error: `Invalid public key` })
  }
  // 2. download post from url
  const postUrl = ['http:/', req.body.domain, path].join('/')
  const postResp = await fetch(postUrl)
  const post = await postResp.text()
  // TODO: target domain name and path validation
  // TODO: do proper validation with HTML parser
  if (!post.includes('did:content')) {
    return res.send({ error: `Valid DID post not found at ${postUrl}` })
  }
  // 3. validate signature
  const message = [blockHash, req.body.domain, path, hash].join('/')
  const verify = crypto.createVerify('sha256')
  verify.update(message)
  verify.end()
  const verification = verify.verify(publicKey, Buffer.from(signature), message)
  // console.log(message)
  if (!verification) {
    return res.send({ error: `Invalid post signature` })
  }
  // 4. validate content checksum hash
  const contentHash = crypto.createHash('sha256').update(post).digest('hex')
  if (contentHash !== hash) {
    return res.send({ error: `Invalid content hash ${contentHash} ${hash}` })
  }
  // 5. validate block id
  const blockResp = await fetch(`https://blockchain.info/rawblock/${blockHash}`)
  const block = await blockResp.json()
  if (!block?.hash) {
    return res.send({ domain, body, error: 'Invalid block hash' })
  }
  // 6. check for DB conflicts
  // 7. save entry in sqlite
  const stmt = db.prepare(
    `INSERT INTO posts (signature, domain, hash, path, block) VALUES (?, ?, ?, ?, ?)`
  )
  const sigHex = signature.map((num) => num.toString(16)).join('')
  stmt.run(sigHex, req.body.domain, hash, path, blockHash, (err) => {
    if (err) {
      console.error(err)
      return res.send({ domain, body, error: 'DB insert failed' })
    } else {
      return res.send({ domain, body, error: 'DONE' })
    }
  })
  // 8. publish message on the network
  // return res.send({ domain, body, error: 'Not implemented' })
})

app.get('/block/latest', async (req, res) => {
  const resp = await fetch('https://blockchain.info/latestblock')
  const block = await resp.json()
  return res.send(block)
})

export default app
