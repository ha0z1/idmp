import { getOptions, type Idmp, type IdmpOptions, type IdmpPromise } from 'idmp'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import serialize from 'serialize-javascript'

const deSerialize = <T = any>(data: string) =>
  new Function(`return ${data}`)() as T

const udf = undefined
const encode = encodeURIComponent
// const cacheDir = path.resolve(process.env.HOME ?? '/tmp', '.idmp')
const cacheDir = path.resolve(os.tmpdir(), 'idmp')
const getCachePath = (globalKey: string) =>
  path.resolve(cacheDir, 'v1/node', encode(globalKey))

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

const fsIdmpWrap = (_idmp: Idmp) => {
  const newIdmp = <T>(
    globalKey: string,
    promiseFunc: IdmpPromise<T>,
    options?: IdmpOptions,
  ) => {
    const finalOptions = getOptions(options)
    return _idmp(
      globalKey,
      async () => {
        const localData = await getData(globalKey)
        if (localData) {
          // console.log('from localData')
          return localData
        }

        const memoryData = await promiseFunc()
        if (memoryData) {
          // console.log('from memoryData')s a
          setData(globalKey, memoryData, finalOptions.maxAge) // no need wait
        }
        return memoryData
      },
      options,
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
export { cacheDir, getCachePath }
