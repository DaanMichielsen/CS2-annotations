'use client'
import { useState } from 'react'
import type { AnnotationMedia, MediaSlot } from '@cs2ann/shared'
import { SLOT_LABELS } from '@cs2ann/shared'

interface Props {
  mediaBySlot: Partial<Record<MediaSlot, AnnotationMedia>>
  notes?: string | null
}

function ytId(url: string) {
  return url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1] ?? ''
}

function MediaItem({ media }: { media: AnnotationMedia }) {
  if (media.source === 'youtube') {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${ytId(media.url)}`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }
  if (media.mediaType === 'video') {
    return (
      <video src={media.url} controls className="w-full rounded-lg max-h-64 bg-black"
        ref={(el) => { if (el && media.speedRate && media.speedRate !== 1) el.playbackRate = media.speedRate }} />
    )
  }
  const cb = media.cropBox as { x: number; y: number; w: number; h: number } | null
  const style: React.CSSProperties = cb
    ? { transform: `scale(${1 / cb.w})`, transformOrigin: `${(cb.x / (1 - cb.w)) * 100}% ${(cb.y / (1 - cb.h)) * 100}%` }
    : {}
  return (
    <div className="overflow-hidden rounded-lg max-h-64">
      <img src={media.url} alt={media.caption ?? ''} className="w-full object-cover" style={style} />
    </div>
  )
}

export default function MediaViewer({ mediaBySlot, notes }: Props) {
  const slots = (['standing', 'aim', 'landing'] as MediaSlot[]).filter((s) => mediaBySlot[s])
  const [active, setActive] = useState<MediaSlot>(slots[0] ?? 'standing')
  if (slots.length === 0) return null
  const media = mediaBySlot[active]
  return (
    <div className="flex flex-col gap-3">
      {slots.length > 1 && (
        <div className="flex gap-1">
          {slots.map((s) => (
            <button key={s} type="button" onClick={() => setActive(s)}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${active === s ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
              {SLOT_LABELS[s]}
            </button>
          ))}
        </div>
      )}
      {media && <MediaItem media={media} />}
      {media?.caption && <p className="text-[0.7rem] text-zinc-500 italic">{media.caption}</p>}
      {notes && <p className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-800 pt-2">{notes}</p>}
    </div>
  )
}
