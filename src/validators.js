// sanitize and validate domain name
import { parse } from 'node-html-parser'
import crypto from 'crypto'
import fetch from 'node-fetch'
import db from './db.js'
import winston from 'winston'

function validatePath(path = '') {
  path = path.trim().replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '')
  const regex = /^[a-zA-Z0-9/_-]*$/
  if (!regex.test(path)) {
    return { valid: false, message: 'Invalid characters detected' }
  }
  return { valid: true, value: path }
}

function validateDomainName(domain = '') {
  domain = domain.toLowerCase().trim()
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
      return { valid: false, message: check.message }
    }
  }
  return { valid: true, value: domain }
}

function validatePostContent(post) {
  const document = parse(post)
  const metas = document.querySelectorAll('meta')
  let valid = false
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i]
    if (
      meta.getAttribute('name') === 'did:content' &&
      meta.getAttribute('content')
    ) {
      valid = true
      break
    }
  }
  return { valid }
}

async function validateSubmission(params) {
  const domainValidation = validateDomainName(params.ownerDomain)
  if (!domainValidation.valid) {
    return { error: 'User domain invalid' + domainValidation.message }
  }
  const ownerDomain = domainValidation.value

  const postDomainValidation = validateDomainName(params.postDomain)
  if (!domainValidation.valid) {
    return {
      error: 'Post domain invalid:' + domainValidation.message
    }
  }
  const postDomain = postDomainValidation.value

  const pathValidation = validatePath(params.path)
  if (!pathValidation.valid) {
    return { error: 'Invalid path ' + pathValidation.message }
  }
  const path = pathValidation.value

  // 2. get public key
  const publicKeyUrl = ['http:/', ownerDomain, 'did.pem'].join('/')
  let resp;
  try {
    resp = await fetch(publicKeyUrl)
  } catch (e) {
    return { error: `Public key not found on ${publicKeyUrl}, network failure` }
  }
  const { hash, blockHash, signatureHex } = params
  const signature = []
  for (let i = 0; i < signatureHex.length; i += 2) {
    const hexPart = signatureHex.slice(i, i + 2)
    signature.push(parseInt(hexPart, 16))
  }
  const publicKeyPem = await resp.text()
  if (!publicKeyPem.includes('PUBLIC KEY')) {
    return { error: `Public key not found on ${publicKeyUrl}` }
  }
  let publicKey
  try {
    publicKey = crypto.createPublicKey({
      key: publicKeyPem,
      format: 'pem'
    })
  } catch (e) {
    winston.error(e)
    return { error: `Invalid public key` }
  }
  // 2. download post from url and validate content
  if (params.validatePostContent) {
    const postUrl = ['http:/', postDomain, path].join('/')
    const postResp = await fetch(postUrl)
    const post = await postResp.text()
    const postValidation = validatePostContent(post)
    if (!postValidation.valid) {
      return res.send({ error: `Valid DID post not found at ${postUrl}` })
    }
    const contentHash = crypto.createHash('sha256').update(post).digest('hex')
    if (contentHash !== hash) {
      return { error: `Invalid content hash ${contentHash} ${hash}` }
    }
  }
  // 3. validate signature
  const message = [blockHash, postDomain, path, hash].join('/')
  const verify = crypto.createVerify('sha256')
  verify.update(message)
  verify.end()
  const verification = verify.verify(publicKey, Buffer.from(signature), message)

  if (!verification) {
    return { error: `Invalid post signature` }
  }
  // 5. validate block id
  const cachedBlock = await db.getBlock(blockHash)
  if (!cachedBlock) {
    const blockResp = await fetch(
      `https://api.blockcypher.com/v1/btc/main/blocks/${blockHash}?limit=1`
    )
    const block = await blockResp.json()
    if (!block?.hash) {
      return { domain, body, error: 'Invalid block hash' }
    }
    await db.insertBlock(block.hash, block.time)
  }
  // 6. check for DB conflicts
  const conflictPost = await db.getPostBySignature(signatureHex)
  if (conflictPost) {
    return { error: 'Double submission' }
  }
  return {
    valid: true,
    value: {
      ownerDomain,
      postDomain,
      path,
      hash,
      blockHash,
      signatureHex
    }
  }
}

export default {
  validateDomainName,
  validatePostContent,
  validatePath,
  validateSubmission
}
