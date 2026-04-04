---
name: idmp
description: 'Use when you need to deduplicate concurrent or repeated async calls, prevent duplicate API requests, cache async function results, add automatic retry with exponential backoff, memoize heavy computation wrapped in Promise, replace SWR/Provider for request sharing, invalidate cache with flush, or persist cached data to localStorage, sessionStorage, node-fs, or redis. Covers install, usage, and plugin code generation for idmp in browser, React, and Node.js projects.'
---

# idmp

Use this skill whenever the task involves:

- Deduplicating concurrent or repeated async/network requests
- Preventing duplicate API calls across components or modules
- Caching async function results with a TTL (`maxAge`)
- Memoizing expensive computation wrapped in a Promise
- Adding automatic retry with exponential backoff on failure
- Replacing SWR, Provider, or Redux for simple data sharing
- Invalidating cache after mutations (`flush` / `flushAll`)
- Persisting cached data to localStorage, sessionStorage, file system, or Redis
- Installing `idmp` or any of its official plugins

## Installation

Install the main package:

```bash
npm install idmp
```

Or use any other package manager: `pnpm add idmp` / `yarn add idmp` / `bun add idmp`.

The official plugin entry points are exported from the same package:

- `idmp/browser-storage`
- `idmp/node-fs`
- `idmp/redis`

## Core Pattern

Wrap the original async function with a stable deduplication key.

```typescript
import idmp from 'idmp'

const fetchUser = async (userId: string) => {
  const response = await fetch(`/api/users/${userId}`)
  return await response.json()
}

export const fetchUserIdmp = (userId: string) =>
  idmp(`/api/users/${userId}`, () => fetchUser(userId))
```

## Options To Reach For

- `maxAge`: keep resolved data for a period of time (default 3000ms, max 7 days)
- `maxRetry`: retry transient failures automatically (default 30)
- `minRetryDelay`: minimum retry backoff in ms (default 50)
- `maxRetryDelay`: maximum retry backoff in ms (default 5000)
- `signal`: pass an `AbortSignal` to cancel all pending calls sharing this key
- `onBeforeRetry`: log or monitor retry attempts

```typescript
const controller = new AbortController()

const fetchUserIdmp = (userId: string) =>
  idmp(`/api/users/${userId}`, () => fetchUser(userId), {
    maxAge: 5_000,
    maxRetry: 5,
    signal: controller.signal,
  })

// Abort all pending calls for this key
controller.abort('user navigated away')
```

## Cache Invalidation

Use the same key when invalidating cache:

```typescript
idmp.flush(`/api/users/${userId}`)
idmp.flushAll()
```

## Official Plugins

Browser storage:

```typescript
import idmp from 'idmp'
import storageWrap from 'idmp/browser-storage'

const storageIdmp = storageWrap(idmp, 'localStorage')
```

Node file system:

```typescript
import idmp from 'idmp'
import fsWrap from 'idmp/node-fs'

const fsIdmp = fsWrap(idmp, 'your-project-namespace')
```

Redis:

```typescript
import idmp from 'idmp'
import redisWrap from 'idmp/redis'

const redisIdmp = redisWrap(idmp, 'your-project-namespace', {
  url: 'redis://localhost:6379',
})
```

## Guidance

- Prefer deterministic string keys that reflect the real request identity.
- When a function accepts parameters, build the key from those parameters.
- Preserve the original function return type by forwarding arguments into the wrapped function.
- Use `flush` after mutations when the next read must bypass cache.
- Use browser storage for frontend persistence, `node-fs` for local Node.js persistence, and `redis` for shared server-side persistence.
