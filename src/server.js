import fs from 'fs'

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

import { pipe } from 'it-pipe'

const main = async () => {
  if (
    !fs.existsSync('./keys/private.key') ||
    !fs.existsSync('./keys/public.key')
  ) {
    console.log('Generating keys...')
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
  console.log(id)

  const peerDiscovery = []
  // if (process.env.BOOTSTRAPPERS) {
  //   const booostrappers = process.env.BOOTSTRAPPERS?.split(',')
  //   console.log('Using BOOTSTRAPPERS', booostrappers)
  //   peerDiscovery.push(
  //     bootstrap({
  //       // tagName: 'bootstrap',
  //       // tagValue: 50,
  //       // tagTTL: 120000,
  //       timeout: 1000,
  //       list: booostrappers
  //     })
  //   )
  // }
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
    console.log('Connection established to:', evt.detail.remotePeer.toString()) // Emitted when a new connection has been created
    console.log((await node.peerStore.all()).length)
  })

  node.addEventListener('peer:discovery', (evt) => {
    // No need to dial, autoDial is on
    console.log('Discovered:', evt.detail.id.toString())
  })

  // start libp2p
  await node.start()

  // print out listening addresses
  console.log('listening on addresses:')
  node.getMultiaddrs().forEach((addr) => {
    console.log(addr.toString())
  })

  console.log('libp2p has started')
  console.log((await node.peerStore.all()).length)

  await node.pubsub.subscribe('news')
  node.pubsub.addEventListener('message', (evt) => {
    if (evt.detail.topic !== '_peer-discovery._p2p._pubsub') {
      console.log(
        `node1 received: ${uint8ArrayToString(evt.detail.data)} on topic ${
          evt.detail.topic
        }`
      )
    }
  })

  if (process.env.BOOTSTRAPPERS) {
    const bootstrappers = process.env.BOOTSTRAPPERS.split(',')
    bootstrappers.forEach(async (b) => {
      const ma = multiaddr(b)
      console.log(`pinging remote peer at ${b}`)
      const latency = await node.ping(ma)

      console.log(`pinged ${b} in ${latency}ms`)
      console.log(`dialing remote peer at ${b}`)

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
            console.log('received echo:', uint8ArrayToString(data.subarray()))
          }
        }
      )
      // setTimeout(async () => {
      //   const resp = await node.pubsub
      //     .publish(
      //       'news',
      //       uint8ArrayFromString('Bird bird bird, bird is the word!')
      //     )
      //     .catch((err) => {
      //       console.error(err)
      //     })
      //   console.log(resp)
      // }, 1000)
    })
    // setInterval(async () => {
    //   const resp = await node.pubsub
    //     .publish(
    //       'news',
    //       uint8ArrayFromString('Bird bird bird, bird is the word!')
    //     )
    //     .catch((err) => {
    //       console.error(err)
    //     })
    //   console.log(resp)
    // }, 1000)
  }

  // console.log('PEERID', node.peerId)

  await node.handle('/did/1.0.0', async ({ stream }) => {
    console.log('received did stream' + stream)
    pipe(stream.source, stream.sink)
  })

  const stop = async () => {
    // stop libp2p
    await node.stop()
    console.log('libp2p has stopped')
    process.exit(0)
  }

  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  return node
}

export default main
