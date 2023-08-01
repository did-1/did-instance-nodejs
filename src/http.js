import crypto from 'crypto'
import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import db from './db.js'
import validators from './validators.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  return res.send('This is DID instance node')
})

// app.post('/keys', (req, res) => {
//   const pair = crypto.generateKeyPairSync('ec', {
//     namedCurve: 'secp256k1'
//   })
//   const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' })
//   const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' })
//   return res.send({ privateKey, publicKey })
// })

app.post('/users/:domain/validate', async (req, res) => {
  const domainValidation = validators.validateDomainName(req.params.domain)
  if (!domainValidation.valid) {
    return res.send({ valid: false, message: 'Invalid domain name' })
  }
  const domain = domainValidation.value
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
  const domainValidation = validators.validateDomainName(req.params.domain)
  if (!domainValidation.valid) {
    return res.send({
      valid: false,
      message: 'Invalid domain name ' + req.params.domain
    })
  }
  const domain = domainValidation.value
  const pathValidation = validators.validatePath(req.body.path)
  if (!pathValidation.valid) {
    return res.send({
      valid: false,
      message: 'Invalid path name ' + req.body.path
    })
  }
  const path = pathValidation.value
  let valid = false
  try {
    const resp = await fetch(['http:/', domain, path].join('/'))
    const post = await resp.text()
    const postValidation = validators.validatePostContent(post)
    if (postValidation.valid) {
      valid = true
    }
  } catch {}
  return res.send({ domain, valid })
})

app.post('/users/:domain/post', async (req, res) => {
  const body = req.body
  const domainValidation = validators.validateDomainName(req.params.domain)
  if (!domainValidation.valid) {
    return res.send({ error: 'User domain invalid' + domainValidation.message })
  }
  const ownerDomain = domainValidation.value

  const postDomainValidation = validators.validateDomainName(req.body.domain)
  if (!domainValidation.valid) {
    return res.send({
      error: 'Post domain invalid:' + domainValidation.message
    })
  }
  const postDomain = postDomainValidation.value

  const pathValidation = validators.validatePath(req.body.path)
  if (!pathValidation.valid) {
    return { error: 'Invalid path ' + pathValidation.message }
  }
  const path = pathValidation.value

  // 2. get public key
  const publicKeyUrl = ['http:/', ownerDomain, 'did.pem'].join('/')
  const resp = await fetch(publicKeyUrl)
  const { hash, blockHash, signature } = req.body
  const signatureHex = signature.map((num) => num.toString(16)).join('')
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
  const postUrl = ['http:/', postDomain, path].join('/')
  const postResp = await fetch(postUrl)
  const post = await postResp.text()
  const postValidation = validators.validatePostContent(post)
  if (!postValidation.valid) {
    return res.send({ error: `Valid DID post not found at ${postUrl}` })
  }
  // 3. validate signature
  const message = [blockHash, postDomain, path, hash].join('/')
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
  const cachedBlock = await db.getBlock(blockHash)
  if (!cachedBlock) {
    const blockResp = await fetch(
      `https://blockchain.info/rawblock/${blockHash}`
    )
    const block = await blockResp.json()
    if (!block?.hash) {
      return res.send({ domain, body, error: 'Invalid block hash' })
    }
    await db.insertBlock(block.hash, block.time)
  }
  // 6. check for DB conflicts
  const conflictPost = await db.getPostBySignature(signatureHex)
  if (conflictPost) {
    // console.log(conflictPost)
    return res.send({ error: 'Double submission' })
  }
  // 7. save entry in sqlite
  console.log('SAVE ENTRY')
  try {
    await db.insertPost(
      ownerDomain,
      postDomain,
      path,
      hash,
      blockHash,
      signatureHex
    )
    return res.send({ success: true })
  } catch (e) {
    console.error(e)
    return res.send({})
  }
  // 8. publish message on the network
})

app.get('/block/latest', async (req, res) => {
  const resp = await fetch('https://blockchain.info/latestblock')
  const block = await resp.json()
  return res.send(block)
})

export default app
