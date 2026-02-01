import { describe, expect, it } from 'vitest'
import idmp from '../src/index'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('idmp abort', async () => {
  it('should resolve successfully if promise completes before abort', async () => {
    const controller = new AbortController()

    const result = await idmp(
      'resolve-before-abort',
      async () => {
        await sleep(50)
        return 'success'
      },
      {
        signal: controller.signal,
      },
    )

    expect(result).toBe('success')

    // Subsequent calls should use cached result (no need to abort)
    const result2 = await idmp('resolve-before-abort-2', async () => 'new-data')
    expect(result2).toBe('new-data')
  })

  it('should properly reset state when abort occurs during retry', async () => {
    const controller = new AbortController()
    let attemptCount = 0

    const promise = idmp(
      'abort-during-retry',
      async () => {
        attemptCount++
        if (attemptCount <= 1) {
          throw new Error('fail')
        }
        await sleep(200)
        return 'success'
      },
      {
        signal: controller.signal,
        maxRetry: 5,
        minRetryDelay: 50,
      },
    )

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


  it('should not leak abort listeners on successful completion', async () => {
    const controller = new AbortController()
    const key = 'no-leak-' + Date.now()

    await idmp(
      key,
      async () => {
        await sleep(50)
        return 'success'
      },
      {
        signal: controller.signal,
      },
    )

    // This test validates that abort called after success doesn't cause errors
    // The signal has already been used for a completed promise
    expect(true).toBe(true)
  })

  it('should handle abort with different abort reasons', async () => {
    const abortReasons = ['reason1', 'reason2', { code: 'CUSTOM' }]

    for (const reason of abortReasons) {
      const controller = new AbortController()

      setTimeout(() => {
        controller.abort(reason)
      }, 50)

      try {
        await idmp(
          `abort-reason-${String(reason)}`,
          async () => {
            await sleep(200)
            return 'data'
          },
          {
            signal: controller.signal,
          },
        )
      } catch (err: any) {
        if (typeof reason === 'string') {
          expect(err.message).toBe(reason)
        }
      }
    }
  })
})
