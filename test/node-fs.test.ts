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
})
