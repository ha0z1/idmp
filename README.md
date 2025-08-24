# idmp

[![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/ha0z1/idmp/deploy.yml)](https://github.com/ha0z1/idmp/actions)
[![npm](https://img.shields.io/npm/v/idmp.svg)](https://www.npmjs.com/package/idmp)
[![codecov](https://codecov.io/gh/ha0z1/idmp/branch/main/graph/badge.svg)](https://app.codecov.io/gh/ha0z1/idmp/blob/main/src%2Findex.ts)
[![contributors](https://img.shields.io/github/contributors/ha0z1/idmp)](https://github.com/ha0z1/idmp/graphs/contributors)
[![LICENSE](https://img.shields.io/npm/l/idmp)](https://github.com/ha0z1/idmp/blob/main/LICENSE)
[![Size](https://img.shields.io/bundlejs/size/idmp.svg)](https://cdn.jsdelivr.net/npm/idmp/+esm)

An elegant, lightweight (~1KB gzipped) utility to deduplicate concurrent calls to the same async function, providing idempotent behavior for network and async requests.

English | [简体中文](README.zh-CN.md)

- Demo <https://idmp.js.org/>

## Breaking Changes

> The following breaking changes are introduced in recent major versions. Please review if you're upgrading from older versions.

- **v3.x**: [not export `{ _globalStore as g }`](https://github.com/ha0z1/idmp/commit/78042ebfbfa9473914f7ea261f1d85d7148cd4f0#diff-a2a171449d862fe29692ce031981047d7ab755ae7f84c707aef80701b3ea0c80L455) any more
- **v2.x**:: remove the ["type": "module"](https://github.com/ha0z1/idmp/pull/58/files#diff-74c8d3852e67511dbbe14b1feb1d05341e0eb9a2eb6d245dfde802817f229782) field in Package.json

## Usage

### Basic Usage

```typescript
import idmp from 'idmp'

const getInfo = async () => {
  const API = `https://idmp.js.org/api?/your-info`
  return await fetch(API).then((d) => d.text())
}

// Only one line need to change
export const getInfoIdmp = () => idmp('/api/your-info', getInfo)

for (let i = 0; i < 10; ++i) {
  getInfoIdmp().then((d) => {
    console.log(d)
  })
}
```

Check the network console, there will be only 1 network request, but 10 callbacks will be triggered correctly.

### Advanced Usage

```typescript
const getInfoById = async (id: string) => {
  const API = `https://idmp.js.org/api?/your-info&id=${id}`
  return await fetch(API).then((d) => d.json())
}

// Handle params
export const getInfoByIdIdmp = (id: string) =>
  idmp(`/api/your-info?${id}`, () => getInfoById(id))

// Or a more generic type juggling, for complex params, idmp will infer the return type automatically, keep it consistent with the original function
export const getInfoByIdIdmp = (...args: Parameters<typeof getInfoById>) =>
  idmp(`/api/your-info?${JSON.stringify(args)}`, () => getInfoById(...args))

// More options
export const getInfoByIdIdmp = (id: string) =>
  idmp(`/api/your-info?${id}`, () => getInfoById(id), {
    maxAge: 86400 * 1000,
  })
```

Then replace `getInfoByIdIdmp` with `getInfoById`.

## Plugins

`idmp` has a powerful plugin system. The following plugins are officially maintained, and you can also reference the source code to create your own plugins:

The analogy to higher-order functions elegantly conveys that plugins can extend idmp's core functionality in a non-invasive way, similar to mathematical functions $g(f)(x)$. This provides great flexibility and extensibility to the plugin system.

- [Data Persistence with node-fs](plugins/node-fs/README.md) (Persist data to the file system)
- [Data Persistence with localStorage](https://github.com/ha0z1/idmp/blob/main/plugins/browser-storage/README.md)
- [Data Persistence with sessionStorage](https://github.com/ha0z1/idmp/blob/main/plugins/browser-storage/README.md)
- [Data Persistence with redis](https://github.com/ha0z1/idmp/blob/main/plugins/redis/README.md)
- Data Persistence with indexedDB // TODO
- Data Persistence with chrome-extension // TODO

## Options

```typescript
declare const idmp: {
  <T>(
    globalKey: IdmpGlobalKey,
    promiseFunc: IdmpPromise<T>,
    options?: IdmpOptions,
  ): Promise<T>
  flush: (globalKey: IdmpGlobalKey) => void
  flushAll: () => void
}

type IdmpPromise<T> = () => Promise<T>
type IdmpGlobalKey = string | number | symbol | false | null | undefined
```

IdmpOptions:

| Property        | Type       | Default    | Description                                                                                                                                                                                                           |
| --------------- | ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxRetry`      | `number`   | `30`       | Maximum number of retry attempts.                                                                                                                                                                                     |
| `minRetryDelay` | `number`   | `50`(ms)   | Minimum retry interval in milliseconds. The default value is 50 ms.                                                                                                                                                   |
| `maxAge`        | `number`   | `3000`(ms) | Maximum age in milliseconds. The maximum value is 604800000 ms (7 days).                                                                                                                                              |
| `onBeforeRetry` | `function` | -          | Function to be executed before a retry attempt. Takes two parameters: `err` (any type) and `extra` (an object with properties `globalKey` of type `IdmpGlobalKey` and `retryCount` of type `number`). Returns `void`. |

## flush

`flush` is a static method of `idmp` that will immediately clear the cache so that the next call shortly after will not use the cache.

`flush` takes a `globalKey` as parameter, has no return value. Calling it repeatedly or with a non-existing globalKey will not have any prompts.

```typescript

const fetchData = () => idmp('key', async () => data)

idmp.flush('key')
fetchData().then(...) // will skip cache

```

## flushAll

`flushAll` is a static method of `idmp` that will immediately clear all caches so that the next calls shortly after will not use caches.

`flushAll` is idempotent like `flush`, no params or return value. Calling it multiple times will not have any prompts.

```typescript

const fetchData1 = () => idmp('key1', async () => data1)
const fetchData2 = () => idmp('key2', async () => data2)

idmp.flushAll()

fetchData1().then(...) // will skip cache
fetchData2().then(...) // will skip cache

```

You can do some works with flush or flushAll, for example, auto refresh list after clicking the save button, should fetch the latest data from server forcibly.

## Disable debug logs

In development mode, debug information is displayed by default. Most modern frameworks and build tools—such as React, Vue, Webpack, and Vite etc. will automatically set process.env.NODE_ENV to production in production builds.

In production, idmp prunes debug logic to reduce bundle size and improve performance.

If you prefer not to see debug information even in development, you can disable it manually by setting the following in the browser console:
`localStorage.idmp_debug = false`.

## Deduplication in React

In React, you can share requests using SWR, Provider and more complex state management libraries. But there are some problems:

1. **SWR**: Requires requests to be encapsulated in hooks, which may limit conditional or nested usage patterns. Migrating legacy codebases can be non-trivial in some cases.
2. **Provider**: Needs centralized data management. The data center can't perceive which modules will consume the data, need to maintain the data for a long time, and dare not delete it in time
3. **Redux**: Should focus on state changes and sequences, not data sharing. `idmp` lets you focus more on local state

See [demo](https://idmp.js.org/) and [source code](https://github.com/ha0z1/idmp/tree/main/demo)

So when module A or module B's code is deleted, there is no need to maintain their cache.

Module A and B have greater independence, can be reused across projects, without having to be wrapped in a specific Provider.

### Limitations of requesting data in Hooks

```typescript
import useSWR from 'swr'

function Profile() {
  const { data, error, isLoading } = useSWR('/api/user', fetcher)

  if (error) return <div>failed to load</div>
  if (isLoading) return <div>loading...</div>
  return <div>hello {data.name}!</div>
}
```

The example on SWR's homepage is very elegant, but in practice a view is likely to come from more than one data source. Because Hooks [can't be nested and have conditional branches](https://legacy.reactjs.org/docs/hooks-rules.html). Assume there are two interfaces, B depends on the result of A as params, the code will quickly deteriorate to the following form:

```typescript
...
const { data: dataA } = useSWR('/api/a', fetchA)
const { data: dataB } = useSWR(dataA ? `/api/b${JSON.stringify(dataA)}` : null, () => dataA ? fetchB(dataA): null)
...
```

This doesn't handle exception cases yet, and there are only 2 interfaces. If there are n related interfaces, the code complexity deteriorates at a rate of $O(2^n)$

$$
C_{n}^{0} + C_{n}^{1} + C_{n}^{2} + ... + C_{n}^{n} = 2^n
$$

There are several optimization forms:

1. Abandon SWR and use request in useEffect, so the benefits of SWR are lost, and there may still be duplicate requests issues even if passing empty array as the second param of useEffect, see https://github.com/ha0z1/idmp/blob/main/demo/Item.tsx#L10
2. Wrap fetchAB method to request sequentially and return at one time. In Hooks just call the single fetchAB. Here the views that only rely on dataA have to wait for completion before rendering. In addition, dataA is often some common data that may need to handle scenarios like fetchAC, fetchABC, which will cause multiple requests for dataA

Since `idmp` is a pure function, it can be called outside Hooks and works well with SWR. We can naively wrap the two interfaces fetchAIdmp and fetchBIdmp:

```typescript
const fetchAIdmp = () => idmp('/api/a', fetchA)

const fetchBIdmp = async () => {
  const dataA = await fetchAIdmp()
  const dataB = await idmp(`/api/b+${JSON.stringify(dataA)}`, () =>
    fetchB(dataA),
  )
  return dataB
}
```

Then use SWR to synchronously call these two "no-dependent" fetchers in Hooks:

```typescript
...
const { data: dataA } = useSWR('/api/a', fetchAIdmp)
const { data: dataB } = useSWR('/api/b', fetchBIdmp)
...
```

By dissolving the permutations and combinations between them, the complexity is reduced to $O(n)$

$$
C_{n}^{0} + C_{n}^{0} + C_{n}^{0} + ... + C_{n}^{0} = n
$$

When the page no longer needs to directly consume dataA someday, just delete the code requesting dataA, no mental burden.

## Robustness

Assuming an interface has a 10% failure rate, the probability of still failing after 3 retries will drop to 0.1%

Using `idmp` to wrap the interface, it will automatically retry on timeouts or failures, which greatly reduces the occurrence of abnormal situations. Before each retry, you can monitor exceptions through the `onBeforeRetry` hook function (note that it will not capture the last error)

`idmp` internally implements an algorithm similar to [Exponential backoff](https://en.m.wikipedia.org/wiki/Exponential_backoff), which dynamically changes the retry time to avoid DDoS to the server.

```typescript
const getUserData = idmp(
  'using a deduplicated string as a key',
  async () => {
    await fetch(xxx)
  },
  {
    onBeforeRetry: (rejectReason) => {
      log(rejectReason)
    },
    maxRetry: 30, // default
  },
)
```

## Optimize Big Calculation

Although the second parameter of `idmp` must be a Promise function, since synchronous functions can be easily wrapped into Promise objects. In principle, `idmp` can cache any function calls in addition to network requests.

This is an unoptimized Fibonacci sequence example, calculating to item 45 takes about 10s:

```typescript
const fib = (n) => {
  if (n <= 2) return 1

  return fib(n - 2) + fib(n - 1)
}

const fibIdmp = (n) => idmp(`fib${n}`, async () => fib(n), { maxAge: Infinity })

for (let i = 0; i < 100; i++) {
  fibIdmp(40).then(console.log)
}
```

After caching, calling 100 times only calculated 1 time, the other 99 times are $O(1)$ lookup performance.

## Immutable Data

Due to the mutability of js data, if the cached data is modified externally, it will lead to inconsistent data afterwards, so `idmp` does not allow write operations on the return data.

In the development environment, Object.freeze will be used to recursively freeze the data, but for runtime performance, this check will be ignored.

This should be the most elegant solution, avoiding runtime deep cloning of data, so `idmp` can not only cache JSON data, but also more complex data structures.

```typescript
requestIdmp().then((data) => {
  data.hello = 'world' // Not allow
  const newData = { ...data }
  newData.hello = 'new world' // Allow
  // Note: Due to js syntax, writing newData.aaa.bbb
  // will still change the original data, which will also throw error in dev
})
```

## Immutable Options

The following usage is not allowed:

```typescript
const config = {
  maxAge: 5000,
}
const getInfoIdmp = () => idmp('/api/your-info', getInfo, config)

getInfoIdmp().then(() => {
  config.maxAge = 0
})
```

Because this will cause inconsistent behavior after multiple calls when the behavior may be modified externally. This will also be automatically detected in the development environment. If you want to refresh the cache after performing some operations, you should use the `idmp.flush` or `idmp.flushAll` methods

## Not Suitable Scenarios

The function will retry and cache request data internally, so it is not suitable for the following scenarios:

- Non-idempotent requests: like POST/PATCH. Note: HTTP protocol is just semantics, GET can actually be implemented as non-idempotent, POST can be idempotent, need to judge by yourself whether it is really idempotent before use
- Requests that cannot be cached: such as exchanging new tokens, getting random seeds every time
- Timeliness data shorter than 16ms, such as getting accurate server time

Note: Setting maxAge to 0 will still cache data for a short time, because internally it uses `setTimeout(..., maxAge)` to clean up the cache, and js's setTimeout is inaccurate and it is a macro task slower than micro task.

In addition, setting to 0 still performs request retries, can be used to implement some scenarios with high robustness requirements for interfaces and not strict timeliness.

If you want to completely not cache the result, please set the first parameter to a falsy value: `'' | false | null | undefined | 0`, it will completely degrade to the original function, without failure retries.

```typescript
idmp(`xxx`, fetchData, { maxAge: 0 }) // Still share data for a short time, still retry
idmp(null, fetchData) // Will ignore all options, same as executing fetchData directly
```

## Implementation

The core principle of `idmp` is sharing a memory address, using a unique identifier to determine if it is a duplicate call of the same function.

The resolve and reject of each Promise will be recorded, maintaining a state machine internally, and completing the callback when fulfilled or rejected.

In addition, in the development environment `(process.env.NODE_ENV !== "production")`, a very geek way is used to determine if the same key value is globally reused, interested can read the source code.

## Notes

The core principle of `idmp` is maintaining a globally shared cache space and state machine, since objects cannot be quickly compared for equality in js, we have to use global KEYs, so a globally unique KEY is required.

The optional value types of KEY are `string | number | symbol`, and a falsy value `false | null | undefined | '' | 0`, note that `0` and empty string `''` are used as falsy values, there will be no caching or retry effects.

If a method needs to be called multiple times with different parameters, different KEYs should be used, a classic way is to `JSON.stringify` the params:

```typescript
const getInfo = async (options) => {
  const { id } = options
  const API = `https://google.com/api/your-info?id=${id}`
  return await fetch(API).then((d) => d.json())
}

export const getInfoIdmp = (options) =>
  idmp(`/api/your-info${JSON.stringify(options)}`, () => getUserData(options))
```

In the dev environment, there is a built-in check warning if the same KEY is used in different places. Assigning the same KEY to different Promises may lead to unexpected results.

If you have more complex network requirements like auto refresh, local and remote data contention, etc, `idmp` cannot implement related functions as pure function, you can try with [SWR](https://swr.vercel.app/) and [swrv](https://docs-swrv.netlify.app/).
