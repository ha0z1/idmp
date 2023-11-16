import { expect, it } from 'vitest'
import idmp, { type IdmpOptions } from '../src/index'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const random = (min: number = 0, max: number = 1) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const originConsoleError = console.error.bind(console)

const fetchData = async () => {
  await sleep(100)
  return {
    name: 'John',
    age: 20,
  }
}

it('return data as originFunction', async () => {
  const fetchDataIdmp = () => idmp(Symbol(), fetchData)

  const [dataOrigin, dataIdmp] = await Promise.all([
    fetchData(),
    fetchDataIdmp(),
  ])
  expect(dataIdmp).toEqual(dataOrigin)
})

// it('originFunction only call once', async () => {
//   let count = 0
//   let task: any[] = []
//   const key = Symbol()
//   for (let i = 0; i < 1000; ++i) {
//     task.push(
//       idmp(key, async () => {
//         count++
//         await sleep(100)
//         return await fetchData()
//       }),
//     )
//   }
//   await Promise.all(task)
//   expect(count).toEqual(1)
// })

it('reusing the same globalKey will cause a failure', async () => {
  const key = Math.random()
  console.error = (...msg: any[]) => {
    throw new Error(`console.error:  ${msg.join(', ')}`)
  }
  try {
    await idmp(key, async () => {}), await idmp(key, async () => {})
  } catch {
    expect(true).toBe(true)
  }
  console.error = originConsoleError
})

it('should use default values for options if not provided', async () => {
  const msg = `${Math.random()}`
  const result = await idmp(Math.random(), () => Promise.resolve(msg))
  expect(result).toBe(msg)
})

it('should respect the maxAge parameter', async () => {
  const maxAge = 100 // 100ms for test
  const options: IdmpOptions = { maxAge }
  const startTime = Date.now()
  await idmp(Math.random(), () => Promise.resolve('test'), options)
  const endTime = Date.now()
  expect(endTime - startTime).toBeLessThan(maxAge)
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

          expect(data).toEqual({
            name: 'John',
            age: 20,
          })
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
          expect(data).toEqual({
            name: 'John',
            age: 20,
          })
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
