import { getOptions, type Idmp, type IdmpOptions, type IdmpPromise } from 'idmp'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createClient } from 'redis'
import serialize from 'serialize-javascript'

const __filename = fileURLToPath(import.meta.url)
const md5 = (data: string) => createHash('md5').update(data).digest('hex')

const deSerialize = <T = any>(data: string) =>
  new Function(`return ${data}`)() as T

const cachePrefix = `/idmp/v1/${md5(__filename)}`

const udf = undefined
const encode = encodeURIComponent
const getCachePath = (globalKey: string) =>
  `${cachePrefix}/${encode(globalKey)}`

// type NonVoid<T> = T extends void ? never : T

interface RedisIdmpOptions {
  url: string
}

const redisIdmpWrap = (
  _idmp: Idmp,
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
    await client.set(cachePath, serialize(data), {
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
      redisLocalData = deSerialize((await client.get(cachePath)) || 'undefined')
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
