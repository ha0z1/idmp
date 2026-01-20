import { getOptions, type Idmp, type IdmpOptions, type IdmpPromise } from 'idmp'

const UNDEFINED = undefined

type StorageType = 'localStorage' | 'sessionStorage'
// type NonVoid<T> = T extends void ? never : T

const PREFIX = '@idmp/v4/'

// Returns the full cache key used for storage
const getCacheKey = (globalKey: string) => `${PREFIX}${globalKey}`

/**
 * Initialize a safe storage utility (localStorage or sessionStorage) with get/set/remove/clear methods
 * @param storageType - Either 'localStorage' or 'sessionStorage'
 */
const initStorage = (storageType: StorageType) => {
  let storage: Storage
  try {
    storage = window[storageType]
  } catch {}

  /**
   * Remove a cached item by key
   * @param key - Global cache key
   */
  const remove = (key: string) => {
    if (!key) return
    try {
      const cacheKey = getCacheKey(key)
      storage.removeItem(cacheKey)
    } catch {}
  }

  /**
   * Retrieve cached data if available and not expired
   * @param key - Global cache key
   * @returns Cached data or undefined if not found or expired
   */
  const get = <T = any>(key: string) => {
    if (!key) return
    const cacheKey = getCacheKey(key)
    let localData
    try {
      localData = JSON.parse(storage.getItem(cacheKey) || '')

      if (localData === UNDEFINED) return

      const { t, a: maxAge, d: data } = localData

      if (Date.now() - t > maxAge) {
        remove(cacheKey)
        return
      }
      return data as T
    } catch {}
  }

  /**
   * Set data into storage with expiration
   * @param key - Global cache key
   * @param data - Data to cache
   * @param maxAge - Time in milliseconds before expiration
   */
  const set = <T = any>(key: string, data: T, maxAge: number) => {
    if (!key) return
    const cacheKey = getCacheKey(key)
    try {
      storage.setItem(
        cacheKey,
        JSON.stringify({
          t: Date.now(), // timestamp
          a: maxAge, // age (ttl)
          d: data, // data
        }),
      )
    } catch {}
  }

  /**
   * Clear all cached entries in the current storage matching the specific prefix
   */
  const clear = () => {
    try {
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i)
        if (key && key.startsWith(PREFIX)) {
          remove(key)
        }
      }
    } catch {}
  }

  return {
    get,
    set,
    remove,
    clear,
  }
}

/**
 * Wrap an idmp instance with browser storage (localStorage or sessionStorage) for persistent caching
 * @param _idmp - Original idmp instance
 * @param storageType - Storage type to use, default is 'sessionStorage'
 * @returns Wrapped idmp instance with persistent caching
 */
const storageIdmpWrap = (
  _idmp: Idmp,
  storageType: StorageType = 'sessionStorage',
) => {
  const storage = initStorage(storageType)

  const newIdmp = <T>(
    globalKey: string,
    promiseFunc: IdmpPromise<T>,
    options?: IdmpOptions,
  ): Promise<T> => {
    const finalOptions = getOptions(options)

    return _idmp(
      globalKey,
      async () => {
        const localData = storage.get<T>(globalKey)
        if (localData !== UNDEFINED) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(
              `[idmp-plugin browser-storage debug] ${globalKey} from ${storageType}["${getCacheKey(globalKey)}"]`,
            )
          }
          return localData
        }

        const memoryData = await promiseFunc()
        if (memoryData !== UNDEFINED) {
          // console.log('from memoryData')
          storage.set(globalKey, memoryData, finalOptions.maxAge) // no need wait
        }
        return memoryData
      },
      options,
    )
  }

  /**
   * Flush both idmp memory and browser storage cache for a specific key
   * @param globalKey - Global cache key
   */
  newIdmp.flush = (globalKey: string) => {
    _idmp.flush(globalKey)
    storage.remove(globalKey)
  }

  /**
   * Flush all idmp memory and browser storage cache
   */
  newIdmp.flushAll = () => {
    _idmp.flushAll()
    storage.clear()
  }

  return newIdmp
}

export default storageIdmpWrap
export { getCacheKey }
