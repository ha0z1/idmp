import idmp, * as idmpModule from '../src/index'
import { describe, expect, it } from 'vitest'

describe('package exports', () => {
  it('exposes idmp as the default export without a same-named export', () => {
    expect(idmpModule.default).toBe(idmp)
    expect('idmp' in idmpModule).toBe(false)
  })
})
