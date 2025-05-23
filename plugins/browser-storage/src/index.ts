import { getOptions, type Idmp, type IdmpOptions, type IdmpPromise } from 'idmp'

const UNDEFINED = undefined

type StorageType = 'localStorage' | 'sessionStorage'
// type NonVoid<T> = T extends void ? never : T

const PREFIX = '@idmp/v1/'
const getCacheKey = (globalKey: string) => `${PREFIX}${globalKey}`

const initStorage = (storageType: StorageType) => {
  let storage: Storage
  try {
    storage = window[storageType]
  } catch {}

  const remove = (key: string) => {
    if (!key) return
    try {
      const cacheKey = getCacheKey(key)
      storage.removeItem(cacheKey)
    } catch {}
  }

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

  const set = <T = any>(key: string, data: T, maxAge: number) => {
    if (!key) return
    const cacheKey = getCacheKey(key)
    try {
      storage.setItem(cacheKey, JSON.stringify({
        t: Date.now(),
        a: maxAge,
        d: data,
      }))
    } catch {}
  }

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
