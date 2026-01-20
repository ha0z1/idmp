# idmp/node-fs

## Usage

```typescript
import idmp from 'idmp'
import fsWrap, { cacheDir, getCachePath } from 'idmp/node-fs'
const fsIdmp = fsWrap(idmp, 'xxx') // xxx: Recommended to a UUID in the global namespace to avoid conflicts, one per project is enough.

await fsIdmp(
  'localFileSystemCache',
  async () => {
    return await getData(...)
  },
  { maxAge: 60 * 1000 }
)

```

Cache data will be stored in the `cacheDir` temporary directory and follow the same cache options as `idmp`.
If the data is in the memory, it is read from the memory first. If it is not in the memory, it is read from the file system. If the cache validity period expires, it will be read from the remote end.

## Notice

- Data persistence only supports string type `globalKey` and data structures that can be serialized by [json-web3](https://www.npmjs.com/package/json-web3)
- If return value is `undefined` it will not be cached, you must return `null`
