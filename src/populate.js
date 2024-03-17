import fetch from 'node-fetch'
import winston from 'winston'
import { Command } from 'commander'

import db from './db.js'
import validators from './validators.js'

winston.configure({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'p2p-instance' },
  transports: [
    new winston.transports.Console({
      level: 'info',
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})

const program = new Command()

program
  .requiredOption('-s, --source <char>')
  .requiredOption('-d, --day <char>')

program.parse()

const options = program.opts()
const source = options.source
const day = options.day

async function fetchBlocks(day) {
  const url = `https://blockchain.info/blocks/${day}?format=json`
  const response = await fetch(url)
  const data = await response.json()
  return data
}

async function main() {
  // fetch posts from source domain for a day and save in sqlite
  // const posts = await fetchPosts(source, day)
  // https://www.blockchain.com/explorer/api/blockchain_api
  // Blocks for one day: https://blockchain.info/blocks/$time_in_milliseconds?format=json
  // https://blockchain.info/blocks/1708971812835?format=json
  const blocks = await fetchBlocks(day)
  //console.log(blocks)
  blocks.forEach(async block => {
    // console.log(block.hash);
    const response = await fetch(`${source}/posts/${block.hash}`)
    const posts = await response.json()
    console.log(posts)
    posts.forEach(async post => {
      /* post example 
      {
        signature: '3045022100e2ba6f9af7d847cabcb3a964315196982440b44c9c252e2b4f2ac00cfd37906202205cd5e1b5bc95afd3eb97514d71395f8f78fd989d520908923449cef47bbd09fc',
        domain: 'revron.be',
        path: 'revron.be/first-post',
        hash: 'f47b92e3ef005ff463cc823ea367c945aab825349a521b75c4373b9643cd44dc',
        block: '00000000000000000004c60f1e37d649f110fef4010102c5b6c6aa5dc1f47d91',
        source: 'QmV2QyH7ZxcuHHwYxvHJQgKpMTv2u4kh51EZiMfYGawpdk',
        inserted_at: 1694290654290,
        dead_at: null
      }
      */

      // split post.path in to domain and path
      const parts = post.path.split('/');
      const domain = parts[0];
      parts.shift();
      const path = parts.join('/');

      const valid = await validators.validateSubmission({
        ownerDomain: post.domain,
        postDomain: domain,
        signatureHex: post.signature,
        path,
        hash: post.hash,
        blockHash: post.block,
        validatePostContent: false
      })
      console.log(valid);
      if (!valid.valid) {
        return;
      }
      const value = valid.value;
      
      try {
        await db.insertPost(
          value.ownerDomain,
          value.postDomain,
          value.path,
          value.hash,
          value.blockHash,
          value.signatureHex,
          source
        )
        console.log('inserted');
      } catch (e) {
        winston.error(e)
      }
    })
  });
  // exit
}

// node src/populate.js -s https://instance.did-1.com -d 1692635195225
main()