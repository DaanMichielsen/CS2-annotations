import { describe, it, expect } from 'vitest'
import { fileIsAnnotation, readMapName } from './guideScan'

describe('fileIsAnnotation', () => {
  it('returns true when content starts with the KV3 header', () => {
    expect(fileIsAnnotation('<!-- kv3 encoding:text:version{abc} -->\n{}')).toBe(true)
  })
  it('returns false for unrelated text content', () => {
    expect(fileIsAnnotation('not a kv3 file')).toBe(false)
  })
  it('ignores a leading BOM', () => {
    expect(fileIsAnnotation('﻿<!-- kv3 encoding:text:version{abc} -->\n{}')).toBe(true)
  })
})

describe('readMapName', () => {
  it('extracts MapName from the first lines of the file', () => {
    const content = '<!-- kv3 -->\n{\n  MapName = "de_inferno"\n  Nodes = []\n}\n'
    expect(readMapName(content)).toBe('de_inferno')
  })
  it('returns undefined when MapName is absent', () => {
    expect(readMapName('<!-- kv3 -->\n{\n  Nodes = []\n}\n')).toBeUndefined()
  })
})
