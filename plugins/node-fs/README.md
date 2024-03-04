# idmp/node-fs

## Useage

```typescript
import idmp from 'idmp'
import fsWrap, { cacheDir } from 'idmp/node-fs'
const fsIdmp = fsWrap(idmp)

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
