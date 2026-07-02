import { describe, it, expect } from 'vitest'
import { toLocalGuideName } from './guideNaming'

describe('toLocalGuideName', () => {
  it('replaces whitespace with underscores', () => {
    expect(toLocalGuideName('my cool guide')).toBe('my_cool_guide')
  })
  it('strips invalid characters', () => {
    expect(toLocalGuideName('a/b\\c:d')).toBe('a_b_c_d')
  })
  it('collapses repeated underscores', () => {
    expect(toLocalGuideName('a   b')).toBe('a_b')
  })
  it('trims leading/trailing underscores', () => {
    expect(toLocalGuideName('  _weird_  ')).toBe('weird')
  })
})
