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

  it('should reject synchronously when signal is already aborted before idmp() call', async () => {
    const controller = new AbortController()
    controller.abort('pre-aborted reason')

    let promiseFuncCalled = 0
    const promiseFunc = () => {
      promiseFuncCalled++
      return new Promise((resolve) => setTimeout(() => resolve('ok'), 100))
    }

    let caught: any
    try {
      await idmp('idmp pre-aborted', promiseFunc, {
        signal: controller.signal,
      })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(DOMException)
    expect(caught.name).toBe('AbortError')
    expect(caught.message).toBe('pre-aborted reason')
    // 已 aborted 的 signal 應該完全跳過 promiseFunc
    expect(promiseFuncCalled).toBe(0)
  })

  it('should reject all subsequent callers when first call uses already-aborted signal', async () => {
    const controller = new AbortController()
    controller.abort('aborted-shared')

    const key = 'idmp pre-aborted shared'
    const promiseFunc = () =>
      new Promise((resolve) => setTimeout(() => resolve('ok'), 50))

    const errors: any[] = []
    const tasks: Promise<void>[] = []
    for (let i = 0; i < 5; i++) {
      tasks.push(
        (async () => {
          try {
            await idmp(key, promiseFunc, { signal: controller.signal })
          } catch (err) {
            errors.push(err)
          }
        })(),
      )
    }
    await Promise.all(tasks)

    expect(errors.length).toBe(5)
    for (const err of errors) {
      expect(err).toBeInstanceOf(DOMException)
      expect(err.message).toBe('aborted-shared')
    }
  })
})
