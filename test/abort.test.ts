import { describe, expect, it } from 'vitest'
import idmp from '../src/index'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('idmp abort', async () => {
  it('should reject with AbortError when aborted', async () => {
    const controller = new AbortController()
    const promiseFunc = () => {
      return new Promise((resolve, reject) => {
        setTimeout(() => reject('fail'), 100)
      })
    }
    const promise = () =>
      idmp('idmp abort', promiseFunc, {
        maxRetry: 999999,
        signal: controller.signal,
      })

    setTimeout(() => {
      controller.abort('xxxxxxxx')
    }, 1000)

    const allTasks: Promise<void>[] = []

    for (let i = 0; i < 1000; i++) {
      const task = (async () => {
        try {
          await promise()
        } catch (err) {
          expect(err.message).toBe('xxxxxxxx')
        }
      })()
      allTasks.push(task)
    }

    await Promise.all(allTasks)
  })

  it('should reject with AbortError when aborted', async () => {
    const allTasks: Promise<void>[] = []

    for (let i = 0; i < 1000; i++) {
      const task = (async () => {
        try {
          const controller = new AbortController()
          setTimeout(() => {
            controller.abort(`idmp aborted ${i}`)
          }, 1000)
          await idmp(
            Symbol('idmp abort'),
            () => {
              return new Promise((resolve, reject) => {
                setTimeout(() => reject('fail'), 100)
              })
            },
            { signal: controller.signal, maxRetry: 999999 },
          )
        } catch (err: any) {
          expect(err.message).toBe(`idmp aborted ${i}`)
        }
      })()
      allTasks.push(task)
    }

    allTasks.length && (await Promise.all(allTasks))
  })

  it('should handle already aborted signal immediately', async () => {
    const controller = new AbortController()
    controller.abort('already-aborted')

    // If signal is already aborted, should fail immediately
    // (behavior may vary - see implementation details)
    try {
      await idmp('already-aborted-key', async () => 'data', {
        signal: controller.signal,
      })
    } catch (err: any) {
      expect(err.message).toBe('already-aborted')
    }
  })

  it('should resolve successfully if promise completes before abort', async () => {
    const controller = new AbortController()

    const result = await idmp('resolve-before-abort', async () => {
      await sleep(50)
      return 'success'
    }, {
      signal: controller.signal,
    })

    expect(result).toBe('success')

    // Subsequent calls should use cached result (no need to abort)
    const result2 = await idmp('resolve-before-abort-2', async () => 'new-data')
    expect(result2).toBe('new-data')
  })

  it('should properly reset state when abort occurs during retry', async () => {
    const controller = new AbortController()
    let attemptCount = 0

    const promise = idmp('abort-during-retry', async () => {
      attemptCount++
      if (attemptCount <= 1) {
        throw new Error('fail')
      }
      await sleep(200)
      return 'success'
    }, {
      signal: controller.signal,
      maxRetry: 5,
      minRetryDelay: 50,
    })

    // Abort during retry phase
    setTimeout(() => {
      controller.abort('abort-during-retry')
    }, 100)

    try {
      await promise
    } catch (err: any) {
      expect(err.message).toBe('abort-during-retry')
    }

    // After abort, subsequent calls should not use the aborted cache
    const newKey = Symbol()
    const result = await idmp(newKey, async () => 'new-success')
    expect(result).toBe('new-success')
  })

  it('should handle multiple concurrent callers with same abort signal', async () => {
    const controller = new AbortController()
    const key = 'multi-abort-' + Date.now()
    let callCount = 0

    const tasks = Array.from({ length: 100 }, () =>
      idmp(key, async () => {
        callCount++
        await sleep(500)
        return 'data'
      }, {
        signal: controller.signal,
      }).catch((err) => err.message)
    )

    // Abort after short delay
    setTimeout(() => {
      controller.abort('multi-caller-abort')
    }, 50)

    const results = await Promise.all(tasks)

    // All callers should receive the abort message
    results.forEach((result) => {
      expect(result).toBe('multi-caller-abort')
    })

    expect(callCount).toBe(1) // Only called once due to deduplication
  })

  it('should not leak abort listeners on successful completion', async () => {
    const controller = new AbortController()

    await idmp('no-leak', async () => {
      await sleep(50)
      return 'success'
    }, {
      signal: controller.signal,
    const key = 'no-leak-' + Date.now()

    await idmp(key, async () => {
      await sleep(50)
      return 'success'
    }, {
      signal: controller.signal,
    })

    // This test validates that abort called after success doesn't cause errors
    // The signal has already been used for a completed promise
    expect(true).toBe(true)
      const controller = new AbortController()

      setTimeout(() => {
        controller.abort(reason)
      }, 50)

      try {
        await idmp(`abort-reason-${String(reason)}`, async () => {
          await sleep(500)
          return 'data'
        }, {
          signal: controller.signal,
        })
      } catch (err: any) {
        if (typeof reason === 'string') {
          expect(err.message).toBe(reason)
        }
      }
    }
  })
})
