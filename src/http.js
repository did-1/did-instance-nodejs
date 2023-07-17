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

export default app
