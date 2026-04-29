import { createHash } from 'crypto'
import fs from 'fs-extra'
import {
  getOptions,
  type IdmpGlobalKey,
  type IdmpOptions,
  type IdmpPromise,
} from 'idmp'
import { parse_UNSAFE, stringify_UNSAFE } from 'json-web3'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

// 当前文件的完整路径（绝对路径）
const __filename = fileURLToPath(import.meta.url)
const md5 = (data: string) => createHash('md5').update(data).digest('hex')

const deSerialize = <T = any>(data: string) => parse_UNSAFE(data) as T

const prefix = md5(__filename)

const udf = undefined
const encode = encodeURIComponent
// const cacheDir = path.resolve(process.env.HOME ?? '/tmp', '.idmp')
const cacheDir = path.resolve(os.tmpdir(), 'idmp')
const getCachePath = (globalKey: string) =>
  path.resolve(cacheDir, 'v4/node', prefix, encode(globalKey))

// Synchronous I/O — no `async` decoration; that was previously misleading
// since every call inside was *Sync. fs-extra's outputFileSync creates
// missing parent dirs, so the prior ensureFileSync was redundant.
const setData = <T = any>(key: string, data: T, maxAge: number) => {
  if (!key) return
  const cachePath = getCachePath(key)
  fs.outputFileSync(
    cachePath,
    stringify_UNSAFE({
      t: Date.now(),
      a: maxAge,
      d: data,
    }),
  )
}

const getData = <T = any>(key: string) => {
  if (!key) return udf
  const cachePath = getCachePath(key)

  let localData
  try {
    localData = deSerialize(fs.readFileSync(cachePath, 'utf-8'))
  } catch {}

  if (localData === udf) return udf

  const { t, a: maxAge, d: data } = localData

  if (Date.now() - t > maxAge) {
    try {
      fs.removeSync(cachePath)
    } catch {}
    return udf
  }
  return data as T
}

// type NonVoid<T> = T extends void ? never : T

interface IExtraOptions {
  useMemoryCache?: boolean // 默认不常驻内存，避免 node 脚本进程无法退出
}
type IdmpLike = (<T>(
  globalKey: IdmpGlobalKey,
  promiseFunc: IdmpPromise<T>,
  options?: IdmpOptions,
) => Promise<T>) & {
  flush: (globalKey: IdmpGlobalKey) => void
  flushAll: () => void
}
const fsIdmpWrap = (
  _idmp: IdmpLike,
  namespace: string,
  extraOptions?: IExtraOptions,
) => {
  // Per-namespace dir so flushAll() does not wipe other wrappers' caches
  // sharing the same os.tmpdir()/idmp root.
  const namespaceDir = path.resolve(cacheDir, 'v4/node', prefix, encode(namespace))

  const newIdmp = <T>(
    globalKey: string,
    promiseFunc: IdmpPromise<T>,
    options?: IdmpOptions,
  ) => {
    globalKey = `${namespace}_${globalKey}`
    const finalOptions = getOptions(options)
    const { useMemoryCache } = extraOptions || {}
    return _idmp(
      globalKey,
      async () => {
        const localData = getData(globalKey)
        if (localData !== udf) {
          // console.log('from localData')
          return localData
        }

        const memoryData = await promiseFunc()
        if (memoryData !== udf) {
          // Synchronous setData — wrap to swallow IO failures so callers
          // don't get a derailed result on disk write errors.
          try {
            setData(globalKey, memoryData, finalOptions.maxAge)
          } catch (err) {
            /* istanbul ignore next */
            console.error('[idmp/node-fs] setData failed', err)
          }
        }
        return memoryData
      },
      {
        ...options,
        maxAge: useMemoryCache ? finalOptions.maxAge : 200, // 默认不使用内存缓存，则设置一个较短的 maxAge，防止一些命令行程序无法退出，但能避免短时间重复请求消耗大量 IO
      },
    )
  }
  newIdmp.flush = (globalKey: string) => {
    const ns = `${namespace}_${globalKey}`
    _idmp.flush(ns)
    try {
      fs.removeSync(getCachePath(ns))
    } catch {}
  }
  newIdmp.flushAll = () => {
    _idmp.flushAll()
    // Only remove THIS wrapper's namespace dir — not the entire shared root.
    try {
      fs.removeSync(namespaceDir)
    } catch {}
  }
  return newIdmp
}

export default fsIdmpWrap
export { cacheDir, getCachePath, type IExtraOptions }
