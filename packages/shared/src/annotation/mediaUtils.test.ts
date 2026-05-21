import { describe, it, expect } from 'vitest'
import { resolveMediaForDisplay } from './mediaUtils'
import type { AnnotationMedia } from './mediaTypes'

function make(slot: string, id = slot): AnnotationMedia {
  return {
    id, guideId: 'g1', nodeId: 'n1', uploadedBy: 'u1',
    slot: slot as AnnotationMedia['slot'], mediaType: 'video',
    source: 'upload', url: 'http://x', position: 0, createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('resolveMediaForDisplay', () => {
  it('returns full as primary when present', () => {
    const { primary } = resolveMediaForDisplay([make('standing'), make('full')])
    expect(primary?.slot).toBe('full')
  })

  it('falls back to standing when no full', () => {
    const { primary } = resolveMediaForDisplay([make('landing'), make('standing')])
    expect(primary?.slot).toBe('standing')
  })

  it('falls back through priority order: aim before landing', () => {
    const { primary } = resolveMediaForDisplay([make('landing'), make('aim')])
    expect(primary?.slot).toBe('aim')
  })

  it('returns null primary when array is empty', () => {
    const { primary } = resolveMediaForDisplay([])
    expect(primary).toBeNull()
  })

  it('bySlot holds first item per slot', () => {
    const first = make('aim', 'aim-first')
    const second = { ...make('aim', 'aim-second') }
    const { bySlot } = resolveMediaForDisplay([first, second])
    expect(bySlot.aim?.id).toBe('aim-first')
  })
})
