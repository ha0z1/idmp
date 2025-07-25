# idmp/redis

## Usage

```typescript
import idmp from 'idmp'
import redisWrap from 'idmp/redis'

// namespace: Recommended to a UUID in the global namespace to avoid conflicts, one per project is enough.
const redisIdmp = redisWrap(idmp, namespace, {
  url: 'redis://localhost:6379'
})

await redisIdmp(
  'redisCache',
  async () => {
    return await getData(...)
  },
  { maxAge: 60 * 1000 }
)

```

## Options

```typescript
declare const redisIdmpWrap: (
  _idmp: Idmp,
  namespace: string,
  options: RedisIdmpOptions,
) => {
  <T>(
    globalKey: string,
    promiseFunc: IdmpPromise<T>,
    options?: IdmpOptions,
  ): Promise<any>
  flush(globalKey: string): Promise<void>
  flushAll(): Promise<void>
  quit(): Promise<void>
}
```

## Notice

- Data persistence only supports string type `globalKey` and data structures that can be serialized by [serialize-javascript](https://www.npmjs.com/package/serialize-javascript)
- If return value is `undefined` it will not be cached, you must return `null`
