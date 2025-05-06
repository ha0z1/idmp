import { describe, it, expect, vi, beforeEach } from 'vitest'
import idmp, { type IdmpOptions } from '../src/index'

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
})
