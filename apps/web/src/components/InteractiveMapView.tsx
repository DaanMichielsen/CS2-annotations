'use client'

/**
 * Interactive map view for the web — a faithful port of the shared NodeMapView,
 * adapted for Next.js (static asset paths, no import.meta.glob, internal selection state).
 *
 * Features:
 *  - Zoom/pan (wheel + drag, zoom toward cursor, double-click reset)
 *  - Grenade icons at throw positions; nearby icons auto-cluster
 *  - Hover → tooltip + dashed line to landing position
 *  - Click → select: shows throw→aim-point (lime) + throw→landing (amber) lines
 *  - Non-grenade nodes as coloured dots
 *  - Detail panel overlay on selection
 */
import { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import type { AnnotationNode, GrenadeType } from '@cs2ann/shared/web'
import type { AnnotationMedia } from '@cs2ann/shared/web'
import { buildNodeGroups, nodeLabel } from '@cs2ann/shared/web'
import { MAP_DATA, worldToPixel } from '@/lib/mapData'
import { MediaViewer } from '@cs2ann/ui'

// ── static nade icon paths ────────────────────────────────────────────────────
const NADE_ICONS: Partial<Record<GrenadeType, string>> = {
  smoke:   '/nades/smoke.png',
  flash:   '/nades/flash.png',
  he:      '/nades/hegrenade.png',
  molotov: '/nades/molotov.png',
  decoy:   '/nades/decoy.png',
}

// ── constants ─────────────────────────────────────────────────────────────────
const MAP_PX         = 800
const CLUSTER_RADIUS = 38
const ICON_PX        = 24
const DOT_R          = 7

// ── types ─────────────────────────────────────────────────────────────────────
interface MapItem {
  key: string
  mainIdx: number
  mainNodeId?: string
  px: number; py: number
  destPx?: number; destPy?: number
  aimPx?: number;  aimPy?: number
  grenadeType?: GrenadeType
  label: string
  desc?: string
  jumpThrow?: boolean
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
}

// ── helpers ───────────────────────────────────────────────────────────────────
function fanOffset(i: number, total: number, scale: number): { dx: number; dy: number } {
  if (total === 1) return { dx: 0, dy: 0 }
  const visualR = total <= 3 ? 30 : total <= 6 ? 36 : 44
  const r       = visualR / scale
  const angle   = (i / total) * 2 * Math.PI - Math.PI / 2
  return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r }
}

