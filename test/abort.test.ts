import { describe, expect, it } from 'vitest'
import idmp from '../src/index'

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
})
