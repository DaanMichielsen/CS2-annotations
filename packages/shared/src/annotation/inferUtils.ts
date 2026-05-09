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

  // M1+M2 (always treated as jumpthrow in CS2; check before M2-only patterns)
  if (/m1[+\s]m2|m1m2|\blmb[+\s]rmb\b|left[+\s]right\s*click|both\s+clicks|both\s+mouse/.test(raw))
    return 'm1m2_jump'

  // M2 + jump (before plain M2 so "m2 jump" doesn't match \bm2\b first)
  if (/m2\s*jump|m2\s*jt\b|jump.{0,10}m2|\brmb\s+jump|\brmb\s*jt\b|right\s*click\s*jump/.test(raw))
    return 'm2_jump'

  // M2 only
  if (/\bm2\b|\brmb\b|right\s*click|\brclick\b|right\s*mouse/.test(raw))
    return 'm2'

  // W-Jumpthrow (check before plain jump so "w-jt" doesn't fall to stand_jump via \bjt\b)
  if (/\bw[-+\s]jump|\bw[-+\s]jt\b|\bwjump\b|\bwjt\b|\bw[+\s]space|\bw\s+jumpthrow|\bw-jumpthrow/.test(raw))
    return 'w_jump'

  // Crouched jumpthrow
  if (/crouch|\bduck\b|\bcjt\b/.test(raw))
    return 'crouch_jump'

  // Running jumpthrow (check before plain jump AND before plain run)
  if (/run\s*jt\b|run.{0,12}jump|jump.{0,12}run|\brunjump\b|run-jump|\brjt\b|running\s+jump/.test(raw))
    return 'run_jump'

  // Standing jumpthrow (\bjt\b is safe here — w_jump, m2_jump, run_jump are all caught above)
  if (/jumpthrow|\bjthrow\b|j-throw|\bj\s+throw\b|\bjt\b|jump\s+throw|jump-throw|standing\s+jump|stand\s+jt|\bjump\b/.test(raw))
    return 'stand_jump'

  // Ground movement (no jump)
  if (/\brun\b|running|\brunthrow\b|run\s+throw|run-throw/.test(raw)) return 'run'
  if (/\bwalk\b|walking|\bwalkthrow\b|walk\s+throw|walk-throw/.test(raw)) return 'walk'

  // Explicit stand / left-click — lmb with no other modifier is a standing throw
  if (/\bstand\b|standing|static|regular|normal|\blmb\b|left\s*click|\blclick\b|left\s*mouse/.test(raw))
    return 'stand'

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
