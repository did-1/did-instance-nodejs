import fs from 'fs'
import dotenv from 'dotenv'
import winston from 'winston'

import libp2pServer from './src/server.js'
import httpServer, { httpRouter } from './src/http.js'

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

if (!fs.existsSync('./.env')) {
  logger.error('Please setup .env file before launch')
  process.exit(1)
}

dotenv.config()

async function start() {
  const p2pNode = await libp2pServer()

  if (process.env.HTTP_PORT) {
    httpServer.use((req, res, next) => {
      req.p2pNode = p2pNode
      req.logger = winston
      next()
    })
    httpServer.use(httpRouter)
    httpServer.listen(process.env.HTTP_PORT, () => {
      winston.info(`App llistening on port ${process.env.HTTP_PORT}`)
    })
  } else {
    winston.warn(
      'HTTP port not specified, starting instance without http server'
    )
  }
}

start()
