import { createLibp2p } from 'libp2p'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'
import { toString as uint8ArrayToString } from "uint8arrays/to-string";

const main = async () => {
  const node = await createLibp2p({
    addresses: {
      // add a listen address (localhost) to accept TCP connections on a random port
      listen: [`/ip4/${process.env.HOSTNAME}/tcp/0`]
    },
    transports: [tcp()],
    connectionEncryption: [noise()],
    streamMuxers: [mplex()],
    pubsub: gossipsub({ allowPublishToZeroPeers: true })
  })

  // start libp2p
  await node.start()
  console.log('libp2p has started')

  // print out listening addresses
  console.log('listening on addresses:')
  node.getMultiaddrs().forEach((addr) => {
    console.log(addr.toString())
  })

  await node.pubsub.subscribe('news')
  node.pubsub.addEventListener('message', (evt) => {
    console.log(`node1 received: ${uint8ArrayToString(evt.detail.data)} on topic ${evt.detail.topic}`)
  })
  // console.log('PEERID', node.peerId)

  const stop = async () => {
    // stop libp2p
    await node.stop()
    console.log('libp2p has stopped')
    process.exit(0)
  }
  
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  
}

export default main