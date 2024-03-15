import { getOptions, type Idmp, type IdmpOptions, type IdmpPromise } from 'idmp'

const udf = undefined

type StorageType = 'localStorage' | 'sessionStorage'
// type NonVoid<T> = T extends void ? never : T

const getCacheKey = (globalKey: string) => `@idmp/v1/${globalKey}`

const initStorage = (storageType: StorageType) => {
  let storage: Storage
  try {
    storage = window[storageType]
  } catch {}

  return {
    get: <T = any>(key: string) => {
      if (!key) return
      const cacheKey = getCacheKey(key)
      let localData
      try {
        localData = JSON.parse(storage[cacheKey])

        if (localData === udf) return

        const { t, a: maxAge, d: data } = localData

        if (Date.now() - t > maxAge) {
          storage.removeItem(cacheKey)
          return
        }
        return data as T
      } catch {}
    },

    set: <T = any>(key: string, data: T, maxAge: number) => {
      if (!key) return
      const cacheKey = getCacheKey(key)
      try {
        storage[cacheKey] = JSON.stringify({
          t: Date.now(),
          a: maxAge,
          d: data,
        })
      } catch {}
    },

    remove: (key: string) => {
      if (!key) return
      try {
        const cacheKey = getCacheKey(key)
        storage.removeItem(cacheKey)
      } catch {}
    },

    clear: () => {
      try {
        storage.clear()
      } catch {}
    },
  }
}

const storageIdmpWrap = (
  _idmp: Idmp,
  storageType: StorageType = 'sessionStorage',
) => {
  const storage = initStorage(storageType)
  const newIdmp = <T>(
    globalKey: string,
    promiseFunc: IdmpPromise<T>,
    options?: IdmpOptions,
  ) => {
    const finalOptions = getOptions(options)
    return _idmp(
      globalKey,
      async () => {
        const localData = storage.get(globalKey)
        if (localData !== udf) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(
              `[idmp-plugin browser-storage debug] ${globalKey} from ${storageType}["${getCacheKey(globalKey)}"]`,
            )
          }
          return localData
        }

        const memoryData = await promiseFunc()
        if (memoryData !== udf) {
          // console.log('from memoryData')s a
          storage.set(globalKey, memoryData, finalOptions.maxAge) // no need wait
        }
        return memoryData
      },
      options,
    )
  }
  newIdmp.flush = (globalKey: string) => {
    _idmp.flush(globalKey)
    storage.remove(globalKey)
  }
  newIdmp.flushAll = () => {
    _idmp.flushAll()
    storage.clear()
  }
  return newIdmp
}

export default storageIdmpWrap
export { getCacheKey }
