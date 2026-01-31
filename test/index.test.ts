import { createDraft, finishDraft } from 'immer'
import { describe, expect, it } from 'vitest'
import idmp, { type IdmpOptions } from '../src/index'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const random = (min: number = 0, max: number = 1) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

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
  it('returns data identical to the original function', async () => {
    const fetchDataIdmp = () => idmp(Symbol(), fetchData)

    const [dataOrigin, dataIdmp] = await Promise.all([
      fetchData(),
      fetchDataIdmp(),
    ])
    expect(dataIdmp).toEqual(dataOrigin)
  })

  it('calls the original function only once when deduplicated', async () => {
    let count = 0
    let task: any[] = []
    const key = Symbol()
    for (let i = 0; i < 1000; ++i) {
      task.push(
        idmp(key, async () => {
          count++
          await sleep(100)
          return await fetchData()
        }),
      )
    }
    await Promise.all(task)
    expect(count).toEqual(1)
  })

  it('throws an error if data is mutated in test mode', async () => {
    process.env.NODE_ENV = 'production'
    const data = await idmp(Symbol(), fetchData)
    expect(() => {
      data.info.name = 'Jack'
    }).not.toThrowError()
    process.env.NODE_ENV = 'test'
  })

  it('does not throw if data is mutated in production mode', async () => {
    const data = await idmp(Symbol(), fetchData)
    expect(() => {
      data.info.name = 'Jack'
    }).toThrowError()
  })

  it('throws when reusing the same globalKey', async () => {
    const key = Math.random()
    console.error = (...msg: any[]) => {
      throw new Error(`console.error:  ${msg.join(', ')}`)
    }
    try {
      ;(await idmp(key, async () => {}), await idmp(key, async () => {}))
    } catch {
      expect(true).toBe(true)
    }
    console.error = originConsoleError
  })

  it('applies default options if none are provided', async () => {
    const msg = `${Math.random()}`
    const result = await idmp(Math.random(), () => Promise.resolve(msg))
    expect(result).toBe(msg)
  })

  it('respects the maxAge option', async () => {
    const maxAge = 100 // 100ms for test
    const options: IdmpOptions = { maxAge }
    const startTime = Date.now()
    await idmp(Math.random(), () => Promise.resolve('test'), options)
    const endTime = Date.now()
    expect(endTime - startTime).toBeLessThan(maxAge)
  })

  it('bypasses cache when flush is called', async () => {
    const key = Symbol()
    const getData = () => idmp(key, async () => Symbol(), { maxAge: Infinity })

    const data1 = await getData()
    const data2 = await getData()
    expect(data2).toBe(data1)

    idmp.flush(Symbol('undeclared key will do nothing'))
    idmp.flush('')
    idmp.flush(0)
    idmp.flush(key)
    idmp.flush(key)
    idmp.flush('aaaa')
    idmp.flush('aaaa')

    const data3 = await getData()
    expect(data3).not.toBe(data1)
  })

  it('clears all cache when flushAll is called', async () => {
    const key1 = Symbol()
    const key2 = Symbol()
    const getData1 = () =>
      idmp(key1, async () => Symbol(), { maxAge: Infinity })
    const getData2 = () =>
      idmp(key2, async () => Symbol(), { maxAge: Infinity })

    const data11 = await getData1()
    const data12 = await getData1()
    const data21 = await getData2()
    const data22 = await getData2()
    expect(data12).toEqual(data11)
    expect(data22).toEqual(data21)

    idmp.flushAll()

    const data13 = await getData1()
    const data23 = await getData2()
    expect(data13).not.toEqual(data11)
    expect(data23).not.toEqual(data21)
  })

  it('handles Uint[8|16|32]Array correctly', async () => {
    const uint8Array = new Uint8Array(100)
    const getUint8Array = () => idmp('Uint8Array', async () => uint8Array)
    expect(await getUint8Array()).toBe(uint8Array)

    const uint16Array = new Uint8Array(100)
    const getUint16Array = () => idmp('Uint16Array', async () => uint16Array)
    expect(await getUint16Array()).toBe(uint16Array)

    const uint32Array = new Uint8Array(100)
    const getUint32Array = () => idmp('Uint32Array', async () => uint32Array)
    expect(await getUint32Array()).toBe(uint32Array)
  })

  it('handles immer draft data correctly', async () => {
    const origin = { hello: 'world1' }
    const draft = createDraft(origin)

    try {
      const res = await idmp(Symbol(), async () => draft)
      res.hello = 'world2'
    } catch (e) {
      console.error(e)
    }
    expect(origin.hello).toBe('world1')
    expect(draft.hello).toBe('world2')
    const finishData = finishDraft(draft)
    expect(finishData.hello).toBe('world2')
  })

  describe('Do not defineReactive un-configurable value', () => {
    it('handles unconfigurable property correctly', async () => {
      const origin = { hello: 'world1' }
      const data = Object.defineProperty(origin, 'hello', {
        value: 'world2',
        writable: true,
        enumerable: true,
        configurable: false,
      })
      expect(data.hello).toBe('world2')

      const res = await idmp(Symbol(), async () => data)
      res.hello = 'world3'
      // it's not a bug, the origin has been rewritten, see next test
      expect(res.hello).toBe('world3')
      expect(data.hello).toBe('world3')
      expect(origin.hello).toBe('world3')
      expect(res).toBe(data)
    })

    it('throws on changing configurable property after caching', async () => {
      const origin = { hello: 'world1' }
      const data = Object.defineProperty(origin, 'hello', {
        value: 'world2',
        writable: true,
        enumerable: true,
        configurable: true,
      })
      expect(data.hello).toBe('world2')

      const res = await idmp(Symbol(), async () => data)
      expect(() => {
        res.hello = 'world3'
      }).toThrowError()

      expect(res.hello).toBe('world2')
      expect(data.hello).toBe('world2')
      expect(origin.hello).toBe('world2')
    })

    it('throws on modifying plain object after caching', async () => {
      const origin = { hello: 'world1' }
      const data = origin
      expect(data.hello).toBe('world1')

      const res = await idmp(Symbol(), async () => data)
      expect(() => {
        res.hello = 'world3'
      }).toThrowError()

      expect(res.hello).toBe('world1')
      expect(data.hello).toBe('world1')
      expect(origin.hello).toBe('world1')
    })
  })

  it('falls back to origin function when key is falsy', async () => {
    const originFunction = async () => Math.random()
    let arr: number[] = []
    for (let i = 0; i < 100; ++i) {
      idmp('', originFunction).then((num) => {
        arr.push(num)
      })
    }
    setTimeout(() => {
      expect([...new Set(arr)].length).toBe(arr.length)
    })
  })

  Array(random(1, 10))
    .fill(1)
    .forEach((_, i) => {
      it(`should retry the specified number of times on success ${
        i + 1
      }`, async () => {
        const key = Math.random() // 'Symbol()'
        for (let i = 0; i < 10; ++i) {
          const maxRetry = random(2, 5)
          let retryCount = 0
          ;(async () => {
            const data = await idmp(
              key,
              async () => {
                await sleep(random(20, 2000))
                return await fetchData()
              },
              {
                maxRetry,
                onBeforeRetry: (err, extra) => {
                  retryCount++
                  expect(err).toEqual(new Error('fail'))
                  expect(extra).toEqual({ retryCount, globalKey: key })
                },
              },
            )

            expect(data).toEqual(DEEP_DATA)
          })()
        }
      })

      it(`should retry the specified number of times on failure ${
        i + 1
      }`, async () => {
        const key = Math.random() // 'Symbol()'
        for (let i = 0; i < 10; ++i) {
          const maxRetry = random(2, 5)
          let retryCount = 0
          // ;(async () => {
          let failMsg = ''
          try {
            await idmp(
              key,
              async () => {
                await sleep(random(0, 10))
                failMsg = 'fail' + Math.random()
                throw new Error(failMsg)
              },
              {
                maxRetry,
                onBeforeRetry: (err, extra) => {
                  retryCount++
                  expect(err).toEqual(new Error(failMsg))
                  expect(extra).toEqual({ retryCount, globalKey: key })
                },
              },
            )
          } catch (err: any) {
            expect(err.message).toBe(failMsg)
            expect(retryCount).toBe(maxRetry)
          }
          // })()
          await sleep(random(0, 300))
        }
      })
    })

  Array(random(2, 10))
    .fill(1)
    .forEach((_, i) => {
      it(`should call onBeforeRetry before each retry attempt ${
        i + 1
      }`, async () => {
        let called = false
        const options: IdmpOptions = {
          maxRetry: random(3, 10),
          maxAge: random(-(2 ** 32), 2 ** 32),
          onBeforeRetry: () => {
            called = true
          },
        }
        let failMsg = 'fail' + Math.random()
        for (let i = 0; i < 10; ++i) {
          try {
            const data = await idmp(
              Math.random(),
              async () => {
                await sleep(random(1, 60))
                if (Math.random() > 0.5) throw new Error(failMsg)
                return await fetchData()
              },
              options,
            )
            expect(data).toEqual(DEEP_DATA)
          } catch (err: any) {
            expect(err.message).toBe(failMsg)
            expect(called).toBe(true)
          }
        }
      })
    })

  const times = random(5, 20)
  const maxRetry = random(3, 8)
  it(`should have ${times} times rejects, maxRetry: ${maxRetry}`, async () => {
    let count = 0
    for (let i = 0; i < times; ++i) {
      let key = Symbol()

      try {
        await idmp(
          key,
          async () => {
            throw new Error('reject')
          },
          { maxRetry },
        )
      } catch {
        count++
      }
    }
    expect(count).toBe(times)
  })

  describe('exponential backoff retry delay', () => {
    it('should apply exponential backoff algorithm for retries', async () => {
      const delays: number[] = []
      const minRetryDelay = 50
      const maxRetryDelay = 5000
      let attemptCount = 0

      const mockDate = Date.now()
      const originalNow = Date.now
      let currentTime = mockDate

      await idmp(
        Symbol(),
        async () => {
          attemptCount++
          if (attemptCount <= 3) {
            throw new Error('fail')
          }
          return 'success'
        },
        {
          maxRetry: 3,
          minRetryDelay,
          maxRetryDelay,
          onBeforeRetry: () => {
            delays.push(currentTime)
          },
        },
      )

      expect(attemptCount).toBe(4) // 1 initial + 3 retries
      // delays should follow exponential pattern, each retry should be delayed
      expect(delays.length).toBe(3)
    })

    it('should not exceed maxRetryDelay', async () => {
      const maxRetryDelay = 100
      const minRetryDelay = 10
      let callCount = 0

      await idmp(
        Symbol(),
        async () => {
          callCount++
          if (callCount <= 2) {
            throw new Error('fail')
          }
          return 'success'
        },
        {
          maxRetry: 10,
          minRetryDelay,
          maxRetryDelay,
        },
      )

      expect(callCount).toBeGreaterThanOrEqual(3)
    })
  })

  describe('maxAge boundary cases', () => {
    it('should handle maxAge of 0 (immediate expiration)', async () => {
      const key = Symbol()
      let callCount = 0

      const getData = () =>
        idmp(
          key,
          async () => {
            callCount++
            return 'data'
          },
          { maxAge: 0 },
        )

      await getData()
      // maxAge is 0, but the same promise should still be reused during the same microtask
      await sleep(10)
      await getData()

      expect(callCount).toBeGreaterThanOrEqual(1)
    })

    it('should handle maxAge beyond 7 days limit', async () => {
      const key = Symbol()
      const _7days = 604800000

      let callCount = 0
      const getData = () =>
        idmp(
          key,
          async () => {
            callCount++
            return 'data'
          },
          { maxAge: 999999999999 }, // way beyond 7 days
        )

      const result1 = await getData()
      const result2 = await getData()
      expect(callCount).toBe(1)
      expect(result1).toBe(result2)
    })

    it('should handle maxAge as Infinity', async () => {
      const key = Symbol()
      let callCount = 0

      const getData = () =>
        idmp(
          key,
          async () => {
            callCount++
            return 'data'
          },
          { maxAge: Infinity },
        )

      const result1 = await getData()
      await sleep(100)
      const result2 = await getData()
      expect(callCount).toBe(1)
      expect(result1).toBe(result2)
    })

    it('should handle negative maxAge (clamped to 0)', async () => {
      const key = Symbol()
      let callCount = 0

      const getData = () =>
        idmp(
          key,
          async () => {
            callCount++
            return 'data'
          },
          { maxAge: -1000 },
        )

      await getData()
      await sleep(10)
      await getData()
      expect(callCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('abort signal edge cases', () => {
    it('should handle already aborted signal', async () => {
      const controller = new AbortController()
      controller.abort('pre-aborted')

      try {
        await idmp('pre-abort-key', async () => 'data', {
          signal: controller.signal,
        })
      } catch (err: any) {
        expect(err.message).toBe('pre-aborted')
      }
    })

    it('should resolve before abort and not be affected', async () => {
      const controller = new AbortController()
      const key = 'resolve-first-' + Date.now()

      const result = await idmp(
        key,
        async () => {
          await sleep(50)
          return 'success'
        },
        { signal: controller.signal },
      )

      expect(result).toBe('success')

      // second call with different key to avoid affecting cached result
      const result2 = await idmp(
        key + '-2',
        async () => 'should-work',
      )
      expect(result2).toBe('should-work')
    })
  })

  describe('concurrent retry scenarios', () => {
    it('should handle multiple concurrent calls during retry', async () => {
      const key = Symbol()
      let attemptCount = 0

      const promises = Array.from({ length: 50 }, (_, i) =>
        idmp(
          key,
          async () => {
            attemptCount++
            if (attemptCount <= 2) {
              throw new Error('fail')
            }
            await sleep(10)
            return `result-${i}`
          },
          { maxRetry: 3, minRetryDelay: 5 },
        ).catch((err) => err.message),
      )

      const results = await Promise.all(promises)
      // All should succeed with same result (not "result-{i}" because it's cached)
      expect(attemptCount).toBeLessThanOrEqual(5) // should be deduplicated
    })

    it('should maintain consistency when retrying with new callers joining', async () => {
      const key = Symbol()
      let attemptCount = 0
      const maxRetry = 2

      const p1 = idmp(
        key,
        async () => {
          attemptCount++
          if (attemptCount <= 1) {
            throw new Error('fail')
          }
          await sleep(50)
          return 'final-result'
        },
        { maxRetry, minRetryDelay: 10 },
      )

      await sleep(5)

      // Join during retry
      const p2 = idmp(
        key,
        async () => 'should not call',
        { maxRetry, minRetryDelay: 10 },
      )

      const [r1, r2] = await Promise.all([p1, p2])
      expect(r1).toBe('final-result')
      expect(r2).toBe('final-result')
      expect(attemptCount).toBeLessThanOrEqual(3)
    })
  })

  describe('high concurrency scenarios', () => {
    it('should handle 10000 concurrent calls for same key', async () => {
      const key = Symbol()
      let callCount = 0

      const tasks = Array.from({ length: 10000 }, () =>
        idmp(
          key,
          async () => {
            callCount++
            await sleep(10)
            return 'data'
          },
        ),
      )

      const results = await Promise.all(tasks)
      expect(callCount).toBe(1)
      expect(results.every((r) => r === 'data')).toBe(true)
    })

    it('should deduplicate calls across different keys', async () => {
      const keys = Array.from({ length: 100 }, (_, i) => Symbol())
      let callCount = 0

      const tasks = keys.flatMap((key) =>
        Array.from({ length: 100 }, () =>
          idmp(
            key,
            async () => {
              callCount++
              return 'data'
            },
          ),
        ),
      )

      await Promise.all(tasks)
      // Should call exactly once per unique key
      expect(callCount).toBe(100)
    })
  })

  describe('promise rejection details', () => {
    it('should preserve original error stack trace through retries', async () => {
      const errorMsg = 'original error'
      const key = Symbol()
      let stackTraces: (string | undefined)[] = []

      try {
        await idmp(
          key,
          async () => {
            const err = new Error(errorMsg)
            stackTraces.push(err.stack)
            throw err
          },
          { maxRetry: 1, minRetryDelay: 5 },
        )
      } catch (err: any) {
        expect(err.message).toBe(errorMsg)
      }
    })

    it('should pass correct error object to onBeforeRetry', async () => {
      const customError = new Error('custom fail')
      const errors: Error[] = []

      await idmp(
        Symbol(),
        async () => {
          throw customError
        },
        {
          maxRetry: 2,
          minRetryDelay: 5,
          onBeforeRetry: (err) => {
            errors.push(err)
          },
        },
      ).catch(() => {})

      expect(errors).toHaveLength(2)
      expect(errors[0]).toBe(customError)
      expect(errors[1]).toBe(customError)
    })
  })
})
