'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { AnnotationMedia } from '@cs2ann/shared/web'
import { MediaViewer } from '@cs2ann/ui'

interface Props {
  guideId: string
  guideTitle: string
  nodeId: string
  label: string
  onClose(): void
}

export default function MediaDetailModal({ guideId, guideTitle, nodeId, label, onClose }: Props) {
  const [media, setMedia] = useState<AnnotationMedia[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/guides/${guideId}/media`)
      .then((r) => r.json())
      .then((data: AnnotationMedia[]) => { setMedia(data.filter((m) => m.nodeId === nodeId)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [guideId, nodeId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <p className="font-display font-semibold text-zinc-100 text-sm truncate">{label}</p>
            <p className="text-[0.65rem] text-zinc-500 mt-0.5 truncate">{guideTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-lg ml-3">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : media.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-8">No media available for this lineup.</p>
          ) : (
            <MediaViewer media={media} />
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 shrink-0">
          <Link href={`/guides/${guideId}`}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
            View full guide →
          </Link>
        </div>
      </div>
    </div>
  )
}
