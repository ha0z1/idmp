import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import fsWrap, { cacheDir, getCachePath } from '../plugins/node-fs/src/index'
import idmp from '../src/index'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

afterEach(() => {
  fs.removeSync(cacheDir)
})

describe('node-fs plugin', () => {
  it('restores unsafe types from disk cache', async () => {
    const namespace = 'nodefs-unsafe'
    const fsIdmp = fsWrap(idmp, namespace)
    const key = 'unsafe-key'
    const cacheKey = `${namespace}_${key}`

    let calls = 0
    const payload = {
      big: 123n,
      add: (n: number) => n + 2,
    }

    const first = await fsIdmp(
      key,
      async () => {
        calls++
        return payload
      },
      { maxAge: 1000 },
    )
    expect(first.big).toBe(123n)
    expect(first.add(1)).toBe(3)

    const cachePath = getCachePath(cacheKey)
    const raw = fs.readFileSync(cachePath, 'utf-8')
    expect(raw).toContain('__@json.function__')

    await sleep(260)

    const second = await fsIdmp(
      key,
      async () => {
        calls++
        return { big: 0n, add: () => 0 }
      },
      { maxAge: 1000 },
    )
    expect(calls).toBe(1)
    expect(second.big).toBe(123n)
    expect(second.add(2)).toBe(4)
  })

  it('expires cached data when maxAge elapses', async () => {
    const namespace = 'nodefs-expire'
    const fsIdmp = fsWrap(idmp, namespace)
    const key = 'expire-key'

    let calls = 0
    const getData = () =>
      fsIdmp(
        key,
        async () => {
          calls++
          return `value-${calls}`
        },
        { maxAge: 50 },
      )

    const first = await getData()
    await sleep(260)
    const second = await getData()

    expect(first).not.toBe(second)
    expect(calls).toBe(2)
  })

  it('should use namespace to isolate cache keys', async () => {
    const ns1Idmp = fsWrap(idmp, 'namespace1')
    const ns2Idmp = fsWrap(idmp, 'namespace2')

    let call1 = 0
    let call2 = 0

    const result1 = await ns1Idmp('key', async () => {
      call1++
      return 'data1'
    })

    const result2 = await ns2Idmp('key', async () => {
      call2++
      return 'data2'
    })

    expect(result1).toBe('data1')
    expect(result2).toBe('data2')
    expect(call1).toBe(1)
    expect(call2).toBe(1)

    // Same key, different namespaces should not interfere
    const result3 = await ns1Idmp('key', async () => 'new-data1')
    const result4 = await ns2Idmp('key', async () => 'new-data2')

    expect(result3).toBe('data1') // cached
    expect(result4).toBe('data2') // cached
    expect(call1).toBe(1)
    expect(call2).toBe(1)
  })

  it('should handle special characters in keys', async () => {
    const namespace = 'nodefs-special'
    const fsIdmp = fsWrap(idmp, namespace)

    const specialKeys = [
      '/api/users/123?name=John&age=30',
      'key-with-dashes',
      'key_with_underscores',
      'key.with.dots',
      'key with spaces',
    ]

    for (const key of specialKeys) {
      let calls = 0
      const result = await fsIdmp(key, async () => {
        calls++
        return `data-${key}`
      })

      expect(result).toBe(`data-${key}`)
      expect(calls).toBe(1)

      // Should retrieve from cache
      const result2 = await fsIdmp(key, async () => 'new-data')
      expect(result2).toBe(`data-${key}`)
      expect(calls).toBe(1)
    }
  })

  it('should handle useMemoryCache option', async () => {
    const namespace = 'nodefs-memory'
    const fsIdmpWithMemory = fsWrap(idmp, namespace, { useMemoryCache: true })
    const fsIdmpNoMemory = fsWrap(idmp, namespace + '-no-mem', {
      useMemoryCache: false,
    })

    let call1 = 0
    let call2 = 0

    // With memory cache
    const result1 = await fsIdmpWithMemory(
      'key',
      async () => {
        call1++
        return 'data1'
      },
      { maxAge: 1000 },
    )

    // Without memory cache (short maxAge)
    const result2 = await fsIdmpNoMemory(
      'key',
      async () => {
        call2++
        return 'data2'
      },
      { maxAge: 1000 },
    )

    expect(result1).toBe('data1')
    expect(result2).toBe('data2')
  })

  it('should flushAll clear all entries from disk', async () => {
    const namespace = 'nodefs-flushall'
    const fsIdmp = fsWrap(idmp, namespace)

    let totalCalls = 0
    const createGetter = (id: number) => () =>
      fsIdmp(
        `key${id}`,
        async () => {
          totalCalls++
          return `data${id}`
        },
        { maxAge: Infinity },
      )

    const getter1 = createGetter(1)
    const getter2 = createGetter(2)
    const getter3 = createGetter(3)

    await getter1()
    await getter2()
    await getter3()
    expect(totalCalls).toBe(3)

    // Should get from cache
    await getter1()
    await getter2()
    await getter3()
    expect(totalCalls).toBe(3)

    // Flush all
    fsIdmp.flushAll()

    // Should call again
    await getter1()
    await getter2()
    await getter3()
    expect(totalCalls).toBe(6)
  })

  it('should handle concurrent access with same key', async () => {
    const namespace = 'nodefs-concurrent'
    const fsIdmp = fsWrap(idmp, namespace)

    let calls = 0
    const tasks = Array.from({ length: 50 }, () =>
      fsIdmp('concurrent-key', async () => {
        calls++
        await sleep(10)
        return 'data'
      }),
    )

    const results = await Promise.all(tasks)

    expect(calls).toBe(1) // should deduplicate
    expect(results.every((r) => r === 'data')).toBe(true)
  })

  it('should handle large data objects', async () => {
    const namespace = 'nodefs-large'
    const fsIdmp = fsWrap(idmp, namespace)

    const largeData = {
      users: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        data: Array(30).fill(Math.random()),
      })),
    }

    let calls = 0
    const result1 = await fsIdmp('large-key', async () => {
      calls++
      return largeData
    })

    expect(result1).toEqual(largeData)
    expect(calls).toBe(1)

    const result2 = await fsIdmp('large-key', async () => ({}))
    expect(result2).toEqual(largeData)
    expect(calls).toBe(1)
  })

  it('should handle data with BigInt, undefined, and functions', async () => {
    const namespace = 'nodefs-complex'
    const fsIdmp = fsWrap(idmp, namespace)

    const complexData = {
      big: 999999999999n,
      fn: (x: number) => x * 2,
      undef: undefined,
      nested: {
        another: 123n,
        func: () => 'test',
      },
    }

    let calls = 0
    const result1 = await fsIdmp('complex', async () => {
      calls++
      return complexData
    })

    expect(result1.big).toBe(999999999999n)
    expect(result1.fn(5)).toBe(10)
    expect(result1.nested.another).toBe(123n)

    const result2 = await fsIdmp('complex', async () => 'new-data')
    expect(result2.big).toBe(999999999999n)
    expect(calls).toBe(1)
  })

  it('should handle file system errors gracefully', async () => {
    const namespace = 'nodefs-error'
    const fsIdmp = fsWrap(idmp, namespace)

    let calls = 0
    const result = await fsIdmp('error-key', async () => {
      calls++
      return 'fallback'
    })

    expect(result).toBe('fallback')
    expect(calls).toBe(1)
  })

  it('should respect maxAge for file cache expiration', async () => {
    const namespace = 'nodefs-expiry'
    const fsIdmp = fsWrap(idmp, namespace)

    let calls = 0
    const getData = (key: string, maxAge: number) =>
      fsIdmp(
        key,
        async () => {
          calls++
          return `data-${calls}`
        },
        { maxAge },
      )

    // Test: Different keys should call independently
    const result1 = await getData('key1', 1000)
    expect(calls).toBe(1)
    expect(result1).toBe('data-1')

    // Same key should use cache
    const result2 = await getData('key1', 1000)
    expect(calls).toBe(1)
    expect(result2).toBe('data-1')

    // Different key should call
    const result3 = await getData('key2', 1000)
    expect(calls).toBe(2)
    expect(result3).toBe('data-2')

    // Same key again should still use cache
    const result4 = await getData('key2', 1000)
    expect(calls).toBe(2)
    expect(result4).toBe('data-2')
  })

  it('should handle multiple namespaces independently', async () => {
    const namespaces = ['ns1', 'ns2', 'ns3']
    const idmps = namespaces.map((ns) => fsWrap(idmp, ns))

    let callCounts = [0, 0, 0]

    const promises = idmps.map((fsIdmp, i) =>
      fsIdmp('same-key', async () => {
        callCounts[i]++
        return `data-${i}`
      }),
    )

    const results = await Promise.all(promises)

    expect(results).toEqual(['data-0', 'data-1', 'data-2'])
    expect(callCounts).toEqual([1, 1, 1])

    // Same call again should use cache from all namespaces
    const promises2 = idmps.map((fsIdmp, i) =>
      fsIdmp('same-key', async () => {
        callCounts[i]++
        return `data-${i}`
      }),
    )

    const results2 = await Promise.all(promises2)
    expect(results2).toEqual(['data-0', 'data-1', 'data-2'])
    expect(callCounts).toEqual([1, 1, 1]) // still cached, no new calls
  })

  it('should create cache directory if it does not exist', async () => {
    const namespace = 'nodefs-mkdir'
    const fsIdmp = fsWrap(idmp, namespace)

    const result = await fsIdmp('mkdir-key', async () => 'data')
    expect(result).toBe('data')

    // Cache directory should have been created
    expect(fs.existsSync(cacheDir)).toBe(true)
  })
})
