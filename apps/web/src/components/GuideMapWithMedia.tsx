'use client'
import { useState } from 'react'
import Image from 'next/image'
import type { AnnotationNode, GrenadeType, AnnotationMedia } from '@cs2ann/shared/web'
import InteractiveMapView from './InteractiveMapView'

const GRENADE_COLORS: Record<GrenadeType, string> = {
  smoke: '#94a3b8', flash: '#fde68a', he: '#f87171', molotov: '#fb923c', decoy: '#a3e635',
}
const GRENADE_ICON_FILES: Record<GrenadeType, string> = {
  smoke: '/nades/smoke.png', flash: '/nades/flash.png', he: '/nades/hegrenade.png',
  molotov: '/nades/molotov.png', decoy: '/nades/decoy.png',
}
const GRENADE_ORDER: GrenadeType[] = ['smoke', 'flash', 'he', 'molotov', 'decoy']

interface Props {
  nodes: AnnotationNode[]
  mapName: string | null | undefined
  media: AnnotationMedia[]
  className?: string
  filterTypes?: GrenadeType[]
}

function isMain(n: AnnotationNode) {
  return n.SubType !== 'aim_target' && n.SubType !== 'destination'
}

export default function GuideMapWithMedia({ nodes, mapName, media, className, filterTypes }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Set<GrenadeType>>(new Set())
  const [pinMode, setPinMode] = useState<'throw' | 'landing'>('throw')

  const mediaMap: Record<string, AnnotationMedia[]> = {}
  for (const m of media) {
    if (!mediaMap[m.nodeId]) mediaMap[m.nodeId] = []
    mediaMap[m.nodeId].push(m)
  }

  const mainGrenadeNodes = nodes.filter((n) => n.Type === 'grenade' && isMain(n))
  const byType = GRENADE_ORDER.reduce<Record<GrenadeType, AnnotationNode[]>>(
    (acc, gt) => { acc[gt] = mainGrenadeNodes.filter((n) => n.GrenadeType === gt); return acc },
    {} as Record<GrenadeType, AnnotationNode[]>
  )
  const activeTypes = GRENADE_ORDER.filter((gt) => byType[gt].length > 0)

  function toggleFilter(gt: GrenadeType) {
    setActiveFilters((prev) => { const n = new Set(prev); n.has(gt) ? n.delete(gt) : n.add(gt); return n })
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        {/* Grenade type chips */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {activeTypes.map((gt) => {
            const isActive = activeFilters.has(gt)
            return (
              <button key={gt} onClick={() => toggleFilter(gt)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors"
                style={isActive
                  ? { borderColor: GRENADE_COLORS[gt], backgroundColor: `${GRENADE_COLORS[gt]}18` }
                  : { borderColor: 'rgb(39 39 42)', backgroundColor: 'rgb(24 24 27 / 0.6)' }
                }>
                <Image src={GRENADE_ICON_FILES[gt]} alt={gt} width={15} height={15}
                  className={isActive ? 'opacity-100' : 'opacity-60'} unoptimized />
                <span className="text-xs font-data font-bold tabular-nums"
                  style={{ color: isActive ? GRENADE_COLORS[gt] : '#71717a' }}>
                  {byType[gt].length}
                </span>
              </button>
            )
          })}
        </div>

        {/* Pin mode toggle */}
        <button onClick={() => setPinMode((m) => m === 'throw' ? 'landing' : 'throw')}
          className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-data px-2 py-1 rounded hover:bg-zinc-800/60">
          📍 {pinMode === 'throw' ? 'Throw pos' : 'Landing pos'}
        </button>

        {/* Map toggle */}
        <button onClick={() => setExpanded((v) => !v)}
          className="shrink-0 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-data px-2 py-1 rounded hover:bg-zinc-800/60">
          {expanded ? '▲ Hide map' : '▼ Show map'}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800">
          <InteractiveMapView
            nodes={nodes}
            mapName={mapName}
            className={`h-[480px] sm:h-[560px] rounded-none border-0 ${className ?? ''}`}
            filterTypes={activeFilters.size > 0 ? [...activeFilters] : filterTypes}
            mediaMap={mediaMap}
            pinMode={pinMode}
            onTogglePin={() => setPinMode((m) => m === 'throw' ? 'landing' : 'throw')}
          />
        </div>
      )}
    </div>
  )
}
