import crypto from 'crypto'
import express from 'express'

const app = express()

app.get('/', (req, res) => {
  return res.send('This is DID instance node')
})

app.post('/keys', (req, res) => {
  const pair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1'
  })
  const privateKey = pair.publicKey.export({ type: 'spki', format: 'pem' })
  const publicKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' })
  return res.send({ privateKey, publicKey })
})

export default app
