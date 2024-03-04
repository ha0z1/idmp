import type { Idmp, IdmpOptions, IdmpPromise } from 'idmp'
console.log(11111111)
export const lsIdmpWrap = (_idmp: Idmp) => {
  const newIdmp = <T>(globalKey: string, promiseFunc: IdmpPromise<T>, options: IdmpOptions) => {
    return _idmp(
      globalKey,
      async () => {
        console.log(2222222222,promiseFunc)
        // let cache = await localCache.get(globalKey)
        // if (cache) return cache
        // const data = await promiseFunc()
        // localCache.set(globalKey, data, options.maxAge)
        // return data
      },
      options
    )
  }
  newIdmp.flush = (globalKey: string) => {
    _idmp.flush(globalKey)
  }
  newIdmp.flushAll = () => {
    _idmp.flushAll()
  }
  return newIdmp
}
