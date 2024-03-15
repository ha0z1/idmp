# idmp/browser-storage

## Usage

```typescript
import idmp from 'idmp'
import storageWrap, { getCacheKey } from 'idmp/browser-storage'

const getInfo = async () => {
  const API = `https://haozi.me/?api/your-info`
  return await fetch(API).then((d) => d.text())
}

const lsIdmp = storageWrap(idmp, 'localStorage')

// Only one line need to change
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

Cache data will be stored in `localStorage / sessionStorage` temporary directory and follow the same cache options as `idmp`.
If the data is in the memory, it is read from the memory first. If it is not in the memory, it is read from the `localStorage / sessionStorage`. If the cache validity period expires, it will be read from the remote end.

## Notice

- Data persistence only supports string type `globalKey` and data structures that can be serialized by `JSON.stringify`
- If return value is `undefined` it will not be cached, you must return `null`
