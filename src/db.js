import sqlite3 from 'sqlite3'
import winston from 'winston'

const db = new sqlite3.Database(
  './did.db',
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      winston.error(err.message) // Bummer, man! An error.
    }
    winston.debug('Connected to the did.db.') // All good, bro.
  }
)

db.run(
  `CREATE TABLE IF NOT EXISTS posts (
    signature TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    path TEXT NOT NULL,
    hash TEXT NOT NULL,
    block TEXT NOT NULL,
    source TEXT NOT NULL,
    inserted_at INTEGER NOT NULL,
    dead_at INTEGER
  );`,
  (err) => {
    if (err) {
      return winston.error(err.message) // If things go south, we'll know.
    }
    winston.debug('posts table initialized') // Success, bro!
  }
)

db.run(
  `CREATE TABLE IF NOT EXISTS blocks (
    hash TEXT PRIMARY KEY,
    time INTEGER NOT NULL
  );`,
  (err) => {
    if (err) {
      return winston.error(err.message) // If things go south, we'll know.
    }
    winston.debug('blocks table initialized') // Success, bro!
  }
)

db.run(
  `CREATE TABLE IF NOT EXISTS users (
    domain TEXT PRIMARY KEY,
    key TEXT NOT NULL
  );`,
  (err) => {
    if (err) {
      return winston.error(err.message) // If things go south, we'll know.
    }
    winston.debug('users table initialized') // Success, bro!
  }
)

const methods = {
  insertPost: (
    ownerDomain,
    postDomain,
    path,
    hash,
    blockHash,
    signature,
    source
  ) => {
    const promise = new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO posts (signature, domain, hash, path, block, source, inserted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      stmt.run(
        signature,
        ownerDomain,
        hash,
        [postDomain, path].join('/'),
        blockHash,
        source,
        +new Date(),
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
  insertUser: (hash, time) => {
    const promise = new Promise((resolve, reject) => {
      const stmt = db.prepare(`INSERT INTO users (domain, key) VALUES (?, ?)`)
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
      db.get(`SELECT * FROM blocks WHERE hash = ?`, [hash], (err, row) => {
        if (err) {
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
    return promise
  },
  getUser: (domain) => {
    const promise = new Promise((resolve, reject) => {
      db.get(`SELECT * FROM users WHERE domain = ?`, [domain], (err, row) => {
        if (err) {
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
    return promise
  },
  getPostBySignature: (signature) => {
    const promise = new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM posts WHERE signature = ?`,
        [signature],
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
