import { beforeEach, describe, expect, it, vi } from 'vitest'
import idmp from '../src/index'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// 只補強 src/index.ts 內可達分支（readonly walker / printLogs / OPENING）。
// node-fs 與 browser-storage 的補強放在各自的測試檔，避免跨檔併發 IO。

describe('idmp readonly walker — extra branches', () => {
  it('handles options with a circular self-reference (visited bail)', async () => {
    const opts: any = { maxRetry: 1, maxAge: 100 }
    opts.self = opts // 命中 visited.has(obj) 早退分支

    const result = await idmp('cov-extra-circular-opts', async () => 'ok', opts)
    expect(result).toBe('ok')
  })

  it('handles options with getter/setter properties (defineReactive skip)', async () => {
    const opts: any = { maxRetry: 1, maxAge: 100 }
    Object.defineProperty(opts, 'computed', {
      get: () => 'derived',
      enumerable: true,
      configurable: true,
    })

    const result = await idmp('cov-extra-getter-opts', async () => 'ok', opts)
    expect(result).toBe('ok')
  })

  it('handles factory return value with custom prototype (proto bail)', async () => {
    class Custom {
      kind = 'custom'
    }
    const data = new Custom()
    const out = await idmp('cov-extra-class-proto', async () => data, {
      maxAge: 100,
    })
    expect(out.kind).toBe('custom')
  })
})

describe('idmp printLogs — debug toggles', () => {
  const KEY = 'cov-extra-debug-toggle'

  beforeEach(() => {
    idmp.flush(KEY)
    try {
      localStorage.removeItem('idmp_debug')
    } catch {}
  })

  it('does NOT print when localStorage.idmp_debug === "false"', async () => {
    try {
      localStorage.setItem('idmp_debug', 'false')
    } catch {}

    const spy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})

    await idmp(KEY, async () => 'one', { maxAge: 1000 })
    // 第二次同步路徑 RESOLVED → 觸發 printLogs，但 idmp_debug=false 應早退
    await idmp(KEY, async () => 'two', { maxAge: 1000 })

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('prints "from cache" when status hits RESOLVED on subsequent call', async () => {
    const spy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})

    await idmp(KEY, async () => 'one', { maxAge: 1000 })
    await idmp(KEY, async () => 'two', { maxAge: 1000 })

    const allArgs = spy.mock.calls.flat()
    expect(
      allArgs.some(
        (arg) => typeof arg === 'string' && arg.includes('from cache'),
      ),
    ).toBe(true)
    spy.mockRestore()
  })
})

describe('idmp OPENING branch — concurrent dedup', () => {
  it('pushes concurrent callers into pending list while first call is OPENING', async () => {
    const KEY = 'cov-extra-opening-dedup'
    idmp.flush(KEY)

    let calls = 0
    const factory = async () => {
      calls++
      await sleep(80)
      return 'shared'
    }

    // 同步發起多個呼叫，第一個進 UNSENT→OPENING，其餘進 OPENING 分支
    const tasks = Array.from({ length: 25 }, () =>
      idmp(KEY, factory, { maxAge: 1000 }),
    )
    const results = await Promise.all(tasks)
    expect(results.every((r) => r === 'shared')).toBe(true)
    expect(calls).toBe(1)
  })
})

describe('idmp abort-during-inflight — .then() and .catch() bail branches', () => {
  it('bails in .then() when cache is ABORTED while promise is in-flight (line 575)', async () => {
    const key = 'abort-inflight-then-' + Math.random()
    const controller = new AbortController()

    // A promise we control manually so we can resolve it AFTER the abort fires
    let doResolve!: (v: string) => void
    const controlled = new Promise<string>((res) => (doResolve = res))

    let caughtError: any = null
    // Attach .catch() immediately to prevent unhandled-rejection warnings
    const p = idmp(key, () => controlled, {
      signal: controller.signal,
      maxRetry: 0,
    }).catch((e) => {
      caughtError = e
    })

    // Let the promise enter OPENING state
    await sleep(0)

    // Abort while status = OPENING — fires the abort listener, sets ABORTED,
    // and rejects all pending callers via doRejects()
    controller.abort('mid-flight-resolve')

    // Resolve the inner promise AFTER the abort — triggers the .then() handler
    // which must bail early at line 575 (cache[K.status] === ABORTED)
    doResolve('late-value')
    await sleep(10)

    await p
    expect(caughtError).toBeInstanceOf(DOMException)
    expect((caughtError as DOMException).name).toBe('AbortError')
    expect((caughtError as DOMException).message).toBe('mid-flight-resolve')
  })

  it('bails in .catch() when cache is ABORTED while promise is in-flight (line 586)', async () => {
    const key = 'abort-inflight-catch-' + Math.random()
    const controller = new AbortController()

    let doReject!: (err: Error) => void
    const controlled = new Promise<string>((_, rej) => (doReject = rej))

    let caughtError: any = null
    // Attach .catch() immediately to prevent unhandled-rejection warnings
    const p = idmp(key, () => controlled, {
      signal: controller.signal,
      maxRetry: 99, // high retry to confirm abort prevents retrying
    }).catch((e) => {
      caughtError = e
    })

    await sleep(0)

    // Abort while status = OPENING
    controller.abort('mid-flight-catch')

    // Reject after abort — triggers the .catch() handler which must bail early
    // at line 586 (cache[K.status] === ABORTED), not attempt retries
    doReject(new Error('late-rejection'))
    await sleep(10)

    await p
    expect(caughtError).toBeInstanceOf(DOMException)
    expect((caughtError as DOMException).name).toBe('AbortError')
    expect((caughtError as DOMException).message).toBe('mid-flight-catch')
  })
})

describe('getMin cap branch (line 113)', () => {
  it('uses maxRetryDelay when computed exponential delay exceeds the cap', async () => {
    const key = 'getmin-cap-' + Math.random()
    let callCount = 0

    // With maxRetryDelay:1 and minRetryDelay:50, the first retry delay is
    // min(1, 50 * 2^0) = min(1, 50) = 1 — this takes the `b` (cap) branch of getMin
    const result = await idmp(
      key,
      async () => {
        if (++callCount < 3) throw new Error('transient')
        return 'ok'
      },
      { maxRetry: 3, minRetryDelay: 50, maxRetryDelay: 1 },
    )

    expect(result).toBe('ok')
    expect(callCount).toBe(3)
  })
})

describe('production mode — _s assignment (line 639)', () => {
  it('_s is undefined when module is loaded with NODE_ENV=production', async () => {
    vi.resetModules()
    const saved = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      // Dynamic import after resetModules re-evaluates the module,
      // so the ternary on line 639 takes the UNDEFINED branch
      const mod = await import('../src/index')
      expect((mod.default as any)._s).toBeUndefined()
    } finally {
      process.env.NODE_ENV = saved
      vi.resetModules()
    }
  })
})
