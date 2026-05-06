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

const cachePrefix = `/idmp/v4/${md5(__filename)}`

const udf = undefined
const encode = encodeURIComponent

/**
 * Build a redis key from (namespace, globalKey).
 *
 * Each part is `encodeURIComponent`-encoded individually, then joined with
 * `:` (colon). encodeURIComponent leaves `_` untouched — so the previous
 * `${namespace}_${globalKey}` join was ambiguous:
 *   ('user',  '_admin_x')
 *   ('user_', 'admin_x')
 * both produced `user__admin_x` and would clobber each other.
 *
 * encodeURIComponent escapes `:` to `%3A`, so a literal `:` is the unique
 * separator regardless of what the user puts in either part.
 */
const getCachePath = (namespace: string, globalKey: string) =>
  `${cachePrefix}/${encode(namespace)}:${encode(globalKey)}`

/**
 * Prefix used by SCAN+DEL inside flushAll to scope deletion to the calling
 * wrapper's namespace. Mirrors the structure of getCachePath up to the
 * separator so that prefix matching is exact.
 */
const getNamespacePrefix = (namespace: string) =>
  `${cachePrefix}/${encode(namespace)}:`

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

  // Library code must NOT call process.exit — that would tear down the host
  // application. Surface errors to the user instead and let them decide.
  // Use `on` (not `once`) so we don't silently swallow subsequent errors and
  // turn them into unhandled events.
  client.on('error', (err: any) => {
    /* istanbul ignore next */
    console.error('[idmp/redis] Redis Client Error', err)
  })

  // Single-flight connect: concurrent getData/setData calls must NOT call
  // client.connect() in parallel — redis v5 throws "Socket already opened".
  let connectPromise: Promise<unknown> | null = null
  const ensureConnected = () => {
    if (client.isOpen) return Promise.resolve()
    if (!connectPromise) {
      connectPromise = client.connect().catch((err: any) => {
        // Reset so the next call can retry.
        connectPromise = null
        throw err
      })
    }
    return connectPromise
  }

  const setData = async <T = any>(
    ns: string,
    key: string,
    data: T,
    maxAge: number,
  ) => {
    if (!key) return
    await ensureConnected()
    const cachePath = getCachePath(ns, key)
    await client.set(cachePath, stringify_UNSAFE(data), {
      expiration: {
        type: 'EX',
        value: Math.floor(maxAge / 1000), // Redis EX is in seconds
      },
    })
  }

  const getData = async <T = any>(ns: string, key: string) => {
    if (!key) return udf
    await ensureConnected()

    const cachePath = getCachePath(ns, key)

    let redisLocalData!: T | null
    try {
      const rawData = await client.get(cachePath)
      if (!rawData) return udf
      redisLocalData = parse_UNSAFE(rawData) as T
    } catch {}

    if (redisLocalData === udf) return udf

    return redisLocalData
  }

  // Namespaced flushAll — only delete keys belonging to this wrapper instance.
  // The previous implementation used `cachePrefix` (file-md5 only), which
  // would also wipe other namespaces sharing the same redis instance.
  const namespacePrefix = getNamespacePrefix(namespace)
  const deleteKeysByPrefix = async (prefix: string) => {
    await ensureConnected()

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
  }

  // Build the in-memory dedup key for the underlying idmp instance.
  // Use \x00 (NUL) as separator — JS strings rarely contain a literal NUL,
  // and even if they do, the separator never appears in `namespace` because
  // a NUL there would be equally separator-like in both halves. The point
  // is to avoid the `_`-collision the public redis path also suffered from.
  const idmpKeyOf = (globalKey: string) => `${namespace}\x00${globalKey}`

  const newIdmp = <T>(
    globalKey: string,
    promiseFunc: IdmpPromise<T>,
    options?: IdmpOptions,
  ) => {
    const idmpKey = idmpKeyOf(globalKey)
    const finalOptions = getOptions(options)
    return _idmp(
      idmpKey,
      async () => {
        const localData = await getData(namespace, globalKey)

        if (localData !== udf) {
          return localData
        }

        const memoryData = await promiseFunc()
        if (memoryData !== udf) {
          // Don't await — but DO catch so a write failure doesn't surface as
          // an unhandledRejection (and crash Node 22+ by default).
          setData(namespace, globalKey, memoryData, finalOptions.maxAge).catch(
            /* istanbul ignore next */ (err) => {
              console.error('[idmp/redis] setData failed', err)
            },
          )
        }
        return memoryData
      },
      {
        maxAge: 0, // 宏任务仍会在内存中优化
      },
    )
  }

  newIdmp.flush = async (globalKey: string) => {
    _idmp.flush(idmpKeyOf(globalKey))
    await ensureConnected()
    await client.del(getCachePath(namespace, globalKey))
  }
  newIdmp.flushAll = async () => {
    _idmp.flushAll()
    await deleteKeysByPrefix(namespacePrefix)
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
