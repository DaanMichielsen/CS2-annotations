import { describe, it, expect } from 'vitest'
import { parseKv3Text } from './parser'
import { serializeKv3Text } from './serializer'
import type { Kv3Object } from './types'

const SAMPLE_KV3 = `<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->
{
	MapName = "de_dust2"
	ScreenText = {}
	Nodes = [
		{
			main = { pos = "100 200 300" }
		},
	]
}
`

describe('parseKv3Text / serializeKv3Text round trip', () => {
  it('parses a KV3 document into a plain object tree', () => {
    const root = parseKv3Text(SAMPLE_KV3) as Kv3Object
    expect(root.MapName).toBe('de_dust2')
    expect(Array.isArray(root.Nodes)).toBe(true)
  })

  it('round-trips: parse -> serialize -> parse yields the same data', () => {
    const root = parseKv3Text(SAMPLE_KV3) as Kv3Object
    const serialized = serializeKv3Text(root)
    const reparsed = parseKv3Text(serialized) as Kv3Object
    expect(reparsed).toEqual(root)
  })

  it('tolerates a leading UTF-8 BOM', () => {
    const withBom = '﻿' + SAMPLE_KV3
    const root = parseKv3Text(withBom) as Kv3Object
    expect(root.MapName).toBe('de_dust2')
  })

  it('handles an empty Nodes array', () => {
    const empty = `<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->
{
	MapName = ""
	ScreenText = {}
	Nodes = []
}
`
    const root = parseKv3Text(empty) as Kv3Object
    expect(root.Nodes).toEqual([])
    const reparsed = parseKv3Text(serializeKv3Text(root)) as Kv3Object
    expect(reparsed.Nodes).toEqual([])
  })
})
