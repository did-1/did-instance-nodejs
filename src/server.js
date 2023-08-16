import fs from 'fs'
import winston from 'winston'

import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { mplex } from '@libp2p/mplex'
import { peerIdFromKeys } from '@libp2p/peer-id'
import { keys } from '@libp2p/crypto'

import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
// import { bootstrap } from '@libp2p/bootstrap'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { multiaddr } from 'multiaddr'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

import db from './db.js'
import validators from './validators.js'

import { pipe } from 'it-pipe'

const main = async () => {
  if (
    !fs.existsSync('./keys/private.key') ||
    !fs.existsSync('./keys/public.key')
  ) {
    winston.info('Generating keys...')
    const privateKey = await keys.generateKeyPair('RSA', 2048)
    const publicKey = privateKey.public
    const dir = './keys/'
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(dir + 'private.key', Buffer.from(privateKey.bytes))
    fs.writeFileSync(dir + 'public.key', Buffer.from(publicKey.bytes))
  }
  const privateKey = new Uint8Array(fs.readFileSync('./keys/private.key'))
  const publicKey = new Uint8Array(fs.readFileSync('./keys/public.key'))
  const id = await peerIdFromKeys(publicKey, privateKey)
  winston.info(`Your peer ID: ${id}`)

  const peerDiscovery = []
  peerDiscovery.push(pubsubPeerDiscovery())
  const node = await createLibp2p({
    peerId: id,
    addresses: {
      // add a listen address (localhost) to accept TCP connections. 0 would mean the port is random
      listen: [`/ip4/${process.env.HOSTNAME}/tcp/${process.env.P2P_PORT}`]
    },
    transports: [tcp()],
    connectionEncryption: [noise()],
    peerDiscovery,
    streamMuxers: [mplex(), yamux()],
    pubsub: gossipsub({ allowPublishToZeroPeers: true })
  })

  node.addEventListener('peer:connect', async (evt) => {
    winston.verbose(
      'Connection established to:',
      evt.detail.remotePeer.toString()
    ) // Emitted when a new connection has been created
  })

  node.addEventListener('peer:discovery', (evt) => {
    // No need to dial, autoDial is on
    winston.verbose('Discovered:', evt.detail.id.toString())
  })

  // start libp2p
  await node.start()

  // print out listening addresses
  winston.info('listening on addresses:')
  node.getMultiaddrs().forEach((addr) => {
    winston.info(addr.toString())
  })

  await node.pubsub.subscribe('news')
  node.pubsub.addEventListener('message', async (evt) => {
    if (evt.detail.topic === 'news') {
      const data = JSON.parse(uint8ArrayToString(evt.detail.data))
      const { ownerDomain, postDomain, signatureHex, path, hash, blockHash } =
        data
      let resp = {}
      try {
        resp = await validators.validateSubmission({
          ownerDomain,
          postDomain,
          signatureHex,
          path,
          hash,
          blockHash
        })
      } catch (e) {
        winston.error(e)
      }
      if (resp.error || !resp.valid) {
        winston.error(resp.error || 'Validation failed')
      }

      // 7. save entry in sqlite
      winston.info('SAVE ENTRY', signatureHex)
      try {
        await db.insertPost(
          ownerDomain,
          postDomain,
          path,
          hash,
          blockHash,
          signatureHex,
          evt.detail.from.toString()
        )
      } catch (e) {
        winston.error(e)
      }
    }
  })

  if (process.env.BOOTSTRAPPERS) {
    const bootstrappers = process.env.BOOTSTRAPPERS.split(',')
    bootstrappers.forEach(async (b) => {
      const ma = multiaddr(b)
      winston.verbose(`pinging remote peer at ${b}`)
      const latency = await node.ping(ma)

      winston.verbose(`pinged ${b} in ${latency}ms`)

      const stream = await node.dialProtocol(ma, '/did/1.0.0')
      pipe(
        // Source data
        [uint8ArrayFromString('hey')],
        // Write to the stream, and pass its output to the next function
        stream,
        // Sink function
        async function (source) {
          // For each chunk of data
          for await (const data of source) {
            // Output the data
            winston.verbose(
              'received echo:',
              uint8ArrayToString(data.subarray())
            )
          }
        }
      )
    })
  }

  await node.handle('/did/1.0.0', async ({ stream }) => {
    winston.verbose('received did stream' + stream)
    pipe(stream.source, stream.sink)
  })

  const stop = async () => {
    // stop libp2p
    await node.stop()
    winston.info('p2p node has stopped')
    process.exit(0)
  }

  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  return node
}

export default main
