'use strict'
const path = require('path')
const fs = require('fs-extra')

const DEFAULT_PATH = './db'
const DEFAULT_FILE_PREFIX = '_key_'
const DEFAULT_FILE_EXT = 'json'

class KVPFileStore {
  /**
   * @constructor
   *
   * @param [options={}] {Object}
   * @param [options.path] {string}
   * @param [options.collections] {Array<string>}
   * @param [options.filePrefix] {string}
   * @param [options.fileExt] {string}
   */
  constructor (options = {}) {
    this.path = options.path || DEFAULT_PATH
    this.collections = options.collections || []
    this.filePrefix = options.filePrefix || DEFAULT_FILE_PREFIX
    this.fileExt = options.fileExt || DEFAULT_FILE_EXT

    // Set up default serialize/deserialize hooks
    // These can be overridden by the client after instantiation
    this.serialize = (data) => {
      return JSON.stringify(data)
    }

    this.deserialize = (data) => {
      try {
        data = JSON.parse(data)
      } catch (error) {
        console.error('Error deserializing object: ', error)
      }
      return data
    }
  }

  /**
   * @method absolutePathFor
   * @private
   * @param {string} collectionName
   * @param {string} key
   * @return {string}
   */
  absolutePathFor (collectionName, key) {
    return path.resolve(this.relativePathFor(collectionName, key))
  }

  /**
   * @method createCollection
   * @param {string} collectionName
   * @throws {TypeError} If collection name is a falsy value.
   * @throws {Error} fs error
   * @return {Promise}
   */
  createCollection (collectionName) {
    if (!collectionName) {
      return Promise.reject(new TypeError('Cannot create empty collection name'))
    }
    let collectionPath = this.absolutePathFor(collectionName)
    return new Promise((resolve, reject) => {
      fs.mkdirp(collectionPath, (err) => {
        if (err) {
          return reject(err)
        } else {
          return resolve(true)
        }
      })
    })
  }

  /**
   * @private
   * @param collectionName
   */
  createCollectionSync (collectionName) {
    if (!collectionName) {
      throw new TypeError('Cannot create empty collection name')
    }
    let collectionPath = this.absolutePathFor(collectionName)
    fs.mkdirpSync(collectionPath)
  }

  /**
   * @method remove
   * @param {string} collectionName
   * @param {string} key
   * @throws {TypeError} If collection name or key is a falsy value.
   * @throws {Error} fs error
   * @return {Promise<Boolean>}
   */
  remove (collectionName, key) {
    if (!collectionName) {
      return Promise.reject(new TypeError('Cannot call del() using an empty collection name'))
    }
    if (!key) {
      return Promise.reject(new TypeError('Cannot call del() using an empty key'))
    }
    let filePath = this.absolutePathFor(collectionName, key)
    return new Promise((resolve, reject) => {
      fs.unlink(filePath, (err) => {
        if (!err) {
          return resolve(true)
        }
        if (err.code === 'ENOENT') {
          return resolve(false)
        }
        return reject(err)
      })
    })
  }

  del (collectionName, key) {
    return this.remove(collectionName, key)
  }

  /**
   * @method exists
   * @param {string} collectionName
   * @param {string} key
   * @throws {TypeError} If collection name or key is a falsy value.
   * @throws {Error} fs error
   * @return {Promise<Boolean>}
   */
  exists (collectionName, key) {
    if (!collectionName) {
      return Promise.reject(new TypeError('Cannot call exists() using an empty collection name'))
    }
    if (!key) {
      return Promise.reject(new TypeError('Cannot call exists() using an empty key'))
    }
    let filePath = this.absolutePathFor(collectionName, key)
    return new Promise((resolve, reject) => {
      fs.access(filePath, fs.R_OK | fs.W_OK, (err) => {
        if (!err) {
          return resolve(true)
        }
        if (err.code === 'ENOENT') {
          return resolve(false)
        }
        return reject(err)
      })
    })
  }

  /**
   * @private
   * @param key {string}
   * @return {string}
   */
  fileNameFor (key) {
    return `${this.filePrefix}${key}.${this.fileExt}`
  }

  /**
   * @method get
   * @param {string} collectionName
   * @param {string} key
   * @throws {TypeError} If collection name or key is a falsy value.
   * @throws {Error} fs error
   * @return {Promise<Object>}
   */
  get (collectionName, key) {
    let filePath = this.absolutePathFor(collectionName, key)
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, result) => {
        if (!err) {
          if (this.deserialize) {
            result = this.deserialize(result)
          }
          return resolve(result)
        }
        if (err.code === 'ENOENT') {
          return resolve(null)
        }
        return reject(err)
      })
    })
  }

  initCollections () {
    for (let collectionName of this.collections) {
      this.createCollectionSync(collectionName)
    }
  }

  /**
   * @private
   * @param collectionName {string}
   * @param key {string}
   * @throws {TypeError}
   * @return {string}
   */
  relativePathFor (collectionName, key) {
    if (!collectionName) {
      throw new TypeError('Cannot resolve path for an empty collection name')
    }
    let relPath = path.join(this.path, collectionName)
    if (key) {
      relPath = path.join(relPath, this.fileNameFor(key))
    }
    return relPath
  }

  /**
   * @method put
   * @param {string} collectionName
   * @param {string} key
   * @param {Object} data
   * @throws {TypeError} If collection name or key is a falsy value.
   * @throws {Error} fs error
   * @return {Promise}
   */
  put (collectionName, key, data) {
    if (!collectionName) {
      return Promise.reject(new TypeError('Cannot put() using an empty collection name'))
    }
    if (!key) {
      return Promise.reject(new TypeError('Cannot put() using an empty key'))
    }
    let filePath = this.absolutePathFor(collectionName, key)
    if (this.serialize) {
      data = this.serialize(data)
    }
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, data, (err) => {
        if (!err) {
          return resolve(true)
        }
        if (err.code === 'ENOENT') {
          return reject(new Error(`Error in put() - collection ${JSON.stringify(collectionName)} does not exist`))
        } else {
          return resolve(true)
        }
      })
    })
  }
}

KVPFileStore.DEFAULT_PATH = DEFAULT_PATH
KVPFileStore.DEFAULT_FILE_PREFIX = DEFAULT_FILE_PREFIX
KVPFileStore.DEFAULT_FILE_EXT = DEFAULT_FILE_EXT

module.exports = KVPFileStore