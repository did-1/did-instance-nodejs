import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'

import db from './db.js'
import validators from './validators.js'

const app = express()
app.use(cors())
app.use(express.json())

export const httpRouter = express.Router()

httpRouter.get('/', (req, res) => {
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

httpRouter.post('/users/:domain/validate', async (req, res) => {
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

httpRouter.post('/users/:domain/path/validate', async (req, res) => {
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

httpRouter.post('/users/:domain/post', async (req, res) => {
  const { hash, blockHash, signature, domain, path } = req.body
  const signatureHex = signature
    .map((num) => num.toString(16).padStart(2, '0'))
    .join('')
  console.log(signatureHex)
  let resp = {}
  try {
    resp = await validators.validateSubmission({
      ownerDomain: req.params.domain,
      postDomain: domain,
      signatureHex,
      path,
      hash,
      blockHash
    })
  } catch (e) {
    console.error(e)
    return res.send({ error: 'Validation error' })
  }
  if (resp.error || !resp.valid) {
    return res.send({ error: resp.error || 'Error' })
  }
  const value = resp.value

  // 7. save entry in sqlite
  console.log('SAVE ENTRY')
  try {
    await db.insertPost(
      value.ownerDomain,
      value.postDomain,
      value.path,
      value.hash,
      value.blockHash,
      value.signatureHex
    )
  } catch (e) {
    console.error(e)
    return res.send({ error: 'Insert to DB failed' })
  }
  // 8. publish message on the network
  try {
    const p2pResp = await req.p2pNode.pubsub.publish(
      'news',
      uint8ArrayFromString(
        JSON.stringify({
          ownerDomain: value.ownerDomain,
          postDomain: value.postDomain,
          path: value.path,
          hash: value.hash,
          blockHash: value.blockHash,
          signatureHex: value.signatureHex
        })
      )
    )
  } catch (e) {
    console.error(e)
    return res.send({ error: 'Publish to network failed' })
  }
  return res.send({ success: true })
})

httpRouter.get('/block/latest', async (req, res) => {
  const resp = await fetch('https://blockchain.info/latestblock')
  const block = await resp.json()
  return res.send(block)
})

export default app
