'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getMapColor, getMapLabel } from '@/lib/mapColors'
import { THROW_TYPE_SHORT } from '@cs2ann/shared/web'
import type { ThrowType } from '@cs2ann/shared/web'
import MediaDetailModal from './MediaDetailModal'

const GRENADE_ICONS: Record<string, string> = {
  smoke:      '/nades/smoke.png',
  flash:      '/nades/flash.png',
  he:         '/nades/hegrenade.png',
  molotov:    '/nades/molotov.png',
  incendiary: '/nades/molotov.png',
  decoy:      '/nades/decoy.png',
}

interface Props {
  guideId: string
  nodeId: string
  map: string
  grenadeType: string
  throwType: string
  aimLabel: string | null
  posLabel: string | null
  guideTitle: string
  hasMedia: boolean
  landingThumb: string | null
}

export default function LibraryCard({
  guideId, nodeId, map, grenadeType, throwType,
  aimLabel, posLabel, guideTitle, hasMedia, landingThumb,
}: Props) {
  const [showMedia, setShowMedia] = useState(false)
  const { accent, dim, icon: mapIcon } = getMapColor(map)
  const mapLabel = getMapLabel(map)
  const grenadeIcon = GRENADE_ICONS[grenadeType]
  const throwShort = THROW_TYPE_SHORT[throwType as ThrowType] ?? throwType
  const label = aimLabel ?? posLabel ?? 'Lineup'

  return (
    <>
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors flex flex-col">
        {landingThumb && (
          <div className="relative w-full h-24 bg-zinc-800 shrink-0">
            <Image src={landingThumb} alt="Landing" fill className="object-cover opacity-80" unoptimized />
          </div>
        )}

        <div className="p-4 flex flex-col gap-3 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="flex items-center gap-1 text-[0.6rem] font-data uppercase tracking-widest px-2 py-0.5 rounded font-semibold"
              style={{ backgroundColor: dim, color: accent }}
            >
              {mapIcon && (
                <Image src={mapIcon} alt="" width={10} height={10} className="opacity-80" unoptimized />
              )}
              {mapLabel}
            </div>
            {grenadeIcon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={grenadeIcon} alt={grenadeType} width={16} height={16} className="opacity-80" />
            )}
            <span className="text-[0.65rem] font-data px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
              {throwShort}
            </span>
            {hasMedia && (
              <button
                type="button"
                onClick={() => setShowMedia(true)}
                className="ml-auto text-[0.65rem] text-violet-400 hover:text-violet-300 transition-colors"
                title="View media"
              >
                📷
              </button>
            )}
          </div>

          <div
            className={`flex-1 ${hasMedia ? 'cursor-pointer' : ''}`}
            onClick={hasMedia ? () => setShowMedia(true) : undefined}
          >
            {aimLabel && (
              <p className="font-display font-semibold text-zinc-100 text-sm leading-tight mb-1 truncate">
                {aimLabel}
              </p>
            )}
            {posLabel && (
              <p className="text-xs text-zinc-500 truncate">{posLabel}</p>
            )}
          </div>

          <Link
            href={`/guides/${guideId}`}
            className="text-[0.68rem] text-zinc-600 hover:text-violet-400 transition-colors truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {guideTitle} →
          </Link>
        </div>
      </div>

      {showMedia && (
        <MediaDetailModal
          guideId={guideId}
          guideTitle={guideTitle}
          nodeId={nodeId}
          label={label}
          onClose={() => setShowMedia(false)}
        />
      )}
    </>
  )
}
