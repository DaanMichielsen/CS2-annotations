/**
 * Utilities for inferring semantic categories from annotation node data.
 * These are display-only — nothing here is persisted to disk.
 *
 * Throw type patterns derived from mirage_essentials.txt:
 *   "standing throw", "running throw", "walking throw"
 *   "standing Jumpthrow", "running Jumpthrow"
 *   "standing W-Jumpthrow"
 *   "crouched Jumpthrow", "crouch-walking Jumpthrow"
 *   "standing M2 throw"
 *   "standing M2 Jumpthrow"
 *   "standing M1+M2 Jumpthrow"
 */

import type { AnnotationNode } from './types'

// ── Color categories ──────────────────────────────────────────────────────────
export type ColorCategory = 'instant' | 't_side' | 'ct_side' | 'unknown'

const INSTANT_RGB: [number, number, number] = [200, 70, 180]
const T_SIDE_RGB: [number, number, number] = [250, 230, 3]
const CT_SIDE_RGB: [number, number, number] = [60, 150, 230]
const COLOR_THRESHOLD = 70

function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

export function inferColorCategory(color?: [number, number, number]): ColorCategory {
  if (!color) return 'unknown'
  const candidates: [ColorCategory, number][] = [
    ['instant', colorDist(color, INSTANT_RGB)],
    ['t_side', colorDist(color, T_SIDE_RGB)],
    ['ct_side', colorDist(color, CT_SIDE_RGB)],
  ]
  const [best, dist] = candidates.reduce((a, b) => (a[1] < b[1] ? a : b))
  return dist <= COLOR_THRESHOLD ? best : 'unknown'
}

export const COLOR_CATEGORY_LABELS: Record<ColorCategory, string> = {
  instant: '⚡ Instant',
  t_side: '🟡 T-side',
  ct_side: '🔵 CT-side',
  unknown: '○ Other',
}

export const COLOR_CATEGORY_SHORT: Record<ColorCategory, string> = {
  instant: '⚡',
  t_side: 'T',
  ct_side: 'CT',
  unknown: '?',
}

// ── Throw types ───────────────────────────────────────────────────────────────
export type ThrowType =
  | 'stand'        // "standing throw"
  | 'run'          // "running throw"
  | 'walk'         // "walking throw"
  | 'stand_jump'   // "standing Jumpthrow"
  | 'run_jump'     // "running Jumpthrow"
  | 'w_jump'       // "standing W-Jumpthrow"
  | 'crouch_jump'  // "crouched Jumpthrow" / "crouch-walking Jumpthrow"
  | 'm2'           // "standing M2 throw"
  | 'm2_jump'      // "standing M2 Jumpthrow"
  | 'm1m2_jump'    // "standing M1+M2 Jumpthrow"
  | 'other'        // multi-step or unrecognised

export function inferThrowType(node: AnnotationNode): ThrowType {
  const raw = ((node.Desc?.Text ?? '') + ' ' + (node.Title?.Text ?? '')).toLowerCase()

  // M2 variants (most specific first)
  if (/m1[+\s]m2/.test(raw)) return 'm1m2_jump'
  if (/m2.{0,8}jump|jump.{0,8}m2/.test(raw)) return 'm2_jump'
  if (/\bm2\b/.test(raw)) return 'm2'

  // W-Jumpthrow
  if (/w[-+\s]jump/.test(raw)) return 'w_jump'

  // Crouched variants
  if (/crouch/.test(raw)) return 'crouch_jump'

  // Jumpthrow with movement modifier
  if (/run.{0,12}jump|jump.{0,12}run/.test(raw)) return 'run_jump'

  // Plain jumpthrow (standing or unqualified)
  if (/jump/.test(raw)) return 'stand_jump'

  // Non-jump throws
  if (/run/.test(raw)) return 'run'
  if (/walk/.test(raw)) return 'walk'
  if (/stand|static/.test(raw)) return 'stand'

  return 'other'
}

export const THROW_TYPE_LABEL: Record<ThrowType, string> = {
  stand:       'Standing throw',
  run:         'Running throw',
  walk:        'Walking throw',
  stand_jump:  'Standing Jumpthrow',
  run_jump:    'Running Jumpthrow',
  w_jump:      'W-Jumpthrow',
  crouch_jump: 'Crouched Jumpthrow',
  m2:          'M2 throw',
  m2_jump:     'M2 Jumpthrow',
  m1m2_jump:   'M1+M2 Jumpthrow',
  other:       'Other / complex',
}

export const THROW_TYPE_SHORT: Record<ThrowType, string> = {
  stand:       'Stand',
  run:         'Run',
  walk:        'Walk',
  stand_jump:  'JT',
  run_jump:    'Run JT',
  w_jump:      'W-JT',
  crouch_jump: 'Crouch JT',
  m2:          'M2',
  m2_jump:     'M2 JT',
  m1m2_jump:   'M1+M2 JT',
  other:       '?',
}
