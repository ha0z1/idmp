# idmp/browser-storage

## Usage

```typescript
import idmp from 'idmp'
import storageWrap, { getCacheKey } from 'idmp/browser-storage'

const localStorageIdmp = storageWrap(
  idmp,
  'localStorage' /* default is 'sessionStorage' */,
)

const getUserDataWithlocalStorageIdmp = (userId: string) =>
  localStorageIdmp(
    `getUserDataWithlocalStorageIdmp${userId}`,
    () => getUserData(userId),
    {
      maxAge: 5000,
    },
  )

getUserDataWithlocalStorageIdmp('123').then((data) => {
  console.log(data)
})
```

Cache data will be stored in `localStorage / sessionStorage` temporary directory and follow the same cache options as `idmp`.
If the data is in the memory, it is read from the memory first. If it is not in the memory, it is read from the `localStorage / sessionStorage`. If the cache validity period expires, it will be read from the remote end.

## Notice

Data persistence only supports string type `globalKey` and data structures that can be serialized by `JSON.stringify`
