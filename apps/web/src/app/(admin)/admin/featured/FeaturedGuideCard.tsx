'use client'

import { useState, useTransition } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getMapColor, getMapLabel } from '@/lib/mapColors'
import { removeFeaturedGuide, updateGuideCredits } from './actions'

interface Credit {
  id: string
  handle: string
  label: string | null
  position: number
}

export interface FeaturedItem {
  id: string
  guideId: string
  position: number
  guide: {
    id: string
    title: string
    map: string | null
    nodeCount: number
    user: { username: string | null; name: string | null }
    credits: Credit[]
  }
}

export default function FeaturedGuideCard({ item }: { item: FeaturedItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const [creditsOpen, setCreditsOpen] = useState(false)
  const [credits, setCredits] = useState(
    item.guide.credits.map((c) => ({ handle: c.handle, label: c.label ?? '' }))
  )
  const [isPending, startTransition] = useTransition()

  const { accent, dim } = getMapColor(item.guide.map)

  function handleSaveCredits() {
    startTransition(async () => {
      await updateGuideCredits(
        item.guideId,
        credits.map((c) => ({ handle: c.handle, label: c.label || undefined }))
      )
      setCreditsOpen(false)
    })
  }

  function handleRemove() {
    startTransition(async () => {
      await removeFeaturedGuide(item.guideId)
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-zinc-900 border border-zinc-800 rounded-lg"
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-3 py-3">
        {/* Drag handle */}
        <button
          type="button"
          className="shrink-0 text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
            <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
          </svg>
        </button>

        {/* Colour accent bar */}
        <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: accent }} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span
              className="text-[0.6rem] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
              style={{ color: accent, backgroundColor: dim }}
            >
              {getMapLabel(item.guide.map)}
            </span>
            {credits.map((c, i) => (
              <span
                key={i}
                className="text-[0.6rem] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700"
              >
                {c.label || c.handle}
              </span>
            ))}
          </div>
          <p className="text-sm font-semibold text-zinc-100 leading-snug truncate">
            {item.guide.title}
          </p>
          <p className="text-xs text-zinc-500">
            {item.guide.user.username ?? item.guide.user.name}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCreditsOpen((v) => !v)}
            className="text-xs px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded transition-colors"
          >
            Credits {creditsOpen ? '↑' : '↓'}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleRemove}
            className="text-zinc-600 hover:text-red-400 transition-colors p-1.5 disabled:opacity-40"
            title="Remove from featured"
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Credits section */}
      {creditsOpen && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
          <p className="text-xs text-zinc-500 mb-3">
            Credits are shown below the guide name in the desktop app and on the guide detail page.
          </p>
          <div className="space-y-2">
            {credits.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={c.handle}
                  onChange={(e) =>
                    setCredits((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x))
                    )
                  }
                  placeholder="@handle or URL (e.g. twitch.tv/username)"
                  className="flex-1 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
                <input
                  type="text"
                  value={c.label}
                  onChange={(e) =>
                    setCredits((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                    )
                  }
                  placeholder="Display name (optional)"
                  className="w-40 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => setCredits((prev) => prev.filter((_, j) => j !== i))}
                  className="text-zinc-600 hover:text-red-400 p-1 transition-colors shrink-0"
                >
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCredits((prev) => [...prev, { handle: '', label: '' }])}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              + Add credit
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveCredits}
              className="text-xs px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded transition-colors disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save credits'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
