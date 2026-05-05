/**
 * CS2 annotation node types per Valve's annotation API.
 */

export const NODE_TYPES = ['grenade', 'position', 'text', 'line', 'spot'] as const
export type NodeType = (typeof NODE_TYPES)[number]

export const GRENADE_TYPES = ['smoke', 'flash', 'he', 'molotov', 'decoy'] as const
export type GrenadeType = (typeof GRENADE_TYPES)[number]

export const GRENADE_SUBTYPES = ['main', 'aim_target', 'destination'] as const
export const LINE_SUBTYPES = ['main', 'aim_target'] as const

export interface TextDescObject {
  Text?: string
  FontSize?: number
  FadeInDist?: number
  FadeOutDist?: number
  ShowBackground?: boolean
}

export interface AnnotationNodeBase {
  Id?: string
  Type: NodeType
  SubType?: string
  Position?: [number, number, number]
  Angles?: [number, number, number]
  Enabled?: boolean
  VisiblePfx?: boolean
  Color?: [number, number, number]
  TextPositionOffset?: [number, number, number]
  TextFacePlayer?: boolean
  Title?: TextDescObject
  Desc?: TextDescObject
  MasterNodeId?: string
  RevealOnSuccess?: boolean
}

export interface GrenadeNodeMain extends AnnotationNodeBase {
  Type: 'grenade'
  SubType?: 'main'
  StreakLimitGuidesOn?: number
  StreakLimitGuidesOff?: number
  JumpThrow?: boolean
  GrenadeType?: GrenadeType
}

export interface AnnotationNode extends AnnotationNodeBase {
  Type: NodeType
  SubType?: string
  TextHorizontalAlign?: string
  StreakLimitGuidesOn?: number
  StreakLimitGuidesOff?: number
  JumpThrow?: boolean
  GrenadeType?: GrenadeType
  /** Any KV3 fields not explicitly modelled — preserved on round-trip */
  _extra?: Record<string, unknown>
}

export function defaultTextDesc(): TextDescObject {
  return { Text: '', FontSize: 14, FadeInDist: -1, FadeOutDist: -1, ShowBackground: true }
}

export function defaultPosition(): [number, number, number] {
  return [0, 0, 0]
}

export function defaultAngles(): [number, number, number] {
  return [0, 0, 0]
}

export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
