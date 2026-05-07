'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { AnnotationNode, GrenadeType } from '@cs2ann/shared/web'
import { MAP_DATA, worldToPixel } from '@/lib/mapData'

interface Props {
  nodes: AnnotationNode[]
  mapName: string | null | undefined
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

export default function GuideAnnotationPreview({ nodes, mapName }: Props) {
  const [expanded, setExpanded] = useState(false)

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

  const otherNodes = nodes.filter((n) => n.Type !== 'grenade' && isMainNode(n))
  const activeTypes = GRENADE_ORDER.filter((gt) => byType[gt].length > 0)

  const dots = mapData
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
        {/* Map radar thumbnail */}
        {mapData && (
          <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-zinc-700/60 shrink-0">
            <Image
              src={`/maps/radars/${mapData.file}`}
              alt={mapName ?? 'map'}
              fill
              className="object-cover opacity-70"
              unoptimized
            />
            {/* Mini dots overlay */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {dots.map((d, i) => (
                <circle key={i} cx={d.xPct} cy={d.yPct} r={3} fill={d.color} opacity={0.9} />
              ))}
            </svg>
          </div>
        )}

        {/* Grenade type chips */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {activeTypes.map((gt) => (
            <div
              key={gt}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900/60"
            >
              <Image
                src={GRENADE_ICON_FILES[gt]}
                alt={GRENADE_LABELS[gt]}
                width={16}
                height={16}
                className="opacity-85"
                unoptimized
              />
              <span className="text-xs font-data font-bold tabular-nums" style={{ color: GRENADE_COLORS[gt] }}>
                {byType[gt].length}
              </span>
              <span className="text-xs text-zinc-500 font-display hidden sm:inline">{GRENADE_LABELS[gt]}</span>
            </div>
          ))}
          {otherNodes.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900/60">
              <span className="text-xs font-data font-bold text-zinc-500 tabular-nums">{otherNodes.length}</span>
              <span className="text-xs text-zinc-600 hidden sm:inline">other</span>
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-data px-2 py-1 rounded hover:bg-zinc-800/60"
        >
          {expanded ? '▲ Hide' : '▼ Show all'}
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-zinc-800 px-5 py-5 space-y-6">
          {/* Map radar + type list */}
          <div className="flex flex-col sm:flex-row gap-5">
            {mapData && (
              <div className="shrink-0 sm:w-64">
                <div
                  className="relative aspect-square w-full rounded-xl overflow-hidden border border-zinc-800"
                  style={{ background: '#09090f' }}
                >
                  <Image
                    src={`/maps/radars/${mapData.file}`}
                    alt={mapName ?? 'map'}
                    fill
                    className="object-cover opacity-55"
                    unoptimized
                  />
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {dots.map((d, i) => (
                      <circle
                        key={i}
                        cx={d.xPct}
                        cy={d.yPct}
                        r={1.4}
                        fill={d.color}
                        stroke="rgba(0,0,0,0.5)"
                        strokeWidth={0.3}
                        opacity={0.92}
                      />
                    ))}
                  </svg>
                </div>
              </div>
            )}

            <div className="flex-1 grid grid-cols-1 gap-2 content-start">
              {activeTypes.map((gt) => (
                <div
                  key={gt}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40"
                >
                  <Image
                    src={GRENADE_ICON_FILES[gt]}
                    alt={GRENADE_LABELS[gt]}
                    width={18}
                    height={18}
                    className="opacity-85 shrink-0"
                    unoptimized
                  />
                  <span className="text-sm text-zinc-300 font-display font-semibold flex-1">
                    {GRENADE_LABELS[gt]}
                  </span>
                  <span className="text-sm font-data font-bold tabular-nums" style={{ color: GRENADE_COLORS[gt] }}>
                    {byType[gt].length}
                  </span>
                </div>
              ))}
              {otherNodes.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40">
                  <div className="w-[18px] h-[18px] shrink-0 flex items-center justify-center text-zinc-500 text-xs">⬡</div>
                  <span className="text-sm text-zinc-400 font-display flex-1">Other</span>
                  <span className="text-sm font-data font-bold tabular-nums text-zinc-500">{otherNodes.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Annotation list */}
          <div className="space-y-4">
            {activeTypes.map((gt) => (
              <div key={gt}>
                <div className="flex items-center gap-2 mb-2">
                  <Image
                    src={GRENADE_ICON_FILES[gt]}
                    alt={GRENADE_LABELS[gt]}
                    width={13}
                    height={13}
                    className="opacity-70"
                    unoptimized
                  />
                  <span
                    className="text-xs font-data uppercase tracking-widest font-semibold"
                    style={{ color: GRENADE_COLORS[gt] }}
                  >
                    {GRENADE_LABELS[gt]}
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: `${GRENADE_COLORS[gt]}22` }} />
                  <span className="text-xs font-data text-zinc-600">{byType[gt].length}</span>
                </div>

                <div className="space-y-1 pl-1">
                  {byType[gt].map((node, i) => {
                    const title = node.Title?.Text?.trim()
                    const desc = node.Desc?.Text?.trim()
                    return (
                      <div
                        key={node.Id ?? i}
                        className="flex items-start gap-3 px-3 py-2 rounded-lg bg-zinc-900/30 border border-zinc-800/50"
                      >
                        <span
                          className="mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: GRENADE_COLORS[gt] }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-200 font-display font-medium leading-snug truncate">
                            {title || `${GRENADE_LABELS[gt]} ${i + 1}`}
                          </p>
                          {desc && (
                            <p className="text-xs text-zinc-500 mt-0.5 truncate">{desc}</p>
                          )}
                        </div>
                        {node.JumpThrow && (
                          <span className="ml-auto shrink-0 text-[0.6rem] font-data uppercase tracking-widest px-1.5 py-0.5 rounded bg-violet-900/40 text-violet-400 border border-violet-800/40">
                            jump
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {otherNodes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-data uppercase tracking-widest text-zinc-600 font-semibold">Other</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-xs font-data text-zinc-600">{otherNodes.length}</span>
                </div>
                <div className="space-y-1 pl-1">
                  {otherNodes.map((node, i) => (
                    <div
                      key={node.Id ?? i}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900/30 border border-zinc-800/50"
                    >
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-zinc-600" />
                      <p className="text-sm text-zinc-400 font-display truncate">
                        {node.Title?.Text?.trim() || node.Type}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
