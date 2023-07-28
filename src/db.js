import sqlite3 from 'sqlite3'

const db = new sqlite3.Database(
  './did.db',
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error(err.message) // Bummer, man! An error.
    }
    console.log('Connected to the did.db.') // All good, bro.
  }
)

db.run(
  `CREATE TABLE IF NOT EXISTS posts (
    signature TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    path TEXT NOT NULL,
    hash TEXT NOT NULL,
    block TEXT NOT NULL
  );`,
  (err) => {
    if (err) {
      return console.error(err.message) // If things go south, we'll know.
    }
    console.log('posts table initialized') // Success, bro!
  }
)

db.run(
  `CREATE TABLE IF NOT EXISTS blocks (
    hash TEXT PRIMARY KEY,
    time INTEGER NOT NULL
  );`,
  (err) => {
    if (err) {
      return console.error(err.message) // If things go south, we'll know.
    }
    console.log('blocks table initialized') // Success, bro!
  }
)

const methods = {
  insertPost: (ownerDomain, postDomain, path, hash, blockHash, signature) => {
    const promise = new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO posts (signature, domain, hash, path, block) VALUES (?, ?, ?, ?, ?)`
      )
      const sigHex = signature.map((num) => num.toString(16)).join('')
      stmt.run(
        sigHex,
        ownerDomain,
        hash,
        [postDomain, path].join('/'),
        blockHash,
        (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    })
    return promise
  },
  insertBlock: (hash, time) => {
    const promise = new Promise((resolve, reject) => {
      const stmt = db.prepare(`INSERT INTO blocks (hash, time) VALUES (?, ?)`)
      stmt.run(hash, time, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
    return promise
  },
  getBlock: (hash) => {
    const promise = new Promise((resolve, reject) => {
      const stmt = db.get(
        `SELECT * FROM blocks WHERE hash = ?`,
        [hash],
        (err, row) => {
          if (err) {
            reject(err)
          } else {
            resolve(row)
          }
        }
      )
    })
    return promise
  }
}

export default methods
