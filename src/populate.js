import fetch from 'node-fetch'
import { Command } from 'commander'

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
  const blocks = await fetchBlocks(day);
  blocks.forEach(async block => {
    console.log(block.hash);
    const response = await fetch(`${source}/posts/${block.hash}`);
    console.log(await response.json());
  });
}

// node src/populate.js -s https://instance.did-1.com -d 1694290654290
main()