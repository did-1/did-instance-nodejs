import { Command } from 'commander';
const program = new Command();

program
  .requiredOption('-s, --source <char>')
  .requiredOption('-d, --day <char>')

program.parse()

const options = program.opts()
const source = options.source
const day = options.day

const main = async () => {
    console.log('i am here')
}

main()