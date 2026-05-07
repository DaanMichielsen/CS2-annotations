import Image from 'next/image'
import type { AnnotationNode, GrenadeType } from '@cs2ann/shared/web'
import { MAP_DATA, worldToPixel } from '@/lib/mapData'
import { getMapColor } from '@/lib/mapColors'

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
  const mapData = mapName ? MAP_DATA[mapName.toLowerCase()] : null
  const { accent } = getMapColor(mapName)

  // Only main grenade nodes for the radar dots + list
  const mainGrenadeNodes = nodes.filter(
    (n) => n.Type === 'grenade' && isMainNode(n)
  )

  // Group by grenade type
  const byType = GRENADE_ORDER.reduce<Record<GrenadeType, AnnotationNode[]>>(
    (acc, gt) => {
      acc[gt] = mainGrenadeNodes.filter((n) => n.GrenadeType === gt)
      return acc
    },
    {} as Record<GrenadeType, AnnotationNode[]>
  )

  // Other node types (position, text, line, spot)
  const otherNodes = nodes.filter((n) => n.Type !== 'grenade' && isMainNode(n))

  const hasContent = nodes.length > 0

  if (!hasContent) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-10 text-center">
        <p className="text-zinc-600 text-sm font-data">No annotation data available</p>
      </div>
    )
  }

  // Compute dot positions (percentage of 800×800 coordinate space)
  const dots = mapData
    ? mainGrenadeNodes
        .filter((n) => n.Position && n.GrenadeType)
        .map((n) => {
          const { x, y } = worldToPixel(n.Position![0], n.Position![1], mapData)
          return {
            xPct: (x / 800) * 100,
            yPct: (y / 800) * 100,
            color: GRENADE_COLORS[n.GrenadeType!] ?? accent,
            label: n.Title?.Text ?? '',
          }
        })
        .filter((d) => d.xPct >= 0 && d.xPct <= 100 && d.yPct >= 0 && d.yPct <= 100)
    : []

  const mapImageSrc = mapData ? `/maps/${mapData.file}` : null

  return (
    <div className="space-y-6">
      {/* Map radar + stats row */}
      <div className="flex flex-col sm:flex-row gap-5">
        {/* Radar preview */}
        <div className="shrink-0 sm:w-72">
          <div
            className="relative aspect-square w-full rounded-xl overflow-hidden border border-zinc-800"
            style={{ background: 'rgba(9,9,15,0.8)' }}
          >
            {mapImageSrc ? (
              <Image
                src={mapImageSrc}
                alt={mapName ?? 'map'}
                fill
                className="object-cover opacity-60"
                unoptimized
              />
            ) : (
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 32px), repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 32px)',
                }}
              />
            )}

            {/* SVG dot overlay */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {dots.map((dot, i) => (
                <g key={i}>
                  <circle
                    cx={dot.xPct}
                    cy={dot.yPct}
                    r={1.6}
                    fill={dot.color}
                    stroke="rgba(0,0,0,0.6)"
                    strokeWidth={0.4}
                    opacity={0.92}
                  />
                </g>
              ))}
            </svg>

            {/* Legend */}
            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
              {GRENADE_ORDER.filter((gt) => byType[gt].length > 0).map((gt) => (
                <div
                  key={gt}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6rem] font-data"
                  style={{ backgroundColor: 'rgba(9,9,15,0.75)', color: GRENADE_COLORS[gt] }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: GRENADE_COLORS[gt] }}
                  />
                  {byType[gt].length}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grenade type summary cards */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-1 gap-2 content-start">
          {GRENADE_ORDER.filter((gt) => byType[gt].length > 0).map((gt) => (
            <div
              key={gt}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40"
            >
              <Image
                src={GRENADE_ICON_FILES[gt]}
                alt={GRENADE_LABELS[gt]}
                width={20}
                height={20}
                className="opacity-85 shrink-0"
                unoptimized
              />
              <span className="text-sm text-zinc-300 font-display font-semibold flex-1">
                {GRENADE_LABELS[gt]}
              </span>
              <span
                className="text-sm font-data font-bold tabular-nums"
                style={{ color: GRENADE_COLORS[gt] }}
              >
                {byType[gt].length}
              </span>
            </div>
          ))}
          {otherNodes.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40">
              <div className="w-5 h-5 shrink-0 flex items-center justify-center text-zinc-500 text-xs">⬡</div>
              <span className="text-sm text-zinc-400 font-display flex-1">Other</span>
              <span className="text-sm font-data font-bold tabular-nums text-zinc-500">
                {otherNodes.length}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Annotation list grouped by type */}
      <div className="space-y-4">
        {GRENADE_ORDER.filter((gt) => byType[gt].length > 0).map((gt) => (
          <div key={gt}>
            {/* Section header */}
            <div className="flex items-center gap-2 mb-2">
              <Image
                src={GRENADE_ICON_FILES[gt]}
                alt={GRENADE_LABELS[gt]}
                width={16}
                height={16}
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

            {/* Node list */}
            <div className="space-y-1 pl-1">
              {byType[gt].map((node, i) => {
                const title = node.Title?.Text?.trim()
                const desc = node.Desc?.Text?.trim()
                return (
                  <div
                    key={node.Id ?? i}
                    className="flex items-start gap-3 px-3 py-2 rounded-lg bg-zinc-900/30 border border-zinc-800/50 hover:border-zinc-700/60 transition-colors"
                  >
                    <span
                      className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: GRENADE_COLORS[gt] }}
                    />
                    <div className="min-w-0">
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

        {/* Other nodes */}
        {otherNodes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-data uppercase tracking-widest text-zinc-600 font-semibold">
                Other
              </span>
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-xs font-data text-zinc-600">{otherNodes.length}</span>
            </div>
            <div className="space-y-1 pl-1">
              {otherNodes.map((node, i) => {
                const title = node.Title?.Text?.trim()
                return (
                  <div
                    key={node.Id ?? i}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900/30 border border-zinc-800/50"
                  >
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    <p className="text-sm text-zinc-400 font-display truncate">
                      {title || node.Type}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
