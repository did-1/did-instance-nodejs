import fs from 'fs';
import { createLibp2p } from 'libp2p'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'
import { yamux } from '@chainsafe/libp2p-yamux'
import { toString as uint8ArrayToString } from "uint8arrays/to-string";
import { peerIdFromKeys } from '@libp2p/peer-id'
import { keys } from '@libp2p/crypto'

const privateKey = new Uint8Array(fs.readFileSync('./keys/private.key'));
const publicKey = new Uint8Array(fs.readFileSync('./keys/public.key'));

const main = async () => {
  // const privateKey = await keys.generateKeyPair('RSA', 2048);
  // const publicKey = privateKey.public;
  // fs.writeFileSync('./keys/private.key', Buffer.from(privateKey.bytes));
  // fs.writeFileSync('./keys/public.key', Buffer.from(publicKey.bytes));
  const id = await peerIdFromKeys(publicKey, privateKey);
  console.log(id);
  const node = await createLibp2p({
    peerId: id,
    addresses: {
      // add a listen address (localhost) to accept TCP connections. 0 would mean the port is random
      listen: [`/ip4/${process.env.HOSTNAME}/tcp/54442`]
    },
    transports: [tcp()],
    connectionEncryption: [noise()],
    streamMuxers: [mplex(), yamux()],
    pubsub: gossipsub({ allowPublishToZeroPeers: true })
  })

  node.addEventListener('peer:connect', async (evt) => {
    console.log('Connection established to:', evt.detail.remotePeer.toString())	// Emitted when a new connection has been created
    console.log((await node.peerStore.all()).length);
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
  console.log((await node.peerStore.all()).length);

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