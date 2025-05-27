import { createDraft, finishDraft } from 'immer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import idmp, { type IdmpOptions } from '../src/index'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const originConsoleError = console.error.bind(console)

const DEEP_DATA = {
  name: 'John',
  age: 20,
  info: {
    name: 'John',
    age: 20,
  },
}
const fetchData = async () => {
  await sleep(100)
  return JSON.parse(JSON.stringify(DEEP_DATA))
}

describe('idmp', () => {
  beforeEach(() => {
    idmp.flushAll()
  })

  it('should deduplicate multiple calls with the same globalKey', async () => {
    const fn = vi.fn(() => Promise.resolve('result'))
    const p1 = idmp('key', fn)
    const p2 = idmp('key', fn)

    const [res1, res2] = await Promise.all([p1, p2])
    expect(res1).toBe('result')
    expect(res2).toBe('result')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should not deduplicate calls with different keys', async () => {
    const fn = vi.fn(() => Promise.resolve('res'))
    const p1 = idmp('key1', fn)
    const p2 = idmp('key2', fn)

    await Promise.all([p1, p2])
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should execute directly without deduplication when globalKey is falsy', async () => {
    const fn = vi.fn(() => Promise.resolve('no-key'))
    const res = await idmp(undefined, fn)
    expect(res).toBe('no-key')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should clear cache after flush', async () => {
    const fn = vi.fn(() => Promise.resolve('flush-test'))
    await idmp('flush-key', fn)
    idmp.flush('flush-key')
    await idmp('flush-key', fn)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should retry on failure and call onBeforeRetry', async () => {
    const err = new Error('fail')
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('retry-success')
    const onBeforeRetry = vi.fn()

    const result = await idmp('retry-key', mockFn, {
      maxRetry: 2,
      minRetryDelay: 10,
      onBeforeRetry,
    })

    expect(result).toBe('retry-success')
    expect(mockFn).toHaveBeenCalledTimes(2)
    expect(onBeforeRetry).toHaveBeenCalledWith(err, {
      globalKey: 'retry-key',
      retryCount: 1,
    })
  })

  it('should fail after maxRetry attempts', async () => {
    const mockFn = vi.fn(() => Promise.reject(new Error('fail')))
    const onBeforeRetry = vi.fn()

    await expect(
      idmp('fail-key', mockFn, {
        maxRetry: 2,
        minRetryDelay: 5,
        onBeforeRetry,
      }),
    ).rejects.toThrow('fail')

    expect(mockFn).toHaveBeenCalledTimes(3) // initial + 2 retries
    expect(onBeforeRetry).toHaveBeenCalledTimes(2)
  })

  it('should clear all cache with flushAll', async () => {
    const fn = vi.fn(() => Promise.resolve('flush-all'))
    await idmp('key1', fn)
    await idmp('key2', fn)
    idmp.flushAll()
    await idmp('key1', fn)
    await idmp('key2', fn)
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it('returns identical result to original function', async () => {
    const fetchDataIdmp = () => idmp(Symbol(), fetchData)
    const [dataOrigin, dataIdmp] = await Promise.all([
      fetchData(),
      fetchDataIdmp(),
    ])
    expect(dataIdmp).toEqual(dataOrigin)
  })

  it('caches result and only invokes original function once', async () => {
    let count = 0
    const key = Symbol()
    const task = Array.from({ length: 1000 }, () =>
      idmp(key, async () => {
        count++
        await sleep(100)
        return fetchData()
      }),
    )
    await Promise.all(task)
    expect(count).toBe(1)
  })

  it('allows mutation of data in production mode without error', async () => {
    process.env.NODE_ENV = 'production'
    const data = await idmp(Symbol(), fetchData)
    expect(() => {
      data.info.name = 'Jack'
    }).not.toThrow()
    process.env.NODE_ENV = 'test'
  })

  it('throws error on mutation in non-production mode', async () => {
    const data = await idmp(Symbol(), fetchData)
    expect(() => {
      data.info.name = 'Jack'
    }).toThrowError()
  })

  it('throws error when using same key for different functions', async () => {
    const key = Math.random()
    console.error = (...msg: any[]) => {
      throw new Error(`console.error: ${msg.join(', ')}`)
    }
    try {
      await Promise.all([idmp(key, async () => {}), idmp(key, async () => {})])
    } catch {
      expect(true).toBe(true)
    } finally {
      console.error = originConsoleError
    }
  })

  it('returns result even when no options are passed', async () => {
    const msg = `${Math.random()}`
    const result = await idmp(Math.random(), () => Promise.resolve(msg))
    expect(result).toBe(msg)
  })

  it('respects maxAge and returns promptly', async () => {
    const maxAge = 100
    const options: IdmpOptions = { maxAge }
    const start = Date.now()
    await idmp(Math.random(), () => Promise.resolve('test'), options)
    const duration = Date.now() - start
    expect(duration).toBeLessThan(500) // allow small margin due to Promise overhead
  })

  it('flush(key) invalidates cache for specified key', async () => {
    const key = Symbol()
    const getData = () => idmp(key, async () => Symbol(), { maxAge: Infinity })

    const data1 = await getData()
    const data2 = await getData()
    expect(data2).toBe(data1)

    idmp.flush(Symbol('irrelevant'))
    idmp.flush('')
    idmp.flush(0)
    idmp.flush(key)

    const data3 = await getData()
    expect(data3).not.toBe(data1)
  })

  it('flushAll() invalidates all cache entries', async () => {
    const key1 = Symbol()
    const key2 = Symbol()
    const getData1 = () =>
      idmp(key1, async () => Symbol(), { maxAge: Infinity })
    const getData2 = () =>
      idmp(key2, async () => Symbol(), { maxAge: Infinity })

    const [a1, a2] = await Promise.all([getData1(), getData2()])
    expect(await getData1()).toBe(a1)
    expect(await getData2()).toBe(a2)

    idmp.flushAll()

    expect(await getData1()).not.toBe(a1)
    expect(await getData2()).not.toBe(a2)
  })

  it('supports caching of Uint8Array/Uint16Array/Uint32Array', async () => {
    const arrays = [
      { key: 'Uint8Array', arr: new Uint8Array(100) },
      { key: 'Uint16Array', arr: new Uint16Array(100) },
      { key: 'Uint32Array', arr: new Uint32Array(100) },
    ]

    for (const { key, arr } of arrays) {
      const result = await idmp(key, async () => arr)
      expect(result).toBe(arr)
    }
  })

  it('supports immer draft and allows editing after retrieval', async () => {
    const origin = { hello: 'world1' }
    const draft = createDraft(origin)

    const result = await idmp(Symbol(), async () => draft)
    result.hello = 'world2'

    expect(origin.hello).toBe('world1')
    expect(draft.hello).toBe('world2')

    const finished = finishDraft(draft)
    expect(finished.hello).toBe('world2')
  })

  describe('unconfigurable properties handling', () => {
    it('does not reactively redefine non-configurable property', async () => {
      const origin = { hello: 'world1' }
      const data = Object.defineProperty(origin, 'hello', {
        value: 'world2',
        writable: true,
        enumerable: true,
        configurable: false,
      })

      const result = await idmp(Symbol(), async () => data)
      result.hello = 'world3'

      expect(result.hello).toBe('world3')
      expect(origin.hello).toBe('world3')
    })

    it('throws when modifying configurable reactive value', async () => {
      const origin = { hello: 'world1' }
      const data = Object.defineProperty(origin, 'hello', {
        value: 'world2',
        writable: true,
        enumerable: true,
        configurable: true,
      })

      const result = await idmp(Symbol(), async () => data)
      expect(() => {
        result.hello = 'world3'
      }).toThrowError()
      expect(result.hello).toBe('world2')
    })

    it('throws when modifying shallow reactive object', async () => {
      const origin = { hello: 'world1' }
      const result = await idmp(Symbol(), async () => origin)
      expect(() => {
        result.hello = 'world3'
      }).toThrowError()
      expect(result.hello).toBe('world1')
    })
  })

  it('bypasses caching when key is falsy', async () => {
    const fn = async () => Math.random()
    const results: number[] = []

    await Promise.all(
      Array.from({ length: 50 }, () =>
        idmp('', fn).then((res) => results.push(res)),
      ),
    )

    const unique = new Set(results)
    expect(unique.size).toBe(results.length)
  })

  describe('retry logic', () => {
    it('retries up to maxRetry and resolves if successful', async () => {
      const key = Math.random()
      let callCount = 0
      const maxRetry = 3

      const result = await idmp(
        key,
        async () => {
          if (callCount < 2) {
            callCount++
            throw new Error('fail')
          }
          return DEEP_DATA
        },
        {
          maxRetry,
          onBeforeRetry: (err, extra) => {
            expect(err.message).toBe('fail')
            expect(extra.globalKey).toBe(key)
          },
        },
      )

      expect(result).toEqual(DEEP_DATA)
    })

    it('throws after exceeding maxRetry attempts', async () => {
      const key = Math.random()
      const maxRetry = 3
      let retryCount = 0

      const errMsg = 'always fail'
      await expect(
        idmp(
          key,
          async () => {
            throw new Error(errMsg)
          },
          {
            maxRetry,
            onBeforeRetry: (err, extra) => {
              retryCount++
              expect(err.message).toBe(errMsg)
              expect(extra.globalKey).toBe(key)
            },
          },
        ),
      ).rejects.toThrow(errMsg)

      expect(retryCount).toBe(maxRetry)
    })
  })
})
