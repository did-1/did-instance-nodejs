import crypto from 'crypto'
import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'

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
    if (resp.status === 200) {
      // TODO: validate if post is a valid DID document
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
  for (let i = 0; i < domainChecks.length; i++) {
    const check = domainChecks[i]
    if (!check.validator(domain)) {
      return res.send({ error: check.message })
    }
  }
  // console.log('SUBMIT POST', domain, body)
  // 1. download public key from domain
  // 2. download post from url
  // 3. validate signature
  // 4. validate block id
  // 5. check for conflicts
  // 6. save entry in sqlite
  // 7. publish message on the network
  return res.send({ domain, body })
})

app.get('/block/latest', async (req, res) => {
  const resp = await fetch('https://blockchain.info/latestblock')
  const block = await resp.json()
  return res.send(block)
})

export default app