function rgbToHex(c: [number, number, number]) {
  return '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

// ── component ─────────────────────────────────────────────────────────────────
interface Props {
  nodes: AnnotationNode[]
  mapName: string | null | undefined
  filterTypes?: GrenadeType[]
  mediaMap?: Record<string, AnnotationMedia[]>
  pinMode?: 'throw' | 'landing'
  onPinClick?: (nodeId: string) => void
  className?: string
}

export default function InteractiveMapView({ nodes, mapName, filterTypes, mediaMap, pinMode, onPinClick, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale,  setScale]  = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const scaleRef  = useRef(scale)
  const offsetRef = useRef(offset)
  useEffect(() => { scaleRef.current = scale },   [scale])
  useEffect(() => { offsetRef.current = offset }, [offset])

  const [expandedCluster, setExpandedCluster] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Clear selection when filter changes so we don't hold a hidden node selected
  useEffect(() => { setSelectedKey(null); setExpandedCluster(null) }, [filterTypes?.join(',')])
  const [hoveredItem, setHoveredItem] = useState<MapItem | null>(null)
  const [tooltipPos,  setTooltipPos]  = useState({ x: 0, y: 0 })

  const isDragging = useRef(false)
  const hasDragged = useRef(false)
  const dragLast   = useRef({ x: 0, y: 0 })

  const mapData  = mapName ? MAP_DATA[mapName.toLowerCase()] : null
  const imageUrl = mapData ? `/maps/radars/${mapData.file}` : null

  // ── fit map on mount ──────────────────────────────────────────────────────
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

  // ── non-passive wheel zoom ────────────────────────────────────────────────
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

  // ── drag / pan ────────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    isDragging.current = true
    hasDragged.current = false
    dragLast.current = { x: e.clientX, y: e.clientY }
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

  const zoomBy = useCallback((factor: number) => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const cx = width / 2; const cy = height / 2
    const next  = Math.max(0.15, Math.min(8, scaleRef.current * factor))
    const ratio = next / scaleRef.current
    setScale(next)
    setOffset((p) => ({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio }))
  }, [])

  // ── build items from nodes ────────────────────────────────────────────────
  const { grenadeGroups } = useMemo(() => buildNodeGroups(nodes), [nodes])

  const { items, nonGrenade } = useMemo(() => {
    if (!mapData) return { items: [], nonGrenade: [] }
    const items: MapItem[] = []
    const nonGrenade: NonGrenadeMarker[] = []

    for (const group of grenadeGroups) {
      const mainIdx = group.indices[0]
      const main    = nodes[mainIdx]
      if (!main?.Position) continue
      const { x: px, y: py } = worldToPixel(main.Position[0], main.Position[1], mapData)
      if (px < 0 || px > MAP_PX || py < 0 || py > MAP_PX) continue

      const destIdx = group.indices.find((i) => nodes[i].SubType === 'destination')
      let destPx: number | undefined, destPy: number | undefined
      if (destIdx !== undefined && nodes[destIdx].Position) {
        const d = worldToPixel(nodes[destIdx].Position![0], nodes[destIdx].Position![1], mapData)
        if (d.x >= 0 && d.x <= MAP_PX && d.y >= 0 && d.y <= MAP_PX) { destPx = d.x; destPy = d.y }
      }

      const aimIdx = group.indices.find((i) => nodes[i].SubType === 'aim_target')
      let aimPx: number | undefined, aimPy: number | undefined
      if (aimIdx !== undefined && nodes[aimIdx].Position) {
        const a = worldToPixel(nodes[aimIdx].Position![0], nodes[aimIdx].Position![1], mapData)
        if (a.x >= 0 && a.x <= MAP_PX && a.y >= 0 && a.y <= MAP_PX) { aimPx = a.x; aimPy = a.y }
      }

      items.push({
        key:        mainIdx.toString(),
        mainIdx,
        mainNodeId: main.Id,
        px, py, destPx, destPy, aimPx, aimPy,
        grenadeType: main.GrenadeType,
        label:       nodeLabel(main) || `${main.GrenadeType ?? 'grenade'}`,
        desc:        main.Desc?.Text?.trim() || undefined,
        jumpThrow:   main.JumpThrow,
        color:       main.Color,
        isSelected:  selectedKey === mainIdx.toString(),
      })
    }

    const seen = new Set(grenadeGroups.flatMap((g) => g.indices))
    for (let i = 0; i < nodes.length; i++) {
      if (seen.has(i)) continue
      const n = nodes[i]
      if (!n.Position) continue
      const t = n.Type as 'position' | 'spot' | 'text' | 'line'
      if (!['position', 'spot', 'text', 'line'].includes(t)) continue
      if (n.MasterNodeId) continue
      const { x: px, y: py } = worldToPixel(n.Position[0], n.Position[1], mapData)
      if (px < 0 || px > MAP_PX || py < 0 || py > MAP_PX) continue
      nonGrenade.push({
        idx: i, px, py, type: t,
        label: n.Title?.Text ?? n.Desc?.Text ?? t,
        color: n.Color,
        isSelected: false,
      })
    }

    const filteredItems = filterTypes && filterTypes.length > 0
      ? items.filter((it) => it.grenadeType && filterTypes.includes(it.grenadeType))
      : items

    return { items: filteredItems, nonGrenade }
  }, [grenadeGroups, nodes, mapData, selectedKey, filterTypes])

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
        result.push({ key: item.key, cx: item.px, cy: item.py, items: [item] })
      }
    }
    return result
  }, [items])

  const selectedItem = items.find((it) => it.isSelected) ?? null

  if (!mapData || !imageUrl) {
    return (
      <div className={`flex items-center justify-center text-zinc-600 text-sm ${className}`}>
        {mapData ? 'Map radar image not found.' : `No map data for "${mapName}".`}
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 ${className}`}>

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
        {([
          { label: '+', title: 'Zoom in',    fn: () => zoomBy(1.3)  },
          { label: '−', title: 'Zoom out',   fn: () => zoomBy(0.77) },
          { label: '⌂', title: 'Reset view', fn: resetView          },
        ] as const).map(({ label, title, fn }) => (
          <button
            key={label}
            type="button"
            title={title}
            onClick={fn}
            className="w-7 h-7 bg-zinc-800/90 border border-zinc-700 rounded text-zinc-300 hover:bg-zinc-700 text-sm font-bold cursor-pointer flex items-center justify-center"
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
        onClick={() => {
          if (!hasDragged.current) {
            setExpandedCluster(null)
            setSelectedKey(null)
          }
        }}
      >
        {/* Inner 800×800 map space */}
        <div
          style={{
            position: 'absolute',
            width: MAP_PX,
            height: MAP_PX,
            transformOrigin: '0 0',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          {/* Map radar image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            draggable={false}
            style={{ width: MAP_PX, height: MAP_PX, display: 'block', pointerEvents: 'none' }}
            alt={mapName ?? 'map'}
          />

          {/* SVG: connection lines + destination/aim markers */}
          <svg
            style={{ position: 'absolute', inset: 0, width: MAP_PX, height: MAP_PX, pointerEvents: 'none', overflow: 'visible' }}
          >
            {/* Smoke radius circles in landing pin mode */}
            {pinMode === 'landing' && mapData && items.map((item) => {
              if (item.grenadeType !== 'smoke' || item.destPx === undefined) return null
              const radiusPx = 144 / mapData.scale
              return (
                <circle
                  key={`smoke-radius-${item.key}`}
                  cx={item.destPx}
                  cy={item.destPy}
                  r={radiusPx}
                  fill="rgba(200,200,200,0.12)"
                  stroke="rgba(200,200,200,0.35)"
                  strokeWidth={1}
                  style={{ pointerEvents: 'none' }}
                />
              )
            })}

            {/* Hover: dashed line to destination */}
            {hoveredItem && hoveredItem !== selectedItem && hoveredItem.destPx !== undefined && (
              <>
                <line
                  x1={hoveredItem.px} y1={hoveredItem.py}
                  x2={hoveredItem.destPx!} y2={hoveredItem.destPy!}
                  stroke="rgba(255,210,60,0.45)"
                  strokeWidth={1.5 / scale}
                  strokeDasharray={`${5 / scale},${3 / scale}`}
                />
                <circle cx={hoveredItem.destPx!} cy={hoveredItem.destPy!} r={7 / scale}
                  fill="rgba(255,100,50,0.12)" stroke="rgba(255,120,60,0.7)" strokeWidth={1.2 / scale} />
              </>
            )}

            {/* Selected: throw → aim_target (lime) */}
            {selectedItem?.aimPx !== undefined && (
              <>
                <line
                  x1={selectedItem.px} y1={selectedItem.py}
                  x2={selectedItem.aimPx!} y2={selectedItem.aimPy!}
                  stroke="rgba(132,204,22,0.6)"
                  strokeWidth={1.5 / scale}
                  strokeDasharray={`${4 / scale},${3 / scale}`}
                />
                {/* Crosshair at aim point */}
                {[[-1, -1, 1, 1], [-1, 1, 1, -1]].map(([dx1, dy1, dx2, dy2], k) => (
                  <line
                    key={k}
                    x1={selectedItem.aimPx! + dx1 * 5 / scale} y1={selectedItem.aimPy! + dy1 * 5 / scale}
                    x2={selectedItem.aimPx! + dx2 * 5 / scale} y2={selectedItem.aimPy! + dy2 * 5 / scale}
                    stroke="rgba(163,230,53,0.9)" strokeWidth={1.5 / scale} strokeLinecap="round"
                  />
                ))}
                <circle cx={selectedItem.aimPx!} cy={selectedItem.aimPy!} r={4 / scale}
                  fill="none" stroke="rgba(132,204,22,0.7)" strokeWidth={1 / scale} />
              </>
            )}

            {/* Selected: throw → destination (amber) */}
            {selectedItem?.destPx !== undefined && (
              <>
                <line
                  x1={selectedItem.px} y1={selectedItem.py}
                  x2={selectedItem.destPx!} y2={selectedItem.destPy!}
                  stroke="rgba(251,191,36,0.6)"
                  strokeWidth={1.5 / scale}
                  strokeDasharray={`${5 / scale},${3 / scale}`}
                />
                <circle cx={selectedItem.destPx!} cy={selectedItem.destPy!} r={9 / scale}
                  fill="rgba(251,191,36,0.1)" stroke="rgba(251,191,36,0.85)" strokeWidth={1.5 / scale} />
                {/* Crosshairs at landing */}
                <line x1={selectedItem.destPx! - 7 / scale} y1={selectedItem.destPy!}
                      x2={selectedItem.destPx! + 7 / scale} y2={selectedItem.destPy!}
                      stroke="rgba(251,191,36,0.85)" strokeWidth={1 / scale} />
                <line x1={selectedItem.destPx!} y1={selectedItem.destPy! - 7 / scale}
                      x2={selectedItem.destPx!} y2={selectedItem.destPy! + 7 / scale}
                      stroke="rgba(251,191,36,0.85)" strokeWidth={1 / scale} />
              </>
            )}
          </svg>

          {/* Non-grenade dots */}
          {nonGrenade.map((m) => {
            const col = m.color ? rgbToHex(m.color) : (
              m.type === 'position' ? '#a78bfa'
              : m.type === 'spot'  ? '#34d399'
              : m.type === 'text'  ? '#fbbf24'
              : '#94a3b8'
            )
            return (
              <div
                key={m.idx}
                title={m.label}
                style={{
                  position: 'absolute', left: m.px, top: m.py,
                  width: DOT_R * 2 / scale, height: DOT_R * 2 / scale,
                  transform: 'translate(-50%, -50%)', borderRadius: '50%',
                  backgroundColor: col,
                  border: `${1.5 / scale}px solid rgba(0,0,0,0.5)`,
                  boxShadow: `0 ${2 / scale}px ${5 / scale}px rgba(0,0,0,0.55)`,
                  cursor: 'pointer', zIndex: 2,
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )
          })}

          {/* Clusters + individual icons */}
          {clusters.map((cluster) => {
            const isClusterExpanded = expandedCluster === cluster.key
            const hasSelected = cluster.items.some((it) => it.isSelected)

            if (!isClusterExpanded && cluster.items.length > 1) {
              const iconSrc = cluster.items[0].grenadeType ? NADE_ICONS[cluster.items[0].grenadeType] : undefined
              return (
                <div
                  key={cluster.key}
                  style={{
                    position: 'absolute', left: cluster.cx, top: cluster.cy,
                    transform: 'translate(-50%, -50%)',
                    zIndex: hasSelected ? 15 : 5, cursor: 'pointer',
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpandedCluster((prev) => prev === cluster.key ? null : cluster.key)
                  }}
                >
                  <div style={{
                    width: ICON_PX * 1.4 / scale, height: ICON_PX * 1.4 / scale,
                    borderRadius: '50%',
                    backgroundColor: hasSelected ? 'rgba(130,200,255,0.2)' : 'rgba(25,25,30,0.88)',
                    border: `${(hasSelected ? 2.5 : 1.5) / scale}px solid ${hasSelected ? 'rgba(130,200,255,0.8)' : 'rgba(255,255,255,0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: hasSelected ? `0 0 ${8/scale}px ${3/scale}px rgba(130,200,255,0.25)` : `0 ${2/scale}px ${6/scale}px rgba(0,0,0,0.5)`,
                    position: 'relative',
                  }}>
                    {iconSrc
                      ? <img src={iconSrc} style={{ width: ICON_PX * 0.72 / scale, height: ICON_PX * 0.72 / scale, objectFit: 'contain' }} draggable={false} alt="" />
                      : <span style={{ fontSize: ICON_PX * 0.5 / scale, color: '#d4d4d8' }}>●</span>
                    }
                    <div style={{
                      position: 'absolute', top: `-${4/scale}px`, right: `-${4/scale}px`,
                      width: ICON_PX * 0.6 / scale, height: ICON_PX * 0.6 / scale,
                      borderRadius: '50%', backgroundColor: '#3f3f46',
                      border: `${1.5/scale}px solid rgba(255,255,255,0.25)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: ICON_PX * 0.38 / scale, color: '#e4e4e7', fontWeight: 'bold',
                    }}>
                      {cluster.items.length}
                    </div>
                  </div>
                </div>
              )
            }

            // Expanded or single — show individual icons
            return cluster.items.map((item, i) => {
              const { dx, dy } = isClusterExpanded ? fanOffset(i, cluster.items.length, scale) : { dx: 0, dy: 0 }
              const iconSrc = item.grenadeType ? NADE_ICONS[item.grenadeType] : undefined
              const isHov   = hoveredItem?.key === item.key
              const isSel   = item.isSelected
              const borderCol = isSel
                ? 'rgba(130,200,255,0.95)'
                : item.color ? rgbToHex(item.color) : 'rgba(255,255,255,0.35)'

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
                    transition: isClusterExpanded ? 'all 0.15s ease' : undefined,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedKey((prev) => prev === item.key ? null : item.key)
                    if (isClusterExpanded) setExpandedCluster(null)
                    if (item.mainNodeId) onPinClick?.(item.mainNodeId)
                  }}
                  onMouseEnter={(e) => { setHoveredItem(item); setTooltipPos({ x: e.clientX, y: e.clientY }) }}
                  onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div style={{
                    width: ICON_PX / scale, height: ICON_PX / scale,
                    borderRadius: '50%', backgroundColor: 'rgba(20,20,24,0.85)',
                    border: `${(isSel ? 2.5 : isHov ? 2 : 1.5) / scale}px solid ${borderCol}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isSel
                      ? `0 0 ${10/scale}px ${4/scale}px rgba(130,200,255,0.4)`
                      : isHov ? `0 0 ${6/scale}px ${2/scale}px rgba(255,255,255,0.18)`
                      : `0 ${2/scale}px ${5/scale}px rgba(0,0,0,0.55)`,
                  }}>
                    {iconSrc
                      ? <img src={iconSrc} style={{ width: ICON_PX * 0.72 / scale, height: ICON_PX * 0.72 / scale, objectFit: 'contain' }} draggable={false} alt={item.grenadeType} />
                      : <span style={{ fontSize: ICON_PX * 0.5 / scale, color: '#d4d4d8' }}>●</span>
                    }
                  </div>
                </div>
              )
            })
          })}
        </div>
      </div>

      {/* Legend bar */}
      <div className="shrink-0 px-3 py-1.5 bg-zinc-900/90 border-t border-zinc-800 flex items-center gap-3 flex-wrap text-[0.6rem] text-zinc-600">
        <span>Scroll to zoom · Drag to pan · Double-click to reset</span>
        {[
          { col: '#a78bfa', label: 'position' },
          { col: '#34d399', label: 'spot'     },
          { col: '#fbbf24', label: 'text'     },
        ].map(({ col, label }) => (
          <span key={label} className="ml-auto first:ml-0 flex items-center gap-1">
            <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', backgroundColor: col }} />
            {label}
          </span>
        ))}
      </div>

      {/* Hover tooltip — fixed so it escapes the zoom transform */}
      {hoveredItem && hoveredItem !== selectedItem && (
        <div
          style={{ position: 'fixed', left: tooltipPos.x + 14, top: tooltipPos.y - 40, pointerEvents: 'none', zIndex: 9999 }}
          className="bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 shadow-xl max-w-48 leading-snug"
        >
          <div className="font-display font-semibold truncate">{hoveredItem.label}</div>
          {hoveredItem.grenadeType && (
            <div className="text-zinc-400 text-[0.65rem] capitalize mt-0.5">{hoveredItem.grenadeType}</div>
          )}
          <div className="text-zinc-500 text-[0.6rem] mt-1">Click to inspect</div>
          {hoveredItem && mediaMap?.[hoveredItem.mainNodeId ?? '']?.length ? (
            <div className="text-[0.6rem] text-violet-400 mt-0.5">&#9654; click to view</div>
          ) : null}
        </div>
      )}

      {/* Selected grenade detail panel */}
      {selectedItem && (
        <div
          className="absolute bottom-10 left-3 z-30 bg-zinc-900/96 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
          style={{ maxWidth: 260 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-2.5 px-3 pt-3 pb-2">
            {selectedItem.grenadeType && NADE_ICONS[selectedItem.grenadeType] && (
              <img
                src={NADE_ICONS[selectedItem.grenadeType]!}
                width={20} height={20}
                alt={selectedItem.grenadeType}
                className="shrink-0 mt-0.5 opacity-90"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-display font-semibold text-white leading-snug truncate">
                {selectedItem.label}
              </div>
              {selectedItem.desc && (
                <div className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{selectedItem.desc}</div>
              )}
            </div>
            <button
              onClick={() => setSelectedKey(null)}
              className="shrink-0 text-zinc-600 hover:text-zinc-300 text-base leading-none ml-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Info row */}
          <div className="px-3 pb-3 flex flex-wrap gap-1.5">
            {selectedItem.jumpThrow && (
              <span className="text-[0.6rem] font-data uppercase tracking-widest px-1.5 py-0.5 rounded bg-violet-900/40 text-violet-400 border border-violet-800/40">
                jump throw
              </span>
            )}
            {selectedItem.aimPx !== undefined && (
              <span className="text-[0.6rem] font-data px-1.5 py-0.5 rounded bg-lime-900/30 text-lime-400 border border-lime-800/30">
                ✕ aim point
              </span>
            )}
            {selectedItem.destPx !== undefined && (
              <span className="text-[0.6rem] font-data px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-800/30">
                ◎ landing
              </span>
            )}
          </div>

          {/* Media */}
          {selectedItem?.mainNodeId && mediaMap?.[selectedItem.mainNodeId]?.length ? (
            <div className="px-3 pb-3 border-t border-zinc-800 pt-2">
              <MediaViewer media={mediaMap[selectedItem.mainNodeId]} maxHeight="max-h-48" />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
