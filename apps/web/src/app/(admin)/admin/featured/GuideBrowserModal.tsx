'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { searchPublicGuides, addFeaturedGuide } from './actions'
import { getMapColor, getMapLabel, KNOWN_MAPS } from '@/lib/mapColors'

interface Guide {
  id: string
  title: string
  map: string | null
  nodeCount: number
  user: { username: string | null; name: string | null }
  featuredGuide: { id: string } | null
}

interface Props {
  featuredGuideIds: Set<string>
  onClose: () => void
}

export default function GuideBrowserModal({ featuredGuideIds, onClose }: Props) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [map, setMap] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [guides, setGuides] = useState<Guide[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const result = await searchPublicGuides(q, map, page)
      setGuides(result.guides as Guide[])
      setTotalPages(result.totalPages)
    })
  }, [q, map, page])

  function handleAdd(guideId: string) {
    startTransition(async () => {
      await addFeaturedGuide(guideId)
      router.refresh()
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="font-display font-bold text-lg text-white">Add featured guide</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-zinc-800 shrink-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setMap(null); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                !map ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All maps
            </button>
            {KNOWN_MAPS.map((m) => {
              const { accent } = getMapColor(m)
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMap(map === m ? null : m); setPage(1) }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    map === m ? 'text-white border-transparent font-semibold' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={map === m ? { backgroundColor: accent, borderColor: accent } : undefined}
                >
                  {getMapLabel(m)}
                </button>
              )
            })}
          </div>
          <input
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            placeholder="Search guides…"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Guide grid */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {isPending && (
            <p className="text-zinc-500 text-sm text-center py-8">Loading…</p>
          )}
          {!isPending && guides.length === 0 && (
            <p className="text-zinc-600 text-sm text-center py-8">No guides found.</p>
          )}
          {!isPending && guides.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {guides.map((g) => {
                const alreadyFeatured = featuredGuideIds.has(g.id)
                const { accent, dim } = getMapColor(g.map)
                return (
                  <button
                    key={g.id}
                    type="button"
                    disabled={alreadyFeatured || isPending}
                    onClick={() => handleAdd(g.id)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      alreadyFeatured
                        ? 'border-zinc-700/50 bg-zinc-800/30 opacity-50 cursor-not-allowed'
                        : 'border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/60 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-[0.6rem] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                        style={{ color: accent, backgroundColor: dim }}
                      >
                        {g.map ? getMapLabel(g.map) : '—'}
                      </span>
                      {alreadyFeatured && (
                        <span className="text-[0.6rem] text-violet-400">Featured</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-zinc-100 leading-snug mb-1 line-clamp-2">
                      {g.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {g.user.username ?? g.user.name} · {g.nodeCount} nodes
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-zinc-800 shrink-0">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded disabled:opacity-40 transition-colors"
            >
              Prev
            </button>
            <span className="text-sm text-zinc-500">{page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
