/**
 * Lightweight KV3 text parser for CS2 annotation files.
 * Supports: key = value, blocks {}, arrays [], strings, numbers, booleans, line and block comments.
 */

import type { Kv3Value, Kv3Object, Kv3Array } from './types'

const WHITESPACE = /[\s\n\r\t]/
const DIGIT = /[0-9]/
const IDENT_START = /[a-zA-Z_$]/
const IDENT = /[a-zA-Z0-9_$]/

export function parseKv3Text(source: string): Kv3Value {
  let i = 0
  const n = source.length

  function skipWhitespaceAndComments(): void {
    while (i < n) {
      const c = source[i]
      if (WHITESPACE.test(c)) {
        i++
        continue
      }
      // line comments: //
      if (c === '/' && source[i + 1] === '/') {
        i += 2
        while (i < n && source[i] !== '\n' && source[i] !== '\r') i++
        continue
      }
      // block comments: /* ... */
      if (c === '/' && source[i + 1] === '*') {
        i += 2
        while (i < n - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++
        if (i < n - 1) i += 2
        continue
      }
      // KV3 header/comments can also use <!-- ... -->
      if (c === '<' && source.slice(i, i + 4) === '<!--') {
        i += 4
        while (i < n - 2 && !(source[i] === '-' && source[i + 1] === '-' && source[i + 2] === '>')) i++
        if (i < n - 2) i += 3
        continue
      }
      break
    }
  }

  function readKey(): string {
    skipWhitespaceAndComments()
    if (i >= n) throw new Error('Unexpected end; expected key')
    const start = i
    if (source[i] === '"') {
      i++
      let key = ''
      while (i < n && source[i] !== '"') {
        if (source[i] === '\\') {
          i++
          if (i < n) key += source[i]
          i++
        } else {
          key += source[i++]
        }
      }
      if (i < n) i++
      return key
    }
    if (IDENT_START.test(source[i])) {
      while (i < n && IDENT.test(source[i])) i++
      return source.slice(start, i)
    }
    throw new Error(`Unexpected character at ${i}; expected key`)
  }

  function expectEqual(): void {
    skipWhitespaceAndComments()
    if (source.slice(i, i + 1) === '=') {
      i++
      return
    }
    throw new Error(`Expected '=' at position ${i}`)
  }

  function readString(): string {
    skipWhitespaceAndComments()
    if (source[i] !== '"') throw new Error(`Expected string at ${i}`)
    i++
    let s = ''
    while (i < n && source[i] !== '"') {
      if (source[i] === '\\') {
        i++
        if (i < n) {
          const esc = source[i]
          if (esc === 'n') s += '\n'
          else if (esc === 'r') s += '\r'
          else if (esc === 't') s += '\t'
          else if (esc === '"') s += '"'
          else s += esc
          i++
        }
      } else {
        s += source[i++]
      }
    }
    if (i < n) i++
    return s
  }

  function readNumber(): number {
    skipWhitespaceAndComments()
    const start = i
    if (source[i] === '-') i++
    while (i < n && DIGIT.test(source[i])) i++
    if (i < n && source[i] === '.') {
      i++
      while (i < n && DIGIT.test(source[i])) i++
    }
    if (i < n && (source[i] === 'e' || source[i] === 'E')) {
      i++
      if (source[i] === '+' || source[i] === '-') i++
      while (i < n && DIGIT.test(source[i])) i++
    }
    const num = source.slice(start, i)
    const v = parseFloat(num)
    if (Number.isNaN(v)) throw new Error(`Invalid number at ${start}`)
    return v
  }

  function readValue(): Kv3Value {
    skipWhitespaceAndComments()
    if (i >= n) throw new Error('Unexpected end; expected value')

    if (source[i] === '{') {
      i++
      const obj: Kv3Object = {}
      skipWhitespaceAndComments()
      while (i < n && source[i] !== '}') {
        const key = readKey()
        expectEqual()
        const val = readValue()
        obj[key] = val
        skipWhitespaceAndComments()
        if (source[i] === ',') i++
        skipWhitespaceAndComments()
      }
      if (i < n) i++
      return obj
    }

    if (source[i] === '[') {
      i++
      const arr: Kv3Array = []
      skipWhitespaceAndComments()
      while (i < n && source[i] !== ']') {
        arr.push(readValue())
        skipWhitespaceAndComments()
        if (source[i] === ',') i++
        skipWhitespaceAndComments()
      }
      if (i < n) i++
      return arr
    }

    if (source[i] === '"') return readString()

    if (source[i] === '-' || DIGIT.test(source[i])) return readNumber()

    const rest = source.slice(i)
    if (rest.startsWith('true')) {
      i += 4
      return true
    }
    if (rest.startsWith('false')) {
      i += 5
      return false
    }
    if (rest.startsWith('null')) {
      i += 4
      return null
    }

    throw new Error(`Unexpected character at ${i}: ${source[i]}`)
  }

  skipWhitespaceAndComments()
  if (i >= n) return {}

  if (source[i] === '{') {
    const root = readValue()
    skipWhitespaceAndComments()
    if (i < n) throw new Error(`Unexpected content at ${i}`)
    return root
  }

  const root: Kv3Object = {}
  while (i < n) {
    skipWhitespaceAndComments()
    if (i >= n) break
    const key = readKey()
    expectEqual()
    const val = readValue()
    root[key] = val
    skipWhitespaceAndComments()
    if (source[i] === ',') i++
  }
  return root
}
