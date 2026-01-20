import { createHash } from 'crypto'
import {
  getOptions,
  type IdmpGlobalKey,
  type IdmpOptions,
  type IdmpPromise,
} from 'idmp'
import { parse_UNSAFE, stringify_UNSAFE } from 'json-web3'
import { createClient } from 'redis'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const md5 = (data: string) => createHash('md5').update(data).digest('hex')

const cachePrefix = `/idmp/v1/${md5(__filename)}`

const udf = undefined
const encode = encodeURIComponent
const getCachePath = (globalKey: string) =>
  `${cachePrefix}/${encode(globalKey)}`

// type NonVoid<T> = T extends void ? never : T

interface RedisIdmpOptions {
  url: string
}
type IdmpLike = (<T>(
  globalKey: IdmpGlobalKey,
  promiseFunc: IdmpPromise<T>,
  options?: IdmpOptions,
) => Promise<T>) & {
  flush: (globalKey: IdmpGlobalKey) => void
  flushAll: () => void
}

const redisIdmpWrap = (
  _idmp: IdmpLike,
  namespace: string,
  options: RedisIdmpOptions,
) => {
  const client = createClient({
    url: options.url,
  })

  client.once('error', (err) => {
    console.error('Redis Client Error', err)
    process.exit(err.code === 'ECONNREFUSED' ? 1 : 0)
  })

  const setData = async <T = any>(key: string, data: T, maxAge: number) => {
    if (!key) return
    if (!client.isOpen) {
      await client.connect()
    }
    const cachePath = getCachePath(key)
    await client.set(cachePath, stringify_UNSAFE(data), {
      expiration: {
        type: 'EX',
        value: Math.floor(maxAge / 1000), // Redis EX is in seconds
      },
    })
  }

  const getData = async <T = any>(key: string) => {
    if (!key) return udf
    if (!client.isOpen) {
      await client.connect()
    }

    const cachePath = getCachePath(key)

    let redisLocalData!: T | null
    try {
      const rawData = await client.get(cachePath)
      if (!rawData) return udf
      redisLocalData = parse_UNSAFE(rawData) as T
    } catch {}

    if (redisLocalData === udf) return udf

    return redisLocalData
  }

  const deleteKeysByPrefix = async (prefix: string) => {
    const client = createClient({ url: options.url })
    await client.connect()

    let cursor = '0'
    const pattern = `${prefix}*`
    do {
      const { cursor: nextCursor, keys } = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      })

      cursor = nextCursor

      if (keys.length > 0) {
        await client.del(keys)
      }
    } while (cursor !== '0')

    await client.quit()
  }

  const newIdmp = <T>(
    globalKey: string,
    promiseFunc: IdmpPromise<T>,
    options?: IdmpOptions,
  ) => {
    globalKey = `${namespace}_${globalKey}`
    const finalOptions = getOptions(options)
    return _idmp(
      globalKey,
      async () => {
        const localData = await getData(globalKey)

        if (localData !== udf) {
          return localData
        }

        const memoryData = await promiseFunc()
        if (memoryData !== udf) {
          setData(globalKey, memoryData, finalOptions.maxAge)
        }
        return memoryData
      },
      {
        maxAge: 0, // 宏任务仍会在内存中优化
      },
    )
  }

  newIdmp.flush = async (globalKey: string) => {
    _idmp.flush(globalKey)
    await client?.del(getCachePath(globalKey))
  }
  newIdmp.flushAll = async () => {
    _idmp.flushAll()
    await deleteKeysByPrefix(cachePrefix)
  }
  newIdmp.quit = async () => {
    if (client.isOpen) {
      await client.quit()
    }
  }

  return newIdmp
}

export default redisIdmpWrap
export { cachePrefix, getCachePath }
