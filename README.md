# idmp

---

An elegant method for a cached idempotent function, pure function. Less than 200B(Gzip)

English | [简体中文](README.zh-CN.md)

demo <https://ha0z1.github.io/idmp/>

## Usage

### Base

```typescript
import idmp from 'idmp'

const getInfo = async () => {
  const API = `https://google.com/api/your-info`
  return await fetch(API).then((d) => d.json())
}

export const getInfoIdmp = () => idmp('/api/your-info', getInfo)
```

### Dynamic parameter

```typescript
import idmp from 'idmp'

const getInfoById = async (id: string) => {
  const API = `https://google.com/api/your-info?id=${id}`
  return await fetch(API).then((d) => d.json())
}

export const getInfoByIdIdmp = (id: string) =>
  idmp(`/api/your-info?${id}`, () => getInfo(id))
```

Then use `getInfoIdmp` to replace the original `getInfo` function.

## Options

```typescript
declare const idmp: (
  globalKey: string | number | symbol | false | null | undefined,
  promiseFunc: Promise<T>,
  options?: IOptions,
) => Promise<T>

interface IOptions {
  /**
   * @default: 30 times
   */
  maxRetry?: number

  /**
   * unit: ms
   * @default: 3000ms
   * @max 604800000ms (7days)
   */
  maxAge?: number

  /**
   * onBeforeretry?: (err: any) => void
   */
  onBeforeretry?: (err: any, retryCount: number) => void
}
```

## Deduplicating Requests in React

In React, requests can be shared using swr, Provider, and more complex state management libraries. But there are some problems:

1. swr: Need to convert all requests to hooks, which has a refactoring cost for existing projects.

2. Provider data sharing requires centralized data management. The data center cannot perceive which modules will consume the data, and needs to maintain the data for a long time instead of deleting it in time.

3. Redux and other state management libraries should manage state changes and sequences, not shared data. idmp allows you to focus more on local state.

See demo and [source code](./demo/).

This way, when module A or module B code is deleted, their caches do not need to be maintained.

Modules A and B have greater independence and can be reused across projects without being wrapped in a specific Provider.

## Robustness

Assume the failure rate of an interface request is 10%. Then after 3 retries, the chance of the request still failing will drop to 0.1%.

Using idmp to wrap the interface, it will automatically retry on timeouts or failures internally, which will greatly reduce the occurrence of abnormal situations. Before each retry, you can listen for exceptions through the `onBeforeretry` hook function for some statistical burying (note that it will not capture the last error)

```typescript
const getUserData = idmp(
  'using a deduplicated string as a key',
  async () => {
    await fetch(xxx)
  },
  {
    onBeforeretry: (rejectReason) => {
      log(rejectReason)
    },
    maxRetry: 30, // default
  },
)
```

## Optimizing Big Calculations

Although the second parameter of `idmp` must be a Promise function, since synchronous functions can be easily wrapped into Promise objects. In principle, idmp can cache any function call in addition to network requests.

This is an unoptimized Fibonacci sequence example that takes about 10s to calculate to item 45:

```typescript
const fib = (n) => {
  if (n <= 2) {
    return 1
  }
  return fib(n - 2) + fib(n - 1)
}

const fibIdmp = (n) => idmp(`fib${n}`, async () => fib(n), { maxAge: Infinity })

for (let i = 0; i < 100; i++) {
  fibIdmp(40).then(console.log)
}
```

## Immutable Data

Due to the mutability of JS data, cached data that is externally modified will lead to inconsistent subsequent data. So `idmp` does not allow write operations on the returned data.

In the development environment, Object.freeze will be used to recursively freeze the data, but this check will be ignored for production runtime performance.

```typescript
requestIdmp().then((data) => {
  data.hello = 'world' // not allow

  const newData = { ...data }
  newData.hello = 'new world' // allow

  // Note: Due to JS characteristics, writing to newData.aaa.bbb will still change the original data, which will also throw an error during development.
})
```

## Unsuitable Scenarios

The function retries internally, caches request data, so it is not suitable for the following scenarios:

- Non-idempotent requests like POST/PATCH. Note: The HTTP protocol is just a semantic specification. In fact, GET can also be implemented as non-idempotent, and POST can be implemented as idempotent. Need to judge by yourself whether it is really idempotent before use.

- Requests that cannot be cached: such as exchanging a new token each time.

Note: Setting maxAge to 0 will still cache data for a short time because JS setTimeout is inaccurate. Setting to 0 will still retry requests.

If you want to completely not cache the result, set the first parameter to a falsy value: `'' | false | null | undefined | 0`. This will completely degrade to the original function without retry on failure.

```typescript
idmp(`xxx`, fetchData, { maxAge: 0 }) // Still share data for a short time, still retry

idmp(null, fetchData) // Will ignore all options, identical to executing fetchData directly
```

Here are some additional notes on using `idmp`:

## Notes

The core principle of `idmp` is that it globally maintains a shared cache space and state machine. Since it's hard to quickly compare if two object instances are fully equal in JS, it has to use a global KEY approach.

The KEY can be `string | number | symbol`

As well as a falsy value `false | null | undefined | 0`. Note 0 is used as a falsy value and will not have any caching or retry effects.

If a method needs to be called multiple times with different parameters, different keys should be used. A common way is to `JSON.stringify` the parameters:

```typescript
const getInfo = async (options) => {
  const { id } = options
  const API = `https://google.com/api/your-info?id=${id}`
  return await fetch(API).then((d) => d.json())
}

export const getInfoIdmp = (options) =>
  idmp(`/api/your-info${JSON.stringify(options)}`, () => getUserData(options))
```

In development mode, there is a simple validation built in that warns when the same key is used in different places. But since it just compares function toString, it can't detect all problems.

If you have more complex networking needs such as automatic refreshing, competing local and remote data, etc., idmp cannot implement related functionalities since it is a pure function. You can try swr and swrv which are designed for these use cases.
