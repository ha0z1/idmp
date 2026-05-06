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
