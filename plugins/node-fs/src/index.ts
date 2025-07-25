import fs from 'fs-extra'
import { getOptions, type Idmp, type IdmpOptions, type IdmpPromise } from 'idmp'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import serialize from 'serialize-javascript'
import { fileURLToPath } from 'url'

// 当前文件的完整路径（绝对路径）
const __filename = fileURLToPath(import.meta.url)
const md5 = (data: string) => createHash('md5').update(data).digest('hex')

const deSerialize = <T = any>(data: string) =>
  new Function(`return ${data}`)() as T

const prefix = md5(__filename)

const udf = undefined
const encode = encodeURIComponent
// const cacheDir = path.resolve(process.env.HOME ?? '/tmp', '.idmp')
const cacheDir = path.resolve(os.tmpdir(), 'idmp')
const getCachePath = (globalKey: string) =>
  path.resolve(cacheDir, 'v1/node', prefix, encode(globalKey))

const setData = async <T = any>(key: string, data: T, maxAge: number) => {
  if (!key) return
  const cachePath = getCachePath(key)

  fs.ensureFileSync(cachePath)
  fs.outputFileSync(
    cachePath,
    serialize({
      t: Date.now(),
      a: maxAge,
      d: data,
    }),
  )
}

const getData = async <T = any>(key: string) => {
  if (!key) return udf
  const cachePath = getCachePath(key)

  let localData
  try {
    localData = deSerialize(fs.readFileSync(cachePath, 'utf-8'))
  } catch {}

  if (localData === udf) return udf

  const { t, a: maxAge, d: data } = localData

  if (Date.now() - t > maxAge) {
    fs.removeSync(cachePath)
    return udf
  }
  return data as T
}

// type NonVoid<T> = T extends void ? never : T

interface IExtraOptions {
  useMemoryCache?: boolean // 默认不常驻内存，避免 node 脚本进程无法退出
}
const fsIdmpWrap = (
  _idmp: Idmp,
  namespace: string,
  extraOptions?: IExtraOptions,
) => {
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
        const localData = await getData(globalKey)
        if (localData !== udf) {
          // console.log('from localData')
          return localData
        }

        const memoryData = await promiseFunc()
        if (memoryData !== udf) {
          // console.log('from memoryData')s a
          setData(globalKey, memoryData, finalOptions.maxAge) // no need wait
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
    _idmp.flush(globalKey)
    fs.removeSync(getCachePath(globalKey))
  }
  newIdmp.flushAll = () => {
    _idmp.flushAll()
    fs.removeSync(cacheDir)
  }
  return newIdmp
}

export default fsIdmpWrap
export { cacheDir, getCachePath, type IExtraOptions }
