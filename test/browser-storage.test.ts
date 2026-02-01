import { beforeEach, describe, expect, it, vi } from 'vitest'
import storageWrap from '../plugins/browser-storage/src/index'
import idmp from '../src/index'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getInfo = async () => ({
  name: 'John',
  age: 30,
  gender: 'male',
})

const lsIdmp = storageWrap(idmp, 'localStorage')
const ssIdmp = storageWrap(idmp, 'sessionStorage')

const getInfoWithLsIdmp = () =>
  lsIdmp('/api/your-info', getInfo, {
    maxAge: 5 * 1000,
  })

const getInfoWithSsIdmp = () =>
  ssIdmp('/api/your-info-ss', getInfo, {
    maxAge: 5 * 1000,
  })

describe('idmp/storage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('It should print out the data from cache in localStorage', async () => {
    const originalLog = console.log
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      originalLog.apply(console, args)
    })

    await getInfoWithLsIdmp()

    const promises: Array<ReturnType<typeof getInfoWithLsIdmp>> = []
    for (let i = 0; i < 10; ++i) {
      promises.push(getInfoWithLsIdmp())
    }

    await Promise.all(promises)

    const calls = spy.mock.calls.flat()
    const hitLogs = calls.filter(
      (arg) => typeof arg === 'string' && arg.includes('from cache'),
    )

    expect(hitLogs.length).toBe(10)

    spy.mockRestore()
  })

  it('should cache data in sessionStorage', async () => {
    const result1 = await getInfoWithSsIdmp()
    const result2 = await getInfoWithSsIdmp()

    expect(result1).toEqual(result2)
    expect(result1).toEqual({
      name: 'John',
      age: 30,
      gender: 'male',
    })

    // Verify data is in sessionStorage
    const stored = sessionStorage.getItem('@idmp/v4//api/your-info-ss')
    expect(stored).toBeTruthy()
  })

  it('should use different storage for localStorage and sessionStorage', async () => {
    const result1 = await getInfoWithLsIdmp()
    const result2 = await getInfoWithSsIdmp()

    expect(result1).toEqual(result2)
    expect(result1).toEqual({
      name: 'John',
      age: 30,
      gender: 'male',
    })
  })

  it('should flush specific key from both memory and storage', async () => {
    let callCount = 0
    const flushableIdmp = storageWrap(idmp, 'localStorage')

    const getData = () =>
      flushableIdmp(
        '/api/test-flush',
        async () => {
          callCount++
          return 'data'
        },
        { maxAge: Infinity },
      )

    const result1 = await getData()
    expect(callCount).toBe(1)

    const result2 = await getData()
    expect(callCount).toBe(1) // Should be from cache

    flushableIdmp.flush('/api/test-flush')

    const result3 = await getData()
    expect(callCount).toBe(2) // Should call again

    expect(result1).toEqual(result3)
  })

  it('should handle cache expiration and auto-cleanup', async () => {
    const expireIdmp = storageWrap(idmp, 'localStorage')
    let callCount = 0

    const getData = () =>
      expireIdmp(
        'expire-key',
        async () => {
          callCount++
          return 'time-sensitive-data'
        },
        { maxAge: 100 },
      )

    const result1 = await getData()
    expect(callCount).toBe(1)

    // Before expiration
    const result2 = await getData()
    expect(callCount).toBe(1)

    // Wait for expiration
    await sleep(150)

    const result3 = await getData()
    expect(callCount).toBe(2) // Should call again

    expect(result1).toEqual(result3)
  })

  it('should handle corrupted storage data gracefully', async () => {
    const errorIdmp = storageWrap(idmp, 'localStorage')

    // Set invalid JSON in storage
    localStorage.setItem('@idmp/v4/bad-key', '{invalid json')

    let callCount = 0
    const result = await errorIdmp('bad-key', async () => {
      callCount++
      return 'fallback-data'
    })

    expect(result).toBe('fallback-data')
    expect(callCount).toBe(1) // Should have called the function
  })

  it('should handle maxAge of 0', async () => {
    const zeroAgeIdmp = storageWrap(idmp, 'localStorage')
    let callCount = 0

    const getData = () =>
      zeroAgeIdmp(
        'zero-age',
        async () => {
          callCount++
          return 'data'
        },
        { maxAge: 0 },
      )

    await getData()
    expect(callCount).toBe(1)

    // Even with maxAge 0, same promise reuse during same tick
    await getData()
    expect(callCount).toBe(1)
  })

  it('should handle special characters in keys', async () => {
    const specialIdmp = storageWrap(idmp, 'localStorage')
    const specialKey = '/api/users/123?name=John&age=30#section'

    let callCount = 0
    const result = await specialIdmp(specialKey, async () => {
      callCount++
      return 'special-data'
    })

    expect(result).toBe('special-data')
    expect(callCount).toBe(1)

    const result2 = await specialIdmp(specialKey, async () => 'new-data')
    expect(result2).toBe('special-data')
    expect(callCount).toBe(1)
  })

  it('should handle large data objects', async () => {
    const largeIdmp = storageWrap(idmp, 'localStorage')

    const largeData = {
      users: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        data: Array(20).fill(Math.random()),
      })),
    }

    let callCount = 0
    const result = await largeIdmp('large-key', async () => {
      callCount++
      return largeData
    })

    expect(result).toEqual(largeData)
    expect(callCount).toBe(1)

    const result2 = await largeIdmp('large-key', async () => ({}))
    expect(result2).toEqual(largeData)
    expect(callCount).toBe(1)
  })

  it('should not interfere with non-idmp storage entries', async () => {
    const customIdmp = storageWrap(idmp, 'localStorage')

    // Store some unrelated data
    localStorage.setItem('other-key', 'other-value')
    localStorage.setItem('another-key', 'another-value')

    await customIdmp('my-key', async () => 'my-data')

    // Non-idmp entries should still exist
    expect(localStorage.getItem('other-key')).toBe('other-value')
    expect(localStorage.getItem('another-key')).toBe('another-value')

    customIdmp.flushAll()

    // Non-idmp entries should be preserved
    expect(localStorage.getItem('other-key')).toBe('other-value')
    expect(localStorage.getItem('another-key')).toBe('another-value')
  })

  it('should handle concurrent access across storage wrappers', async () => {
    const idmp1 = storageWrap(idmp, 'localStorage')
    const idmp2 = storageWrap(idmp, 'sessionStorage')

    let call1 = 0
    let call2 = 0

    const task1 = idmp1('ls-key', async () => {
      call1++
      return 'ls-data'
    })
    const task2 = idmp2('ss-key', async () => {
      call2++
      return 'ss-data'
    })

    const [result1, result2] = await Promise.all([task1, task2])

    expect(result1).toBe('ls-data')
    expect(result2).toBe('ss-data')
    expect(call1).toBe(1)
    expect(call2).toBe(1)
  })
})
