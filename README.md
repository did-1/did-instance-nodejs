# DID NodeJS Instance

## How to start your own instance

Node instance requires Node version 16

1. `npm i`
2. `cp .env.default .env`
3. `node main.js`

.env file parameters

* HOSTAME: instance host - this will define your instance multiaddress. Other instances will be able to connect to you via it.
* HTTP_PORT: an optional param that adds http server to your instance This allows to submit new urls via http
* P2P_PORT: your instance p2p port
* BOOTSTRAPPERS: comma separated values of did instances that you want to connect on start

DID1 bootrap address: `/dnsaddr/instance.did-1.com/tcp/8731/p2p/QmV2QyH7ZxcuHHwYxvHJQgKpMTv2u4kh51EZiMfYGawpdk`

## How it works

On the first run your instance will generate private/public keypair for your instance. This key pair will allow for you instance to be uniquely identified via multiaddress and will make sure that your address never changes.

You will see your address after starting the instance for example:
`/ip4/127.0.0.1/tcp/8731/p2p/QmbHqAVmPtsVWptKGjJVdWtqBwfqsrM8vpW2K7KGBTyrrJ`

Your instance will listen to new URLs submitted via http port or received from other instances. If URLs are valid they will be added to local sqlite database `did.db`, which is hosted on same folder

## Database structure

The most important table is `posts`. Table structure:
```sqlite
  signature TEXT PRIMARY KEY, -- signature made by signing blockHash + url + content hash using submitter private key
  domain TEXT NOT NULL, -- domain who submitted URL
  path TEXT NOT NULL, -- URL
  hash TEXT NOT NULL, -- URL content hash at the moment it was submitted
  block TEXT NOT NULL, -- bitcoin block ID, that matches the time submitted
  source TEXT NOT NULL, -- multiaddress that post info was received from
  inserted_at INTEGER NOT NULL, -- server time of insert
  dead_at INTEGER -- indicator when post was found missing from destination
```

`users` table is used to cache public keys for domains and `blocks` table is used to cache bitcoin network block information

## Why bitcoin block hash is used for sumbmissions

There are several reasons for that:

1. To protect from submitting urls with future timestamps
2. For easier future data synchronization, so that we could sync url data in blocks
3. For future user actions limits implementation. There will be limited actions allowed from domain per block in order to avoid ddos and spam.

## Roadmap

This code is still at proof of concept stage! You will be able to receive realtime updates from other instances, but data synchronization is not yet implemented. That means that you will not receive past submissions that were submitted before your instance was booted
