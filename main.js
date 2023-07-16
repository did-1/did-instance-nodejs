import fs from 'fs'
import dotenv from 'dotenv'

import libp2pServer from './src/server.js'
import httpServer from './src/http.js'

if (!fs.existsSync('./.env')) {
  console.log('Please setup .env file before launch')
  process.exit(1)
}

dotenv.config()

libp2pServer().then().catch(console.error)

httpServer.listen(process.env.HTTP_PORT, () => {
  console.log(`App llistening on port ${process.env.HTTP_PORT}`)
})
