import { idmp } from 'idmp'
import { Middleware } from 'swr'

export const idmpSWRMiddleware: Middleware = (useSWRNext) => {
  return (key, fetcher, config) => {
    if (!fetcher || !key) {
      return useSWRNext(key, fetcher, config)
    }

    const wrappedFetcher = async (...args: any[]) => {
      const idmpKey = typeof key === 'function' ? key() : key
      const uniqueKey = JSON.stringify(idmpKey)

      return idmp(uniqueKey, async () => await fetcher(...args))
    }

    return useSWRNext(key, wrappedFetcher, config)
  }
}

export default idmpSWRMiddleware
