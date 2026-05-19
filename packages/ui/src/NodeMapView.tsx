/**
 * Interactive full-map view of annotation nodes.
 *
 * Features:
 *  - Zoomable / pannable map (wheel + drag, zoom toward cursor, double-click reset)
 *  - Nade icons at each group's standing position
 *  - Nearby groups are auto-clustered; click a cluster badge to expand into individual icons
 *  - Hover icon → tooltip with annotation name + dashed line to landing position
 *  - Selected node highlighted with a glowing ring
 *  - Non-grenade nodes (position, spot, text) shown as small coloured dots
 *  - Zoom controls (+/−/⌂) in the corner
 */
import { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import type { AnnotationNode, GrenadeType, AnnotationMedia } from '@cs2ann/shared'
import { MAP_DATA, worldToPixel } from '@cs2ann/shared'
import { getMapOverviewUrl } from './mapImages'

// ── nade icons (same glob pattern as GuideEditor) ─────────────────────────────
const _nadeIconModules = import.meta.glob(
  '../../../apps/desktop/resources/nades/*.png',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>
const NADE_ICON_FILE: Partial<Record<GrenadeType, string>> = {
  smoke: 'smoke', flash: 'flash', he: 'hegrenade', molotov: 'molotov', decoy: 'decoy',
}
function getNadeIcon(gt: GrenadeType | undefined): string | null {
  if (!gt) return null
  const name = NADE_ICON_FILE[gt]
  return name ? (_nadeIconModules[`../../../apps/desktop/resources/nades/${name}.png`] ?? null) : null
}

// ── constants ─────────────────────────────────────────────────────────────────
const MAP_PX         = 800   // logical size of the overview image
const CLUSTER_RADIUS = 38    // px in 800-space: groups closer than this merge
const ICON_PX        = 24    // icon side in map-space px
const DOT_R          = 7     // radius for non-grenade dot markers

// ── types ─────────────────────────────────────────────────────────────────────
interface NodeGroup { indices: number[]; label: string }

interface MapItem {
  key: string
  mainIdx: number
  destIdx?: number
  px: number; py: number
  destPx?: number; destPy?: number
  grenadeType?: GrenadeType
  label: string
  color?: [number, number, number]
  isSelected: boolean
}

interface NonGrenadeMarker {
  idx: number
  px: number; py: number
  type: 'position' | 'spot' | 'text' | 'line'
  label: string
  color?: [number, number, number]
  isSelected: boolean
}

interface Cluster {
  key: string
  cx: number; cy: number
  items: MapItem[]
  expanded: boolean
}

// ── helpers ───────────────────────────────────────────────────────────────────
/**
 * Returns offset in 800-px map space.
 * The visual radius (in screen px) is constant regardless of zoom level,
 * so we divide by scale to keep icons separated at any zoom.
 */
function fanOffset(i: number, total: number, scale: number): { dx: number; dy: number } {
  if (total === 1) return { dx: 0, dy: 0 }
  const visualR = total <= 3 ? 30 : total <= 6 ? 36 : 44   // desired screen-px radius
  const r       = visualR / scale                            // map-space radius
  const angle   = (i / total) * 2 * Math.PI - Math.PI / 2
  return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r }
}

function rgbToHex(c: [number, number, number]) {
  return '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

// ── component ─────────────────────────────────────────────────────────────────
interface Props {
  mapName: string
  nodes: AnnotationNode[]
  grenadeGroups: NodeGroup[]
  selectedIndex: number | null
  onSelectIndex: (i: number) => void
  /** Optional extra className on the root element. */
  className?: string
  mediaMap?: Record<string, AnnotationMedia[]>
}

export default function NodeMapView({
  mapName, nodes, grenadeGroups, selectedIndex, onSelectIndex, className = '', mediaMap,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const innerRef      = useRef<HTMLDivElement>(null)

  const [scale, setScale]   = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // We need the latest scale/offset inside the non-React wheel handler
  const scaleRef  = useRef(scale)
  const offsetRef = useRef(offset)
  useEffect(() => { scaleRef.current = scale },   [scale])
  useEffect(() => { offsetRef.current = offset }, [offset])

  const [expandedCluster, setExpandedCluster] = useState<string | null>(null)
  const [hoveredItem,     setHoveredItem]     = useState<MapItem | null>(null)
  const [tooltipPos,      setTooltipPos]      = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const hasDragged = useRef(false)   // distinguishes clicks from drags on the container
  const dragLast   = useRef({ x: 0, y: 0 })

  const mapData  = MAP_DATA[mapName]
  const imageUrl = mapData ? getMapOverviewUrl(mapData.file) : null

  // ── fit-to-container on mount ────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const fit = Math.min(width, height) / MAP_PX
    const ox  = (width  - MAP_PX * fit) / 2
    const oy  = (height - MAP_PX * fit) / 2
    scaleRef.current  = fit
    offsetRef.current = { x: ox, y: oy }
    setScale(fit)
    setOffset({ x: ox, y: oy })
  }, [mapName])

  // ── non-passive wheel handler ─────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect  = el.getBoundingClientRect()
      const cx    = e.clientX - rect.left
      const cy    = e.clientY - rect.top
      const f     = e.deltaY > 0 ? 0.87 : 1.15
      const prev  = scaleRef.current
      const next  = Math.max(0.15, Math.min(8, prev * f))
      const ratio = next / prev
      const newOx = cx - (cx - offsetRef.current.x) * ratio
      const newOy = cy - (cy - offsetRef.current.y) * ratio
      scaleRef.current  = next
      offsetRef.current = { x: newOx, y: newOy }
      setScale(next)
      setOffset({ x: newOx, y: newOy })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ── drag ─────────────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    isDragging.current = true
    hasDragged.current = false
    dragLast.current = { x: e.clientX, y: e.clientY }
    // Note: intentionally NOT calling setPointerCapture — that would redirect
    // pointerup to this element and break click delivery to child icons/badges.
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragLast.current.x
    const dy = e.clientY - dragLast.current.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true
    dragLast.current = { x: e.clientX, y: e.clientY }
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }, [])

  const onPointerUp = useCallback(() => { isDragging.current = false }, [])

  const resetView = useCallback(() => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const fit = Math.min(width, height) / MAP_PX
    const ox  = (width  - MAP_PX * fit) / 2
    const oy  = (height - MAP_PX * fit) / 2
    setScale(fit); setOffset({ x: ox, y: oy })
  }, [])

  // ── build map items from grenade groups ───────────────────────────────────
  const { items, nonGrenade } = useMemo(() => {
    if (!mapData) return { items: [], nonGrenade: [] }
    const items: MapItem[] = []
    const nonGrenade: NonGrenadeMarker[] = []

    for (const group of grenadeGroups) {
      const mainIdx = group.indices[0]
      const main    = nodes[mainIdx]
      if (!main.Position) continue

      const { x: px, y: py } = worldToPixel(main.Position[0], main.Position[1], mapData)
      if (px < 0 || px > MAP_PX || py < 0 || py > MAP_PX) continue

      const destIdx = group.indices.find((i) => nodes[i].SubType === 'destination')
      let destPx: number | undefined
      let destPy: number | undefined
      if (destIdx !== undefined && nodes[destIdx].Position) {
        const dest = worldToPixel(nodes[destIdx].Position![0], nodes[destIdx].Position![1], mapData)
        if (dest.x >= 0 && dest.x <= MAP_PX && dest.y >= 0 && dest.y <= MAP_PX) {
          destPx = dest.x; destPy = dest.y
        }
      }

      items.push({
        key:        mainIdx.toString(),
        mainIdx,
        destIdx,
        px, py,
        destPx, destPy,
        grenadeType: main.GrenadeType,
        label:       group.label,
        color:       main.Color,
        isSelected:  group.indices.includes(selectedIndex ?? -1),
      })
    }

    // Non-grenade nodes with positions
    const seen = new Set(grenadeGroups.flatMap((g) => g.indices))
    for (let i = 0; i < nodes.length; i++) {
      if (seen.has(i)) continue
      const n = nodes[i]
      if (!n.Position) continue
      const t = n.Type as 'position' | 'spot' | 'text' | 'line'
      if (!['position', 'spot', 'text', 'line'].includes(t)) continue
      // skip child nodes
      if (n.MasterNodeId) continue
      const { x: px, y: py } = worldToPixel(n.Position[0], n.Position[1], mapData)
      if (px < 0 || px > MAP_PX || py < 0 || py > MAP_PX) continue
      nonGrenade.push({
        idx: i, px, py, type: t,
        label: n.Title?.Text ?? n.Desc?.Text ?? t,
        color: n.Color,
        isSelected: i === selectedIndex,
      })
    }

    return { items, nonGrenade }
  }, [grenadeGroups, nodes, mapData, selectedIndex])

  // ── clustering ────────────────────────────────────────────────────────────
  const clusters: Cluster[] = useMemo(() => {
    const result: Cluster[] = []
    for (const item of items) {
      const existing = result.find((c) => Math.hypot(c.cx - item.px, c.cy - item.py) < CLUSTER_RADIUS)
      if (existing) {
        existing.items.push(item)
        existing.cx = existing.items.reduce((s, x) => s + x.px, 0) / existing.items.length
        existing.cy = existing.items.reduce((s, x) => s + x.py, 0) / existing.items.length
        if (item.isSelected) existing.key = item.key
      } else {
        result.push({ key: item.key, cx: item.px, cy: item.py, items: [item], expanded: false })
      }
    }
    return result
  }, [items])

  if (!mapData || !imageUrl) {
    return (
      <div className={`flex items-center justify-center h-full text-zinc-600 text-sm ${className}`}>
        {mapData ? 'Map image not found.' : `No map data for "${mapName}".`}
      </div>
    )
  }

  const isExpanded = (key: string) => expandedCluster === key

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className={`relative flex flex-col h-full overflow-hidden ${className}`}>

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
        {[
          { label: '+', title: 'Zoom in',   fn: () => { const ns = Math.min(8, scaleRef.current * 1.3); const c = containerRef.current; if (!c) return; const { width, height } = c.getBoundingClientRect(); const cx = width / 2; const cy = height / 2; const r = ns / scaleRef.current; setScale(ns); setOffset((p) => ({ x: cx - (cx - p.x) * r, y: cy - (cy - p.y) * r })) } },
          { label: '−', title: 'Zoom out',  fn: () => { const ns = Math.max(0.15, scaleRef.current * 0.77); const c = containerRef.current; if (!c) return; const { width, height } = c.getBoundingClientRect(); const cx = width / 2; const cy = height / 2; const r = ns / scaleRef.current; setScale(ns); setOffset((p) => ({ x: cx - (cx - p.x) * r, y: cy - (cy - p.y) * r })) } },
          { label: '⌂', title: 'Reset view', fn: resetView },
        ].map(({ label, title, fn }) => (
          <button
            key={label}
            type="button"
            title={title}
            className="w-7 h-7 bg-zinc-800/90 border border-zinc-600 rounded text-zinc-300 hover:bg-zinc-700 text-sm font-bold cursor-pointer"
            onClick={fn}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Map canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onDoubleClick={resetView}
        onClick={() => { if (!hasDragged.current) setExpandedCluster(null) }}
      >
        {/* Inner 800×800 map space — transform applied here */}
        <div
          ref={innerRef}
          style={{
            position: 'absolute',
            width: MAP_PX,
            height: MAP_PX,
            transformOrigin: '0 0',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          {/* Map image */}
          <img
            src={imageUrl}
            draggable={false}
            style={{ width: MAP_PX, height: MAP_PX, display: 'block', pointerEvents: 'none' }}
            alt={mapName}
          />

          {/* SVG layer: hover lines + destination markers */}
          <svg
            style={{ position: 'absolute', inset: 0, width: MAP_PX, height: MAP_PX, pointerEvents: 'none', overflow: 'visible' }}
          >
            {/* Landing position line shown on hover */}
            {hoveredItem && hoveredItem.destPx !== undefined && (
              <>
                <line
                  x1={hoveredItem.px} y1={hoveredItem.py}
                  x2={hoveredItem.destPx!} y2={hoveredItem.destPy!}
                  stroke="rgba(255,210,60,0.55)"
                  strokeWidth={1.5 / scale}
                  strokeDasharray={`${5 / scale},${3 / scale}`}
                />
                {/* Landing ring */}
                <circle
                  cx={hoveredItem.destPx!} cy={hoveredItem.destPy!}
                  r={8 / scale}
                  fill="rgba(255,100,50,0.18)"
                  stroke="rgba(255,120,60,0.9)"
                  strokeWidth={1.5 / scale}
                />
                <line
                  x1={hoveredItem.destPx! - 6 / scale} y1={hoveredItem.destPy!}
                  x2={hoveredItem.destPx! + 6 / scale} y2={hoveredItem.destPy!}
                  stroke="rgba(255,120,60,0.9)" strokeWidth={1 / scale}
                />
                <line
                  x1={hoveredItem.destPx!} y1={hoveredItem.destPy! - 6 / scale}
                  x2={hoveredItem.destPx!} y2={hoveredItem.destPy! + 6 / scale}
                  stroke="rgba(255,120,60,0.9)" strokeWidth={1 / scale}
                />
              </>
            )}
            {/* Selected item's landing position always visible */}
            {(() => {
              const sel = items.find((it) => it.isSelected && it !== hoveredItem)
              if (!sel || sel.destPx === undefined) return null
              return (
                <>
                  <line
                    x1={sel.px} y1={sel.py}
                    x2={sel.destPx!} y2={sel.destPy!}
                    stroke="rgba(130,200,255,0.45)"
                    strokeWidth={1.5 / scale}
                    strokeDasharray={`${5 / scale},${3 / scale}`}
                  />
                  <circle
                    cx={sel.destPx!} cy={sel.destPy!}
                    r={8 / scale}
                    fill="rgba(100,180,255,0.15)"
                    stroke="rgba(130,200,255,0.8)"
                    strokeWidth={1.5 / scale}
                  />
                </>
              )
            })()}
          </svg>

          {/* Non-grenade dots */}
          {nonGrenade.map((m) => {
            const col = m.color ? rgbToHex(m.color) : (
              m.type === 'position' ? '#a78bfa'
              : m.type === 'spot'   ? '#34d399'
              : m.type === 'text'   ? '#fbbf24'
              : '#94a3b8'
            )
            return (
              <div
                key={m.idx}
                title={m.label}
                style={{
                  position: 'absolute',
                  left: m.px,
                  top:  m.py,
                  width:  DOT_R * 2 / scale,
                  height: DOT_R * 2 / scale,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  backgroundColor: col,
                  border: `${(m.isSelected ? 2.5 : 1.5) / scale}px solid ${m.isSelected ? 'white' : 'rgba(0,0,0,0.5)'}`,
                  boxShadow: m.isSelected ? `0 0 ${8 / scale}px ${4 / scale}px rgba(255,255,255,0.35)` : undefined,
                  cursor: 'pointer',
                  zIndex: m.isSelected ? 10 : 2,
                }}
                onClick={(e) => { e.stopPropagation(); onSelectIndex(m.idx) }}
              />
            )
          })}

          {/* Clusters + icons */}
          {clusters.map((cluster) => {
            const expanded = isExpanded(cluster.key)
            const hasSelected = cluster.items.some((it) => it.isSelected)

            if (!expanded && cluster.items.length > 1) {
              // Badge
              const mainIcon = getNadeIcon(cluster.items[0].grenadeType)
              return (
                <div
                  key={cluster.key}
                  style={{
                    position: 'absolute',
                    left: cluster.cx,
                    top:  cluster.cy,
                    transform: 'translate(-50%, -50%)',
                    zIndex: hasSelected ? 15 : 5,
                    cursor: 'pointer',
                  }}
                  onClick={(e) => { e.stopPropagation(); setExpandedCluster((prev) => prev === cluster.key ? null : cluster.key) }}
                >
                  {/* Badge background */}
                  <div
                    style={{
                      width: ICON_PX * 1.4 / scale,
                      height: ICON_PX * 1.4 / scale,
                      borderRadius: '50%',
                      backgroundColor: hasSelected ? 'rgba(130,200,255,0.25)' : 'rgba(30,30,35,0.85)',
                      border: `${(hasSelected ? 2.5 : 1.5) / scale}px solid ${hasSelected ? 'rgba(130,200,255,0.8)' : 'rgba(255,255,255,0.35)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: hasSelected ? `0 0 ${8 / scale}px ${3 / scale}px rgba(130,200,255,0.3)` : `0 ${2 / scale}px ${6 / scale}px rgba(0,0,0,0.5)`,
                      position: 'relative',
                    }}
                  >
                    {mainIcon
                      ? <img src={mainIcon} style={{ width: ICON_PX * 0.72 / scale, height: ICON_PX * 0.72 / scale, objectFit: 'contain' }} draggable={false} alt="" />
                      : <span style={{ fontSize: ICON_PX * 0.5 / scale, color: '#d4d4d8' }}>●</span>
                    }
                    {/* Count badge */}
                    <div style={{
                      position: 'absolute',
                      top: `-${4 / scale}px`,
                      right: `-${4 / scale}px`,
                      width: ICON_PX * 0.6 / scale,
                      height: ICON_PX * 0.6 / scale,
                      borderRadius: '50%',
                      backgroundColor: '#3f3f46',
                      border: `${1.5 / scale}px solid rgba(255,255,255,0.3)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: ICON_PX * 0.38 / scale,
                      color: '#e4e4e7',
                      fontWeight: 'bold',
                    }}>
                      {cluster.items.length}
                    </div>
                  </div>
                </div>
              )
            }

            // Expanded or single — show individual icons, fanned out
            return cluster.items.map((item, i) => {
              const { dx, dy } = expanded ? fanOffset(i, cluster.items.length, scale) : { dx: 0, dy: 0 }
              const icon = getNadeIcon(item.grenadeType)
              const isHov = hoveredItem?.key === item.key
              const isSel = item.isSelected
              const borderCol = isSel
                ? 'rgba(130,200,255,0.95)'
                : item.color
                  ? rgbToHex(item.color)
                  : 'rgba(255,255,255,0.4)'
              const nodeId = nodes[item.mainIdx]?.Id
              const hasMedia = !!(mediaMap && nodeId && (mediaMap[nodeId]?.length ?? 0) > 0)

              return (
                <div
                  key={item.key}
                  style={{
                    position: 'absolute',
                    left: cluster.cx + dx,
                    top:  cluster.cy + dy,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isSel ? 15 : isHov ? 12 : 5,
                    cursor: 'pointer',
                    transition: expanded ? 'all 0.15s ease' : undefined,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    // Single icon or already expanded → select the node and close fan
                    onSelectIndex(item.mainIdx)
                    if (expanded) setExpandedCluster(null)
                  }}
                  onMouseEnter={(e) => {
                    setHoveredItem(item)
                    setTooltipPos({ x: e.clientX, y: e.clientY })
                  }}
                  onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div style={{
                    width:  ICON_PX / scale,
                    height: ICON_PX / scale,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(20,20,24,0.82)',
                    border: `${(isSel ? 2.5 : isHov ? 2 : 1.5) / scale}px solid ${borderCol}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    boxShadow: isSel
                      ? `0 0 ${10 / scale}px ${4 / scale}px rgba(130,200,255,0.45)`
                      : isHov
                        ? `0 0 ${6 / scale}px ${2 / scale}px rgba(255,255,255,0.2)`
                        : `0 ${2 / scale}px ${5 / scale}px rgba(0,0,0,0.55)`,
                  }}>
                    {icon
                      ? <img src={icon} style={{ width: ICON_PX * 0.72 / scale, height: ICON_PX * 0.72 / scale, objectFit: 'contain' }} draggable={false} alt={item.grenadeType} />
                      : <span style={{ fontSize: ICON_PX * 0.5 / scale, color: '#d4d4d8' }}>●</span>
                    }
                    {hasMedia && (
                      <div style={{
                        position: 'absolute',
                        bottom: `-${3 / scale}px`,
                        right: `-${3 / scale}px`,
                        width: ICON_PX * 0.45 / scale,
                        height: ICON_PX * 0.45 / scale,
                        borderRadius: '50%',
                        backgroundColor: '#7c3aed',
                        border: `${1 / scale}px solid rgba(255,255,255,0.5)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: ICON_PX * 0.26 / scale,
                      }}>
                        📷
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          })}
        </div>

        {/* Cluster collapse is handled by onClick on the container above */}
      </div>

      {/* Legend */}
      <div className="shrink-0 px-2 py-1.5 bg-zinc-900/80 border-t border-zinc-700/40 flex items-center gap-3 flex-wrap text-[0.6rem] text-zinc-500">
        <span>Scroll to zoom · Drag to pan · Double-click to reset</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', backgroundColor: '#a78bfa', border: '1px solid rgba(255,255,255,0.3)' }} />
            position
          </span>
          <span className="inline-flex items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', backgroundColor: '#34d399', border: '1px solid rgba(255,255,255,0.3)' }} />
            spot
          </span>
          <span className="inline-flex items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', backgroundColor: '#fbbf24', border: '1px solid rgba(255,255,255,0.3)' }} />
            text
          </span>
        </span>
      </div>

      {/* Tooltip — fixed so it escapes zoom transform */}
      {hoveredItem && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x + 14,
            top:  tooltipPos.y - 36,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-100 shadow-xl max-w-48 leading-snug"
        >
          <div className="font-semibold truncate">{hoveredItem.label}</div>
          {hoveredItem.grenadeType && (
            <div className="text-zinc-400 text-[0.65rem] capitalize">{hoveredItem.grenadeType}</div>
          )}
          {hoveredItem.destPx !== undefined && (
            <div className="text-amber-400/80 text-[0.65rem] mt-0.5">Hover: see landing ↗</div>
          )}
        </div>
      )}
    </div>
  )
}
