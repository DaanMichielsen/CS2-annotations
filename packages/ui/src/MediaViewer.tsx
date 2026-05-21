'use client'
import { useState } from 'react'
import type { AnnotationMedia, MediaSlot } from '@cs2ann/shared'
import { SLOT_LABELS, resolveMediaForDisplay } from '@cs2ann/shared'

function ytId(url: string) {
  return url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1] ?? ''
}

function MediaItem({ media, maxHeight = 'max-h-64' }: { media: AnnotationMedia; maxHeight?: string }) {
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
    return <video src={media.url} controls className={`w-full rounded-lg ${maxHeight} bg-black`} />
  }
  const cb = media.cropBox as { x: number; y: number; w: number; h: number } | null
  const style: React.CSSProperties = cb
    ? { transform: `scale(${1 / cb.w})`, transformOrigin: `${(cb.x / (1 - cb.w)) * 100}% ${(cb.y / (1 - cb.h)) * 100}%` }
    : {}
  return (
    <div className={`overflow-hidden rounded-lg ${maxHeight}`}>
      <img src={media.url} alt={media.caption ?? ''} className="w-full object-cover" style={style} />
    </div>
  )
}

interface Props {
  media: AnnotationMedia[]
  maxHeight?: string
}

export default function MediaViewer({ media, maxHeight }: Props) {
  const { primary, bySlot } = resolveMediaForDisplay(media)
  const slotTabs = (['standing', 'aim', 'landing'] as MediaSlot[]).filter((s) => bySlot[s])
  const [activeSlot, setActiveSlot] = useState<MediaSlot>('standing')

  if (!primary) return null

  // full slot: show directly, no tabs
  if (bySlot.full) {
    return (
      <div className="flex flex-col gap-2">
        <MediaItem media={bySlot.full} maxHeight={maxHeight} />
        {bySlot.full.caption && <p className="text-[0.7rem] text-zinc-500 italic">{bySlot.full.caption}</p>}
      </div>
    )
  }

  // individual slots with tab bar
  const shown = bySlot[activeSlot] ?? bySlot[slotTabs[0]]
  return (
    <div className="flex flex-col gap-2">
      {slotTabs.length > 1 && (
        <div className="flex gap-1">
          {slotTabs.map((s) => (
            <button key={s} type="button" onClick={() => setActiveSlot(s)}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${activeSlot === s ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
              {SLOT_LABELS[s]}
            </button>
          ))}
        </div>
      )}
      {shown && <MediaItem media={shown} maxHeight={maxHeight} />}
      {shown?.caption && <p className="text-[0.7rem] text-zinc-500 italic">{shown.caption}</p>}
    </div>
  )
}
