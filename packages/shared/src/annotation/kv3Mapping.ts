/**
 * Map between KV3 parse tree and in-memory annotation node list.
 * CS2 annotation file root may be { Nodes = [ ... ] } or similar; we support
 * a configurable node array path (default "Nodes").
 */

import type { Kv3Value, Kv3Object, Kv3Array } from '../kv3/types'
import { isKv3Object, isKv3Array } from '../kv3/types'
import type { AnnotationNode, TextDescObject } from './types'

const DEFAULT_NODES_KEY = 'Nodes'

function getFloatArray(v: Kv3Value): [number, number, number] | undefined {
  if (!Array.isArray(v) || v.length < 3) return undefined
  const a = v as Kv3Array
  const x = Number(a[0])
  const y = Number(a[1])
  const z = Number(a[2])
  if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) return undefined
  return [x, y, z]
}

function getTextDesc(v: Kv3Value): TextDescObject | undefined {
  if (!isKv3Object(v)) return undefined
  const o = v as Kv3Object
  const text = typeof o.Text === 'string' ? o.Text : ''
  const fontSize = typeof o.FontSize === 'number' ? o.FontSize : 14
  const fadeIn = typeof o.FadeInDist === 'number' ? o.FadeInDist : -1
  const fadeOut = typeof o.FadeOutDist === 'number' ? o.FadeOutDist : -1
  const showBg = typeof o.ShowBackground === 'boolean' ? o.ShowBackground : true
  return { Text: text, FontSize: fontSize, FadeInDist: fadeIn, FadeOutDist: fadeOut, ShowBackground: showBg }
}

// Fields that are explicitly handled — anything else lands in _extra for round-trip preservation
const KNOWN_NODE_FIELDS = new Set([
  'Type', 'SubType', 'Id', 'Position', 'Angles', 'Enabled', 'VisiblePfx', 'Color',
  'TextPositionOffset', 'TextFacePlayer', 'TextHorizontalAlign', 'Title', 'Desc',
  'MasterNodeId', 'RevealOnSuccess', 'StreakLimitGuidesOn', 'StreakLimitGuidesOff',
  'JumpThrow', 'GrenadeType',
])

function kv3ToNode(obj: Kv3Object): AnnotationNode {
  const type = (typeof obj.Type === 'string' ? obj.Type : 'position') as AnnotationNode['Type']
  const node: AnnotationNode = {
    Type: type,
    SubType: typeof obj.SubType === 'string' ? obj.SubType : 'main'
  }
  if (typeof obj.Id === 'string') node.Id = obj.Id
  const pos = getFloatArray(obj.Position)
  if (pos) node.Position = pos
  const angles = getFloatArray(obj.Angles)
  if (angles) node.Angles = angles
  if (typeof obj.Enabled === 'boolean') node.Enabled = obj.Enabled
  if (typeof obj.VisiblePfx === 'boolean') node.VisiblePfx = obj.VisiblePfx
  const color = getFloatArray(obj.Color as Kv3Value)
  if (color) node.Color = color.map((c) => Math.max(0, Math.min(255, c))) as [number, number, number]
  const textOffset = getFloatArray(obj.TextPositionOffset as Kv3Value)
  if (textOffset) node.TextPositionOffset = textOffset
  if (typeof obj.TextFacePlayer === 'boolean') node.TextFacePlayer = obj.TextFacePlayer
  if (typeof obj.TextHorizontalAlign === 'string') node.TextHorizontalAlign = obj.TextHorizontalAlign
  const title = getTextDesc(obj.Title as Kv3Value)
  if (title) node.Title = title
  const desc = getTextDesc(obj.Desc as Kv3Value)
  if (desc) node.Desc = desc
  if (typeof obj.MasterNodeId === 'string') node.MasterNodeId = obj.MasterNodeId
  if (typeof obj.RevealOnSuccess === 'boolean') node.RevealOnSuccess = obj.RevealOnSuccess
  if (typeof obj.StreakLimitGuidesOn === 'number') node.StreakLimitGuidesOn = obj.StreakLimitGuidesOn
  if (typeof obj.StreakLimitGuidesOff === 'number') node.StreakLimitGuidesOff = obj.StreakLimitGuidesOff
  if (typeof obj.JumpThrow === 'boolean') node.JumpThrow = obj.JumpThrow
  if (typeof obj.GrenadeType === 'string') node.GrenadeType = obj.GrenadeType as AnnotationNode['GrenadeType']

  // Preserve any unrecognised fields so they survive a load → edit → save round-trip
  const extra: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    if (!KNOWN_NODE_FIELDS.has(key)) extra[key] = obj[key]
  }
  if (Object.keys(extra).length > 0) node._extra = extra

  return node
}

