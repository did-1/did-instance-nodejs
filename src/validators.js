// sanitize and validate domain name
import { parse } from 'node-html-parser'

function validateDomainName(domain = '') {
  domain = domain.toLowerCase()
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
      // console.log(meta, meta.getAttribute('name'), meta.getAttribute('content'))
      valid = true
      break
    }
  }
  // console.log(metas)
  return { valid }
}

export default {
  validateDomainName,
  validatePostContent
}
