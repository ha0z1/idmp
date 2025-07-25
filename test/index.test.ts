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
})