function nodeToKv3Object(node: AnnotationNode): Kv3Object {
  const o: Kv3Object = {
    Type: node.Type,
    SubType: node.SubType ?? 'main'
  }
  if (node.Id) o.Id = node.Id
  if (node.Position) o.Position = node.Position
  if (node.Angles) o.Angles = node.Angles
  if (node.Enabled !== undefined) o.Enabled = node.Enabled
  if (node.VisiblePfx !== undefined) o.VisiblePfx = node.VisiblePfx
  if (node.Color) o.Color = node.Color
  if (node.TextPositionOffset) o.TextPositionOffset = node.TextPositionOffset
  if (node.TextFacePlayer !== undefined) o.TextFacePlayer = node.TextFacePlayer
  if (node.TextHorizontalAlign !== undefined) o.TextHorizontalAlign = node.TextHorizontalAlign
  if (node.Title) o.Title = node.Title as unknown as Kv3Object
  if (node.Desc) o.Desc = node.Desc as unknown as Kv3Object
  if (node.MasterNodeId) o.MasterNodeId = node.MasterNodeId
  if (node.RevealOnSuccess !== undefined) o.RevealOnSuccess = node.RevealOnSuccess
  if (node.StreakLimitGuidesOn !== undefined) o.StreakLimitGuidesOn = node.StreakLimitGuidesOn
  if (node.StreakLimitGuidesOff !== undefined) o.StreakLimitGuidesOff = node.StreakLimitGuidesOff
  if (node.JumpThrow !== undefined) o.JumpThrow = node.JumpThrow
  if (node.GrenadeType) o.GrenadeType = node.GrenadeType
  // Re-emit any fields we don't explicitly model
  if (node._extra) Object.assign(o, node._extra)
  return o
}

export function kv3ToNodes(root: Kv3Value, nodesKey: string = DEFAULT_NODES_KEY): AnnotationNode[] {
  if (!isKv3Object(root)) return []
  const obj = root as Kv3Object

  // Preferred: array-style layout (e.g. { Nodes = [ ... ] })
  const nodesVal = obj[nodesKey]
  if (isKv3Array(nodesVal)) {
    return (nodesVal as Kv3Array)
      .map((item) => {
        if (!isKv3Object(item)) return null
        return kv3ToNode(item as Kv3Object)
      })
      .filter((n): n is AnnotationNode => n !== null)
  }

  // Fallback: flat layout with keys like MapAnnotationNodeXX = { ... }
  const nodes: AnnotationNode[] = []
  for (const [, value] of Object.entries(obj)) {
    if (!isKv3Object(value)) continue
    const v = value as Kv3Object
    if (typeof v.Type === 'string') {
      nodes.push(kv3ToNode(v))
    }
  }
  return nodes
}

export function nodesToKv3(nodes: AnnotationNode[], nodesKey: string = DEFAULT_NODES_KEY): Kv3Object {
  const arr: Kv3Array = nodes.map((n) => nodeToKv3Object(n) as Kv3Value)
  return { [nodesKey]: arr }
}

export function extractNodesKey(root: Kv3Object): string {
  if (root.Nodes !== undefined && Array.isArray(root.Nodes)) return 'Nodes'
  if (root.nodes !== undefined && Array.isArray(root.nodes)) return 'nodes'
  for (const k of Object.keys(root)) {
    if (Array.isArray(root[k])) return k
  }
  return DEFAULT_NODES_KEY
}

export function setNodesInRoot(root: Kv3Object, nodes: AnnotationNode[], nodesKey: string): void {
  const current = root[nodesKey]

  // Array-style root: overwrite the array under nodesKey
  if (isKv3Array(current) || Array.isArray(current)) {
    const arr: Kv3Array = nodes.map((n) => nodeToKv3Object(n) as Kv3Value)
    root[nodesKey] = arr
    return
  }

  // Flat-style root: keys like MapAnnotationNodeXX = { ... }
  const mapKeys = Object.keys(root).filter((k) => k.startsWith('MapAnnotationNode'))
  for (const k of mapKeys) {
    delete root[k]
  }

  nodes.forEach((node, index) => {
    const key = `MapAnnotationNode${index}`
    root[key] = nodeToKv3Object(node) as Kv3Value
  })
}
