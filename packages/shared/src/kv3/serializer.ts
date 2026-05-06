/**
 * KV3 text serializer for CS2 annotation files.
 *
 * The KV3 header line is REQUIRED — CS2 uses it to identify encoding and format.
 * Root objects are wrapped in { } as the KV3 spec requires.
 * Arrays of objects (e.g. Nodes) are expanded to multiline for readability.
 */

import type { Kv3Value, Kv3Object, Kv3Array } from './types'

// Standard Valve KV3 text/generic header used by CS2 annotation files.
const KV3_HEADER =
  '<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->'

function escapeString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

function serializeValue(value: Kv3Value, indent: string): string {
  if (value === null) return 'null'
  if (value === true) return 'true'
  if (value === false) return 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return '"' + escapeString(value) + '"'

  if (Array.isArray(value)) {
    const arr = value as Kv3Array
    if (arr.length === 0) return '[]'
    const nextIndent = indent + '\t'
    // Expand arrays that contain objects to multiline (e.g. the Nodes array)
    if (arr.some((v) => typeof v === 'object' && v !== null && !Array.isArray(v))) {
      const items = arr.map((v) => nextIndent + serializeValue(v, nextIndent))
      return '[\n' + items.join(',\n') + ',\n' + indent + ']'
    }
    // Primitive arrays stay inline
    return '[' + arr.map((v) => serializeValue(v, indent)).join(', ') + ']'
  }

  const obj = value as Kv3Object
  const keys = Object.keys(obj)
  if (keys.length === 0) return '{}'
  const nextIndent = indent + '\t'
  const lines = keys.map((key) => {
    const keyStr = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : '"' + escapeString(key) + '"'
    return nextIndent + keyStr + ' = ' + serializeValue(obj[key], nextIndent)
  })
  return '{\n' + lines.join('\n') + '\n' + indent + '}'
}

/**
 * Serialize a KV3 value to text with the required file header.
 * The root object is always wrapped in { } as per KV3 spec.
 */
export function serializeKv3Text(value: Kv3Value): string {
  return KV3_HEADER + '\n' + serializeValue(value, '')
}
