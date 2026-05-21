'use client'
import type { AnnotationMedia } from '@cs2ann/shared/web'
import { MediaViewer } from '@cs2ann/ui'

interface Props {
  media: AnnotationMedia[]
}

export default function MediaPanel({ media }: Props) {
  return (
    <aside className="w-80 shrink-0 border-l border-zinc-800 flex flex-col bg-zinc-900 overflow-y-auto">
      {media.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-zinc-600 text-center px-4">
            Click a pin on the map to view media
          </p>
        </div>
      ) : (
        <div className="p-4">
          <MediaViewer media={media} maxHeight="max-h-80" />
        </div>
      )}
    </aside>
  )
}
