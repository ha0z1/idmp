# idmp

[![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/ha0z1/idmp/deploy.yml)](https://github.com/ha0z1/idmp/actions)
[![npm](https://img.shields.io/npm/v/idmp.svg)](https://www.npmjs.com/package/idmp)
[![codecov](https://codecov.io/gh/ha0z1/idmp/branch/main/graph/badge.svg)](https://app.codecov.io/gh/ha0z1/idmp/blob/main/src%2Findex.ts)
[![contributors](https://img.shields.io/github/contributors/ha0z1/idmp)](https://github.com/ha0z1/idmp/graphs/contributors)
[![LICENSE](https://img.shields.io/npm/l/idmp)](https://github.com/ha0z1/idmp/blob/main/LICENSE)
[![Size](https://img.shields.io/bundlephobia/minzip/idmp.svg)](https://cdn.jsdelivr.net/npm/idmp/+esm)

一个优雅地解决幂等(idempotent) 函数的重复和并发调用的小库，纯函数，Gzip 后不到 1 KB

[English](README.md) | 简体中文

- Demo <https://idmp.haozi.me>

## Breaking Changes

- v3.x 版本后: 不再暴露内部调试对象 `export { _globalStore as g }`
- v2.x 版本后: 移除了 package.json 中的 ["type": "module"](https://github.com/ha0z1/idmp/pull/58/files#diff-74c8d3852e67511dbbe14b1feb1d05341e0eb9a2eb6d245dfde802817f229782) 字段

## 使用

### 基础用法

```typescript
import idmp from 'idmp'

const getInfo = async () => {
  const API = `https://haozi.me/?api/your-info`
  return await fetch(API).then((d) => d.text())
}

// 只有这一行代码改动
export const getInfoIdmp = () => idmp('/api/your-info', getInfo)

for (let i = 0; i < 10; ++i) {
  getInfoIdmp().then((d) => {
    console.log(d)
  })
}
```

查看浏览器的网络控制台，会发现只有 1 个网络请求，但会正确触发 10 次回调。

### 高级使用

```typescript
const getInfoById = async (id: string) => {
  const API = `https://haozi.me/?api/your-info&id=${id}`
  return await fetch(API).then((d) => d.json())
}

// 处理有入参的场景
export const getInfoByIdIdmp = (id: string) =>
  idmp(`/api/your-info?${id}`, () => getInfoById(id))

// 或者更通用的类型体操写法，用于复杂的入参，idmp 会自动推导返回值类型，与原函数保持一致
export const getInfoByIdIdmp = (...args: Parameters<typeof getInfoById>) =>
  idmp(`/api/your-info?${JSON.stringify(args)}`, () => getInfoById(...args))

// 增加更多配置项
export const getInfoByIdIdmp = (id: string) =>
  idmp(`/api/your-info?${id}`, () => getInfoById(id), {
    maxAge: 86400 * 1000,
  })
```

然后用 `getInfoByIdIdmp` 替换 `getInfoById` 方法。

## 插件

`idmp` 有一个强大的插件系统。 以下是官方维护的插件列表，您也可以参考源码创建自己的插件：

插件可以以非侵入性方式扩展 `idmp` 的核心功能，类似于数学函数 $g(f)(x)$。 这种优雅的设计为插件系统提供了极大的灵活性和可扩展性。

- [使用 node-fs 进行数据持久化](plugins/node-fs/README.md)（将数据持久化到文件系统）
- [使用 localStorage 进行数据持久化](https://github.com/ha0z1/idmp/blob/main/plugins/browser-storage/README.md)
- [使用 sessionStorage 进行数据持久化](https://github.com/ha0z1/idmp/blob/main/plugins/browser-storage/README.md)
- 使用 indexedDB 进行数据持久化 // TODO
- 使用 chrome-extension 实现数据持久化 // TODO

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

| Property        | Type       | Default | Description                                                                                                                                                                                                           |
| --------------- | ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxRetry`      | `number`   | `30`    | Maximum number of retry attempts.                                                                                                                                                                                     |
| `minRetryDelay` | `number`   | `50`    | Minimum retry interval in milliseconds. The default value is 50 ms.                                                                                                                                                   |
| `maxAge`        | `number`   | `3000`  | Maximum age in milliseconds. The maximum value is 604800000ms (7 days).                                                                                                                                               |
| `onBeforeRetry` | `function` | -       | Function to be executed before a retry attempt. Takes two parameters: `err` (any type) and `extra` (an object with properties `globalKey` of type `IdmpGlobalKey` and `retryCount` of type `number`). Returns `void`. |

## flush

`flush` 是 `idmp` 的静态方法，会立即清除缓存，使得临近的下一次调用不使用缓存。

`flush` 接受一个 `globalKey`，没有返回值，重复调用或者 `flush` 一个不存在的 globalKey 不会有任何提示

```typescript
const fetchData = () => idmp('key', async () => data)

idmp.flush('key')
fetchData().then(...) // will skip cache

```

## flushAll

`flushAll` 是 `idmp` 的静态方法，会立即清除所有缓存，使得临近的下一次所有调用都不使用缓存。

`flushAll` 和 `flush` 一样是幂等函数，无入参和返回值，多次执行不会有任何提示。

```typescript

const fetchData1 = () => idmp('key1', async () => data1)
const fetchData2 = () => idmp('key2', async () => data2)

idmp.flushAll()

fetchData1().then(...) // will skip cache
fetchData2().then(...) // will skip cache

```

通过 flush 或者 flushAll 可以做一些工作，比如点击了保存按钮后自动刷新列表，这时候应该强行从服务器拿最新的数据渲染。

## 在 React 中去重请求

在 React 共用请求，可以使用 SWR 、 Provider 以及更为复杂的专业状态管理库来复用数据。但存在以下几种问题：

1. SWR: 需要将所有的请求变更为 hooks，不能嵌套和条件分支，对于已有项目有改造成本，下文还会提到更复杂的场景。
2. Provider 数据共享: 需要一个中心化的数据管理。数据中心无法感知哪些模块会消费哪些数据，需要长期维护这些数据，而不敢及时删除
3. Redux 等状态管理库:应该专注的是状态的变化和时序，而非共享数据。`idmp` 让你更关注于局部状态

查看 [demo](https://idmp.haozi.me) 和[源码](https://github.com/ha0z1/idmp/tree/main/demo)

这样当模块 A 或者模块 B 的代码删除后，是不需要维护他们的缓存的。

模块 A 和 B 有了更大的独立性，可以跨工程复用，而不必包裹在特定的 Provider 下。

### 在 Hooks 中请求数据的局限性

```typescript
import useSWR from 'swr'

function Profile() {
  const { data, error, isLoading } = useSWR('/api/user', fetcher)

  if (error) return <div>failed to load</div>
  if (isLoading) return <div>loading...</div>
  return <div>hello {data.name}!</div>
}
```

SWR 的官网示例很优雅，然而实际中一个视图展示很可能并非只来自一个数据源。由于 Hooks [无法嵌套和条件分支](https://legacy.reactjs.org/docs/hooks-rules.html)。假设有两个接口，B 依赖 A 的结果为入参，代码将迅速劣化成下面形式：

```typescript
...
const { data: dataA } = useSWR('/api/a', fetchA)
const { data: dataB } = useSWR(dataA ? `/api/b${JSON.stringify(dataA)}` : null, () => dataA ? fetchB(dataA): null)
...
```

这还没有处理异常状况，还只是 2 个接口， 如果有 n 个相关联接口，其代码复杂度是以 $O(2^n)$速度劣化的

$$
C_{n}^{0} + C_{n}^{1} + C_{n}^{2} + ... + C_{n}^{n} = 2^n
$$

这里有几种优化形式：

1. 放弃 SWR, 改用在 useEffect 中请求，这样 SWR 带来的收益就没有了，并且即使 useEffect 的第二个参数传空数组，依然可能出现重复请求的问题，详见https://github.com/ha0z1/idmp/blob/main/demo/Item.tsx#L10
2. 封装 fetchAB 方法，串行请求后一次性返回，在 Hooks 里只调用一个 fetchAB。这里将会造成只依赖 dataA 的视图要等待串行完成后才能展示。另外，一般 dataA 数据很可能是一些公用数据，可能还要封装 fetchAC、fetchABC 等场景，这里面将造成 dataA 的数据请求发生多次

由于 `idmp` 是纯函数，可以在 Hooks 之外调用，可以很好地配合 SWR 完成这样的工作。我们无脑封装两个接口 fetchAIdmp 和 fetchBIdmp:

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

然后在 Hooks 里用 SWR 同步调用这两个“无依赖”的 fetcher 就好了

```typescript
...
const { data: dataA } = useSWR('/api/a', fetchAIdmp)
const { data: dataB } = useSWR('/api/b', fetchBIdmp)
...
```

由于消解了相互间的排列组合，复杂度降低到 $O(n)$

$$
C_{n}^{0} + C_{n}^{0} + C_{n}^{0} + ... + C_{n}^{0} = n
$$

当哪天页面不需要直接消费 dataA 的数据时，直接删除请求 dataA 的代码就好了，没有任何心智负担。

## 鲁棒性

假设一个接口的请求失败率为 10%, 那么通过 3 次尝试后，请求仍失败的可能性将降到 0.1%

使用 `idmp` 包装的接口，内部会自动在超时或失败后进行重试，这会大大降低异常情况的出现。在每次重试前，你可以通过 `onBeforeRetry` 勾子函数监听异常，便于做一些埋点统计(注意，它不会捕获最后一次错误)

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

idmp 内部实现了类似 [指数退避](https://en.m.wikipedia.org/wiki/Exponential_backoff)的算法，会动态改变重试时间，避免对服务器造成 DDoS。

## 优化大计算

虽然 `idmp` 的第二个参数必须是一个 Promise 函数，但由于同步函数都可以方便地包装成 Promise 对象。故 `idmp` 除了可以缓存网络请求外，原则上可以缓存任何函数调用。

这是一个没有经过任何优化的斐波那契数列的示例, 算到 45 项大约需要 10s:

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

缓存后，调用 100 次，实际只计算了 1 次，其他 99 次都是 $O(1)$ 性能的查表。

## 不可变数据

由于 js 的数据可变性，缓存的数据如果被外部修改，将导致后续的数据不一致，所以 `idmp` 不允许对返回数据进行写操作。
在开发环境中，会使用 Object.freeze 递归冻结数据，但为了线上运行时性能，这个检查会被忽略。

这应该是最精巧地解决方案了，避免了运行时对数据的深拷贝，也使得 `idmp` 不光能缓存 JSON 数据，也能缓存更复杂的数据结构。

```typescript
requestIdmp().then((data) => {
  data.hello = 'world' // Not allow
  const newData = { ...data }
  newData.hello = 'new world' // Allow
  // 注意：由于 js 的特性，对 newData.aaa.bbb 进行写操作，
  // 仍然会改变原始数据，这个在开发阶段也会抛错。
})
```

## 配置项不可变

下面这种写法是不允许的：

```typescript
const config = {
  maxAge: 5000,
}
const getInfoIdmp = () => idmp('/api/your-info', getInfo, config)

getInfoIdmp().then(() => {
  config.maxAge = 0
})
```

因为这会造成多次调用后，行为可能被外部修改，造成逻辑不一致。这个也会在开发环境下进行自动检测。如果希望执行某些操作后刷新缓存，应该使用 `idmp.flush` 或 `idmp.flushAll` 方法

## 不合适场景

函数内部会进行重试操作、会缓存请求数据, 故不适合以下场景:

- 非幂等的请求：如 POST/PATCH。注: HTTP 协议只是语义规范，事实上也可以把 GET 实现成非幂等，POST 实现成幂等，在使用前需要自行判断是否真幂等
- 不能缓存的请求：如每次都要交换新的 token、获取随机种子
- 短于 16ms 的时效性数据，如获取服务器精准时间

注意：将 maxAge 设为 0 依然会在短时间内缓存数据，因为内部使用了 `setTimeout(..., maxAge)`清理缓存，而 js 的 setTimeout 是不精准的，且它是一个宏任务慢于微任务。

另外，设置成 0 依然会进行请求重试，可以用它来实现一些对接口健壮性要求高、实效性不严苛的场景。

如果想完全不缓存结果，请把第一个参数设置成假值：`'' | false | null | undefined | 0`，这时候会完全退化成原始函数，不做失败重试。

```typescript
idmp(`xxx`, fetchData, { maxAge: 0 }) // 仍会在短时间内共享数据，仍会进行重试操作
idmp(null, fetchData) // 将无视所有配置项，与直接执行 fetchData 完全相同
```

## 实现原理

`idmp` 的核心原理是共用了一块内存地址，使用唯一标识符确定是同一函数的重复调用。
每个 Promise 的 resolve 和 reject 会被记录下来，内部维护了一个状态机，在 fulfilled 或 rejected 时完成回调。

另外，代码在开发环境`(process.env.NODE_ENV !== "production")`中，使用了非常 geek 的方式判断有没有全局重复使用了相同的 key 值，有兴趣的可以自行阅读源码。

## 注意事项

`idmp` 的核心原理是全局维护了一个共用缓存空间和状态机，由于 js 里无法快速比较两个对象实例是否全等，不得不采用了全局 KEY 的方式，所以一定要有一个全局唯一 KEY。

KEY 的可选值类型为 `string | number | symbol`、以及一值假值 `false | null | undefined | '' | 0`，注意，`0` 和 空字符串`''` 是作为假值使用的，不会有任何缓存及重试效果。

如果一个方法需要不同的参数进行多次调用，应当使用不同的 KEY，一个经典的方式是将参数 `JSON.stringify`：

```typescript
const getInfo = async (options) => {
  const { id } = options
  const API = `https://google.com/api/your-info?id=${id}`
  return await fetch(API).then((d) => d.json())
}

export const getInfoIdmp = (options) =>
  idmp(`/api/your-info${JSON.stringify(options)}`, () => getUserData(options))
```

在开发态环境下，内置了一个检查，警告在不同地方使用了相同的 KEY。如果不同的 Promise 分配了相同的 KEY，可能造成不符合预期的结果。

如果你有更复杂的网络需求，如自动刷新、本地与远端数据竞选等，`idmp` 由于是纯函数，无法实现相关功能，可以尝试 [SWR](https://swr.vercel.app/) 和 [swrv](https://docs-swrv.netlify.app/)
