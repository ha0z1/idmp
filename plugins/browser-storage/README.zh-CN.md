# idmp/browser-storage

[English](README.md) | 简体中文

## Usage

```typescript
import idmp from 'idmp'
import storageWrap, { getCacheKey } from 'idmp/browser-storage'

const getInfo = async () => {
  const API = `https://haozi.me/?api/your-info`
  return await fetch(API).then((d) => d.text())
}

const lsIdmp = storageWrap(idmp, 'localStorage') // 缺省不传是 sessionStorage

// 只用改这一行
export const getInfoWithLsIdmp = () =>
  lsIdmp('/api/your-info', getInfo, {
    maxAge: 5 * 1000,
  })

for (let i = 0; i < 10; ++i) {
  getInfoWithLsIdmp().then((d) => {
    console.log(d)
  })
}
```

缓存数据将存储在 `localStorage / sessionStorage` 缓存中，并遵循与`idmp`相同的缓存选项。

如果数据在内存中，则首先从内存中读取。如果不在内存中，则从 `localstorage / sessionStorage` 中读取。如果缓存有效期到期，将从原始函数读取。

## Notice

- 数据持久化仅支持字符串类型的 `globalkey`， 数据格式只支持标准 JSON 格式
- 函数如果返回值为 `undefined`，则不会被持久化，如果一定需要被浏览器缓存，必须返回 `null`
