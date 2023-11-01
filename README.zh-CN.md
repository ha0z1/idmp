# idmp

---

一个优雅地解决幂等(idempotent) 函数的重复和并发调用的小库，纯函数，Gzip 后不到 200b

[English](README.md) | 简体中文

demo <https://ha0z1.github.io/idmp/>

## 使用

### 基础用法

```typescript
import idmp from 'idmp'

const getInfo = async () => {
  const API = `https://haozi.me/?api/your-info`
  return await fetch(API).then((d) => d.text())
}

export const getInfoIdmp = () => idmp('/api/your-info', getInfo)

for (let i = 0; i < 10; ++i) {
  getInfoIdmp().then((d) => {
    console.log(d)
  })
}
```

### 动态参数

```typescript
const getInfoById = async (id: string) => {
  const API = `https://haozi.me/?api/your-info&id=${id}`
  return await fetch(API).then((d) => d.json())
}

export const getInfoByIdIdmp = (id: string) =>
  idmp(`/api/your-info?${id}`, () => getInfo(id))
```

Then use `getInfoIdmp` to replace the original `getInfo` function.

## Options

```typescript
declare const idmp: {
  <T, A>(
    globalKey: TGlobalKey,
    promiseFunc: Promise<T, A>,
    options?: IOptions,
  ): Promise<T>
  flush: (globalKey: TGlobalKey) => void
}

type TGlobalKey = string | number | symbol | false | null | undefined

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
   *
   * @param err any
   * @returns void
   */
  onBeforeretry?: (
    err: any,
    extra: {
      globalKey: TGlobalKey
      retryCont: number
    },
  ) => void
}
```

## flush

flush 是 `idmp` 的静态方法，会立即清除缓存，使得临近的下一次调用不使用缓存。

flush 接受一个 globalKey，没有返回值，重复调用或者 flush 一个不存在的 globalKey 不会有任何提示

```typescript

const fetchData = () => idmp('key', async () => data)

idmp.flush('key')
// will skip cache
fetchData().then(...)

```

## 在 React 中去重请求

在 react 共用请求，可以使用 swr 、 Provider 以及更为复杂的专业状态管理库来复用请求。但存在以下几种问题：

1. swr: 需要将所有的请求变更为 hooks，不能嵌套和条件分支，对于已有项目有改造成本
2. Provider 数据共享，需要一个中心化的数据管理。数据中心无法感知到哪些模块会消费数据，需要长期维护这些数据，而不敢及时删除
3. redux 等状态管理库应该管理的是状态的变化和序列，而非共享数据。`idmp` 让你更关注于局部状态

查看 demo 和[源码](./demo/)

这样当模块 A 或者模块 B 的代码删除后，是不需要维护他们的缓存的。

模块 A 和 B 有了更大的独立性，可以跨工程复用，而不必包裹在特定的 Provider 下。

## 健壮性

假设一个接口的请求失败率为 10%, 那么通过 3 次尝试后，请求仍失败的可能性将降到 0.1%

使用 `idmp` 包装的接口，内部会自动在超时或失败后进行重试，这会大大降低异常情况的出现。在每次重试前，你可以通过 `onBeforeretry` 勾子函数监听异常，便于做一些埋点统计(注意，它不会捕获最后一次错误)

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

## 优化大计算

虽然 `idmp` 的第二个参数必须是一个 Promise 函数，但由于同步函数都可以方便地包装成 Promise 对象。故 idmp 除了可以缓存网络请求外，原则上可以缓存任何函数调用。

这是一个没有经过任何优化的斐波那契数列的示例, 算到 45 项大约需要 10s:

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

## 不可变数据

由于 js 的数据可变性，缓存的数据如果被外部修改，将导致后续的数据不一致，所以 `idmp` 不允许对返回数据进行写操作。
在开发环境中，会使用 Object.freeze 递归冻结数据，但为了线上运行时性能，这个检查会被忽略。

```typescript
requestIdmp().then((data) => {
  data.hello = 'world' // not allow
  const newData = { ...data }
  newData.hello = 'new world' // allow
  //  注意：由于 js 的特性，对 newData.aaa.bbb 进行写操作，仍然会改变原始数据，这个在开发阶段也会抛错。
})
```

## 不合适场景

函数内部会进行重试操作，会缓存请求数据, 故不适合以下场景

- 非幂等的请求，如 POST/PATCH。注: HTTP 协议只是语义规范，事实上也可以把 GET 实现成非幂等，POST 实现成幂等，在使用前需要自行判断是否真幂等
- 不能缓存的请求：如每次都要交换新的 token
- 短于 16ms 的时效性数据，如获取服务器精准时间

注意：将 maxAge 设为 0 依然会在短时间内缓存数据，因为 js 的 setTimeout 是不精准的，设置成 0 依然会进行请求重试。
如果想完全不缓存结果，请把第一个参数设置成假值：`'' | false | null | undefined | 0`，这时候会完全退化成原始函数，不做失败重试。

```typescript
idmp(`xxx`, fetchData, { maxAge: 0 }) // 仍会在短时间内共享数据，仍会进行重试操作
idmp(null, fetchData) // 将无视所有配置项，与直接执行 fetchData 完全相同
```

## 注意事项

`idmp` 的核心原理是全局维护了一个共用缓存空间和状态机，由于 js 里无法快速比较两个对象实例是否全等，不得不采用了全局 KEY 的方式。
KEY 的可选值为 string | number | symbol

以及一值假值 `false | null | undefined | 0`，注意，0 是做为假值使用的，不会有任何缓存及重试效果

如果一个方法需要不同的参数进行多次调用，应当使用不同的 key，一个经典的方式是将参数 `JSON.stringify`：

```typescript
const getInfo = async (options) => {
  const { id } = options
  const API = `https://google.com/api/your-info?id=${id}`
  return await fetch(API).then((d) => d.json())
}

export const getInfoIdmp = (options) =>
  idmp(`/api/your-info${JSON.stringify(options)}`, () => getUserData(options))
```

在开发态环境下，内置了一个简单的校验，警告在不同地方使用了相同的 key，但由于只是简单的将 function toString 比较，所以并不能检测到所有问题。

如果你有更复杂的网络需求，如自动刷新、本地与远端数据竞选等，idmp 由于是纯函数，无法实现相关功能，可以尝试 [swr](https://swr.vercel.app/) 和 [swrv](https://docs-swrv.netlify.app/)
