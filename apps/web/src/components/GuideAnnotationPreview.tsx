'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { AnnotationNode, GrenadeType, AnnotationMedia } from '@cs2ann/shared/web'
import { MAP_DATA, worldToPixel } from '@/lib/mapData'
import InteractiveMapView from './InteractiveMapView'

interface Props {
  nodes: AnnotationNode[]
  mapName: string | null | undefined
  mediaMap?: Record<string, AnnotationMedia[]>
}

const GRENADE_COLORS: Record<GrenadeType, string> = {
  smoke:   '#94a3b8',
  flash:   '#fde68a',
  he:      '#f87171',
  molotov: '#fb923c',
  decoy:   '#a3e635',
}

const GRENADE_LABELS: Record<GrenadeType, string> = {
  smoke:   'Smoke',
  flash:   'Flash',
  he:      'HE Grenade',
  molotov: 'Molotov',
  decoy:   'Decoy',
}

const GRENADE_ICON_FILES: Record<GrenadeType, string> = {
  smoke:   '/nades/smoke.png',
  flash:   '/nades/flash.png',
  he:      '/nades/hegrenade.png',
  molotov: '/nades/molotov.png',
  decoy:   '/nades/decoy.png',
}

const GRENADE_ORDER: GrenadeType[] = ['smoke', 'flash', 'he', 'molotov', 'decoy']

function isMainNode(node: AnnotationNode): boolean {
  return node.SubType !== 'aim_target' && node.SubType !== 'destination'
}

export default function GuideAnnotationPreview({ nodes, mapName, mediaMap }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Set<GrenadeType>>(new Set())

  const toggleFilter = (gt: GrenadeType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(gt)) next.delete(gt)
      else next.add(gt)
      return next
    })
  }

  const mapData = mapName ? MAP_DATA[mapName.toLowerCase()] : null

  const mainGrenadeNodes = nodes.filter(
    (n) => n.Type === 'grenade' && isMainNode(n)
  )

  const byType = GRENADE_ORDER.reduce<Record<GrenadeType, AnnotationNode[]>>(
    (acc, gt) => {
      acc[gt] = mainGrenadeNodes.filter((n) => n.GrenadeType === gt)
      return acc
    },
    {} as Record<GrenadeType, AnnotationNode[]>
  )

  const activeTypes = GRENADE_ORDER.filter((gt) => byType[gt].length > 0)
  const otherNodes  = nodes.filter((n) => n.Type !== 'grenade' && isMainNode(n))

  // Mini radar dots for the thumbnail
  const miniDots = mapData
    ? mainGrenadeNodes
        .filter((n) => n.Position && n.GrenadeType)
        .map((n) => {
          const { x, y } = worldToPixel(n.Position![0], n.Position![1], mapData)
          return {
            xPct: (x / 800) * 100,
            yPct: (y / 800) * 100,
            color: GRENADE_COLORS[n.GrenadeType!] ?? '#8b5cf6',
          }
        })
        .filter((d) => d.xPct >= 0 && d.xPct <= 100 && d.yPct >= 0 && d.yPct <= 100)
    : []

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-8 text-center">
        <p className="text-zinc-600 text-sm font-data">No annotation data available</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
      {/* Summary row — always visible */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        {/* Mini radar thumbnail */}
        {mapData && (
          <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-700/60 shrink-0">
            <Image
              src={`/maps/radars/${mapData.file}`}
              alt={mapName ?? 'map'}
              fill
              className="object-cover opacity-60"
              unoptimized
            />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {miniDots.map((d, i) => (
                <circle key={i} cx={d.xPct} cy={d.yPct} r={3.5} fill={d.color} opacity={0.9} />
              ))}
            </svg>
          </div>
        )}

        {/* Grenade type chips */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {activeTypes.map((gt) => {
            const isActive = activeFilters.has(gt)
            return (
              <button
                key={gt}
                onClick={() => toggleFilter(gt)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors"
                style={
                  isActive
                    ? { borderColor: GRENADE_COLORS[gt], backgroundColor: `${GRENADE_COLORS[gt]}18` }
                    : { borderColor: 'rgb(39 39 42)', backgroundColor: 'rgb(24 24 27 / 0.6)' }
                }
              >
                <Image
                  src={GRENADE_ICON_FILES[gt]}
                  alt={GRENADE_LABELS[gt]}
                  width={15}
                  height={15}
                  className={isActive ? 'opacity-100' : 'opacity-60'}
                  unoptimized
                />
                <span
                  className="text-xs font-data font-bold tabular-nums"
                  style={{ color: isActive ? GRENADE_COLORS[gt] : '#71717a' }}
                >
                  {byType[gt].length}
                </span>
                <span className={`text-xs font-display hidden sm:inline ${isActive ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {GRENADE_LABELS[gt]}
                </span>
              </button>
            )
          })}
          {otherNodes.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900/60">
              <span className="text-xs font-data font-bold text-zinc-500 tabular-nums">{otherNodes.length}</span>
              <span className="text-xs text-zinc-600 hidden sm:inline">other</span>
            </div>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-data px-2 py-1 rounded hover:bg-zinc-800/60"
        >
          {expanded ? '▲ Hide map' : '▼ Show map'}
        </button>
      </div>

      {/* Interactive map */}
      {expanded && (
        <div className="border-t border-zinc-800">
          <InteractiveMapView
            nodes={nodes}
            mapName={mapName}
            className="h-[480px] sm:h-[560px] rounded-none border-0"
            filterTypes={activeFilters.size > 0 ? [...activeFilters] : undefined}
            mediaMap={mediaMap}
          />
        </div>
      )}
    </div>
  )
}
