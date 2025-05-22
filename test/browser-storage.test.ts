import storageWrap from 'idmp/browser-storage'
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

describe('idmp/storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('It should print out the data from cache in localStorage', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

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
})
