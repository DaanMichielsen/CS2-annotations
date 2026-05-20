import type { AnnotationMedia, MediaSlot } from './mediaTypes'

const DISPLAY_PRIORITY: MediaSlot[] = ['full', 'standing', 'aim', 'landing']

export function resolveMediaForDisplay(media: AnnotationMedia[]): {
  primary: AnnotationMedia | null
  bySlot: Partial<Record<MediaSlot, AnnotationMedia>>
} {
  const bySlot: Partial<Record<MediaSlot, AnnotationMedia>> = {}
  for (const m of media) {
    if (!bySlot[m.slot]) bySlot[m.slot] = m
  }
  const primary = DISPLAY_PRIORITY.map((s) => bySlot[s]).find(Boolean) ?? null
  return { primary, bySlot }
}
