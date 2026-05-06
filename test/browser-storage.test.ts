import storageWrap, { getCacheKey } from 'idmp/browser-storage'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import idmp from '../src/index'

const getInfo = async () => ({
  name: 'John',
  age: 30,
  gender: 'male',
})

const lsIdmp = storageWrap(idmp, 'localStorage')

const getInfoWithLsIdmp = () =>
  lsIdmp('/api/your-info', getInfo, {
    maxAge: 5 * 1000,
  })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('idmp/storage', () => {
  beforeEach(() => {
    localStorage.clear()
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

  it('persists value into localStorage with the prefixed key on first call', async () => {
    const key = '/api/persist-on-first-call'
    let calls = 0
    const fetcher = async () => {
      calls++
      return { count: calls }
    }

    const value = await storageWrap(idmp, 'localStorage')(key, fetcher, {
      maxAge: 60 * 1000,
    })
    expect(value).toEqual({ count: 1 })

    const raw = localStorage.getItem(getCacheKey(key))
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.d).toEqual({ count: 1 })
    expect(typeof parsed.t).toBe('number')
    expect(parsed.a).toBe(60 * 1000)
  })

  it('returns the disk-cached value on a fresh idmp instance (cross-instance hit)', async () => {
    const key = '/api/cross-instance'
    const wrapA = storageWrap(idmp, 'localStorage')
    let aCalls = 0
    await wrapA(
      key,
      async () => {
        aCalls++
        return { from: 'A' }
      },
      { maxAge: 60 * 1000 },
    )
    expect(aCalls).toBe(1)

    // 用 idmp.flush 把記憶體快取清掉，但保留 localStorage 紀錄，
    // 模擬「下次冷啟動」場景。
    idmp.flush(key)

    const wrapB = storageWrap(idmp, 'localStorage')
    let bCalls = 0
    const value = await wrapB(
      key,
      async () => {
        bCalls++
        return { from: 'B' }
      },
      { maxAge: 60 * 1000 },
    )

    expect(bCalls).toBe(0)
    expect(value).toEqual({ from: 'A' })
  })

  it('expires the persisted value once stored maxAge elapses', async () => {
    const key = '/api/expire-on-disk'
    const wrap = storageWrap(idmp, 'localStorage')

    let calls = 0
    const fetcher = async () => {
      calls++
      return calls
    }

    await wrap(key, fetcher, { maxAge: 30 })
    expect(calls).toBe(1)

    // localStorage 內紀錄已過期 + 把記憶體快取清掉
    idmp.flush(key)
    await sleep(60)
    expect(localStorage.getItem(getCacheKey(key))).not.toBeNull()

    const second = await wrap(key, fetcher, { maxAge: 30 })
    expect(second).toBe(2)
    // 過期後應從 localStorage 移除舊紀錄並重新寫入
    const raw = localStorage.getItem(getCacheKey(key))
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).d).toBe(2)
  })

  it('flush() removes both idmp memory and the localStorage entry for the key', async () => {
    const key = '/api/flush-single'
    const wrap = storageWrap(idmp, 'localStorage')

    let calls = 0
    const fetcher = async () => {
      calls++
      return calls
    }

    await wrap(key, fetcher, { maxAge: 60 * 1000 })
    expect(localStorage.getItem(getCacheKey(key))).not.toBeNull()

    wrap.flush(key)
    expect(localStorage.getItem(getCacheKey(key))).toBeNull()

    const second = await wrap(key, fetcher, { maxAge: 60 * 1000 })
    expect(second).toBe(2)
  })

  it('flushAll() clears every prefixed entry but leaves unrelated keys alone', async () => {
    const wrap = storageWrap(idmp, 'localStorage')

    await wrap('/api/all-1', async () => 'v1', { maxAge: 60 * 1000 })
    await wrap('/api/all-2', async () => 'v2', { maxAge: 60 * 1000 })

    // 一個與 plugin 無關的 key — flushAll() 不應動它
    localStorage.setItem('not-idmp-key', 'keep-me')

    expect(localStorage.getItem(getCacheKey('/api/all-1'))).not.toBeNull()
    expect(localStorage.getItem(getCacheKey('/api/all-2'))).not.toBeNull()

    wrap.flushAll()

    expect(localStorage.getItem(getCacheKey('/api/all-1'))).toBeNull()
    expect(localStorage.getItem(getCacheKey('/api/all-2'))).toBeNull()
    expect(localStorage.getItem('not-idmp-key')).toBe('keep-me')
  })

  it('flush() with empty/falsy globalKey is a no-op', async () => {
    const wrap = storageWrap(idmp, 'localStorage')
    localStorage.setItem('not-idmp-untouched', '1')
    expect(() => wrap.flush('')).not.toThrow()
    expect(localStorage.getItem('not-idmp-untouched')).toBe('1')
  })

  it('uses sessionStorage when storageType defaults to sessionStorage', async () => {
    sessionStorage.clear()
    const key = '/api/session-default'
    const wrap = storageWrap(idmp) // no second arg → 'sessionStorage'

    let calls = 0
    const value = await wrap(
      key,
      async () => {
        calls++
        return { ok: true }
      },
      { maxAge: 60 * 1000 },
    )

    expect(value).toEqual({ ok: true })
    expect(sessionStorage.getItem(getCacheKey(key))).not.toBeNull()
    expect(localStorage.getItem(getCacheKey(key))).toBeNull()
    expect(calls).toBe(1)

    sessionStorage.clear()
  })

  it('logs the plugin debug message when storage hits but memory is cold', async () => {
    const key = '/api/cov-storage-warm-log'
    const wrap = storageWrap(idmp, 'localStorage')

    await wrap(key, async () => ({ ok: 1 }), { maxAge: 60 * 1000 })
    idmp.flush(key) // 只清記憶體，保留 localStorage

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const second = await wrap(key, async () => ({ ok: 99 }), {
      maxAge: 60 * 1000,
    })

    expect(second).toEqual({ ok: 1 })
    const args = spy.mock.calls.flat()
    expect(
      args.some(
        (arg) =>
          typeof arg === 'string' &&
          arg.includes('[idmp-plugin browser-storage debug]') &&
          arg.includes(key),
      ),
    ).toBe(true)
    spy.mockRestore()
  })

  it('does not write storage when factory returns undefined', async () => {
    const key = '/api/cov-undefined-factory'
    const before = localStorage.length

    await lsIdmp(key, async () => undefined, { maxAge: 60 * 1000 })
    const after = localStorage.length

    expect(after).toBe(before)
    expect(localStorage.getItem(getCacheKey(key))).toBeNull()
  })
})
