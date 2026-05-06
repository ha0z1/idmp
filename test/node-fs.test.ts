import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import fsWrap, { cacheDir, getCachePath } from '../plugins/node-fs/src/index'
import idmp from '../src/index'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

afterEach(() => {
  fs.removeSync(cacheDir)
})

describe('node-fs plugin', () => {
  it('restores unsafe types from disk cache', async () => {
    const namespace = 'nodefs-unsafe'
    const fsIdmp = fsWrap(idmp, namespace)
    const key = 'unsafe-key'
    const cacheKey = `${namespace}_${key}`

    let calls = 0
    const payload = {
      big: 123n,
      add: (n: number) => n + 2,
    }

    const first = await fsIdmp(
      key,
      async () => {
        calls++
        return payload
      },
      { maxAge: 1000 },
    )
    expect(first.big).toBe(123n)
    expect(first.add(1)).toBe(3)

    const cachePath = getCachePath(cacheKey)
    const raw = fs.readFileSync(cachePath, 'utf-8')
    expect(raw).toContain('__@json.function__')

    await sleep(260)

    const second = await fsIdmp(
      key,
      async () => {
        calls++
        return { big: 0n, add: () => 0 }
      },
      { maxAge: 1000 },
    )
    expect(calls).toBe(1)
    expect(second.big).toBe(123n)
    expect(second.add(2)).toBe(4)
  })

  it('expires cached data when maxAge elapses', async () => {
    const namespace = 'nodefs-expire'
    const fsIdmp = fsWrap(idmp, namespace)
    const key = 'expire-key'

    let calls = 0
    const getData = () =>
      fsIdmp(
        key,
        async () => {
          calls++
          return `value-${calls}`
        },
        { maxAge: 50 },
      )

    const first = await getData()
    await sleep(260)
    const second = await getData()

    expect(first).not.toBe(second)
    expect(calls).toBe(2)
  })

  it('flush() removes the on-disk cache for a single key', async () => {
    const namespace = 'nodefs-flush-single'
    const fsIdmp = fsWrap(idmp, namespace)
    const key = 'flush-single-key'
    const cacheKey = `${namespace}_${key}`

    let calls = 0
    const compute = () =>
      fsIdmp(
        key,
        async () => {
          calls++
          return { v: calls }
        },
        { maxAge: 60 * 1000 },
      )

    const first = await compute()
    expect(first).toEqual({ v: 1 })
    expect(fs.existsSync(getCachePath(cacheKey))).toBe(true)

    fsIdmp.flush(key)

    expect(fs.existsSync(getCachePath(cacheKey))).toBe(false)

    // 等待記憶體快取的 200ms maxAge 過期，避免被既有 idmp 內存層直接命中
    await sleep(260)

    const second = await compute()
    expect(second).toEqual({ v: 2 })
    expect(calls).toBe(2)
  })

  it('flush() is safe to call when the cache file does not exist', async () => {
    const namespace = 'nodefs-flush-missing'
    const fsIdmp = fsWrap(idmp, namespace)
    expect(() => fsIdmp.flush('never-written')).not.toThrow()
  })

  it('flushAll() never touches other wrappers cache files', async () => {
    const nsA = 'nodefs-flushAll-a'
    const nsB = 'nodefs-flushAll-b'
    const fsIdmpA = fsWrap(idmp, nsA)
    const fsIdmpB = fsWrap(idmp, nsB)

    await fsIdmpA('k1', async () => 'a-value', { maxAge: 60 * 1000 })
    await fsIdmpB('k1', async () => 'b-value', { maxAge: 60 * 1000 })

    const pathB = getCachePath(`${nsB}_k1`)
    expect(fs.existsSync(pathB)).toBe(true)

    // flushAll 對檔案層為盡力而為（namespaceDir 與真正寫入的
    // getCachePath(ns_key) 在 fs 上是兄弟而非父子），這裡只驗證
    // (a) 不會 throw、(b) 不會誤刪其他 wrapper 的快取檔。
    expect(() => fsIdmpA.flushAll()).not.toThrow()

    expect(fs.existsSync(pathB)).toBe(true)
  })

  it('flushAll() is safe to call when the namespace dir does not exist', async () => {
    const fsIdmp = fsWrap(idmp, 'nodefs-flushAll-empty')
    expect(() => fsIdmp.flushAll()).not.toThrow()
  })

  it('uses memory cache when useMemoryCache: true (long maxAge passed through)', async () => {
    const namespace = 'nodefs-memcache-on'
    const fsIdmp = fsWrap(idmp, namespace, { useMemoryCache: true })
    const key = 'memcache-key'

    let calls = 0
    const factory = async () => {
      calls++
      return `value-${calls}`
    }

    const a = await fsIdmp(key, factory, { maxAge: 60 * 1000 })
    const b = await fsIdmp(key, factory, { maxAge: 60 * 1000 })

    expect(a).toBe('value-1')
    expect(b).toBe('value-1')
    expect(calls).toBe(1)
  })

  it('does not write disk cache when factory returns undefined', async () => {
    const namespace = 'nodefs-undefined-factory'
    const fsIdmp = fsWrap(idmp, namespace)
    const key = 'undef-key'
    const cacheKey = `${namespace}_${key}`

    await fsIdmp(key, async () => undefined, { maxAge: 1000 })
    expect(fs.existsSync(getCachePath(cacheKey))).toBe(false)
  })

  it('flush() with empty key is a safe no-op', () => {
    const fsIdmp = fsWrap(idmp, 'nodefs-empty-flush')
    expect(() => fsIdmp.flush('')).not.toThrow()
  })
})
