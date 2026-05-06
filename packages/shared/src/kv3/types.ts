/**
 * KV3 (KeyValues3) value types for text-encoded annotation files.
 * Supports objects, arrays, primitives.
 */

export type Kv3Value =
  | Kv3Object
  | Kv3Array
  | string
  | number
  | boolean
  | null

export interface Kv3Object {
  [key: string]: Kv3Value
}

export interface Kv3Array extends Array<Kv3Value> {}

export function isKv3Object(v: Kv3Value): v is Kv3Object {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function isKv3Array(v: Kv3Value): v is Kv3Array {
  return Array.isArray(v)
}
