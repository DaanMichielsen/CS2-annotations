import { useRef, useEffect, useCallback } from 'react'
import { MAP_DATA, getMapImageUrl, worldToPixel } from '@cs2ann/shared'

// The map images are 800×800. We render them into a smaller canvas.
const CANVAS_PX = 380
const IMG_PX = 800
const SCALE = CANVAS_PX / IMG_PX

export interface MapMarker {
  position: [number, number, number]
  /** yaw angle in degrees for direction arrow (undefined = no arrow) */
  yaw?: number
  type: 'stand' | 'aim' | 'land' | 'point'
}

interface Props {
  mapName: string
  markers: MapMarker[]
  /** Called with the copied command string after clicking a marker */
  onCopySetpos?: (command: string) => void
}

const MARKER_COLORS: Record<MapMarker['type'], string> = {
  stand: '#FFD700',
  aim:   '#88FF88',
  land:  '#FF5555',
  point: '#88AAFF',
}

export default function MapOverlay({ mapName, markers, onCopySetpos }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const mapData = MAP_DATA[mapName]

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !mapData) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX)

    // Dark fill in case image doesn't cover the full canvas
    ctx.fillStyle = '#18181b'
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX)

    if (imgRef.current) {
      ctx.globalAlpha = 0.85
      ctx.drawImage(imgRef.current, 0, 0, CANVAS_PX, CANVAS_PX)
      ctx.globalAlpha = 1
    }

    // Draw dashed line from stand → land
    const stand = markers.find((m) => m.type === 'stand')
    const land  = markers.find((m) => m.type === 'land')
    if (stand && land && stand.position && land.position) {
      const sp = worldToPixel(stand.position[0], stand.position[1], mapData)
      const lp = worldToPixel(land.position[0],  land.position[1],  mapData)
      ctx.beginPath()
      ctx.setLineDash([4, 4])
      ctx.moveTo(sp.x * SCALE, sp.y * SCALE)
      ctx.lineTo(lp.x * SCALE, lp.y * SCALE)
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.45)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash([])
    }

    for (const marker of markers) {
      if (!marker.position) continue
      const { x: px, y: py } = worldToPixel(marker.position[0], marker.position[1], mapData)
      const cx = px * SCALE
      const cy = py * SCALE

      // Skip markers that fall outside the canvas
      if (cx < -10 || cy < -10 || cx > CANVAS_PX + 10 || cy > CANVAS_PX + 10) continue

      const color = MARKER_COLORS[marker.type]

      if (marker.type === 'stand') {
        // Outer glow
        ctx.beginPath()
        ctx.arc(cx, cy, 7, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fill()
        // Main dot
        ctx.beginPath()
        ctx.arc(cx, cy, 5, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1
        ctx.stroke()
        // Direction arrow (yaw → screen direction)
        if (marker.yaw !== undefined) {
          const rad = ((marker.yaw - 90) * Math.PI) / 180
          const len = 13
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + Math.cos(rad) * len, cy + Math.sin(rad) * len)
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          ctx.stroke()
          // Arrow head
          const hx = cx + Math.cos(rad) * len
          const hy = cy + Math.sin(rad) * len
          const aRad = 0.5
          ctx.beginPath()
          ctx.moveTo(hx, hy)
          ctx.lineTo(hx + Math.cos(rad + Math.PI - aRad) * 5, hy + Math.sin(rad + Math.PI - aRad) * 5)
          ctx.lineTo(hx + Math.cos(rad + Math.PI + aRad) * 5, hy + Math.sin(rad + Math.PI + aRad) * 5)
          ctx.closePath()
          ctx.fillStyle = color
          ctx.fill()
        }
      } else if (marker.type === 'land') {
        // Landing ring
        ctx.beginPath()
        ctx.arc(cx, cy, 5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx, cy, 4, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1
        ctx.stroke()
        // Outer ring
        ctx.beginPath()
        ctx.arc(cx, cy, 7, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,85,85,0.5)'
        ctx.lineWidth = 1
        ctx.stroke()
      } else if (marker.type === 'aim') {
        // Crosshair
        const r = 5
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy)
        ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r)
        ctx.stroke()
        // Centre dot
        ctx.beginPath()
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(cx, cy, 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx, cy, 3, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  }, [mapData, markers])

  // Load image once per map, then redraw on marker changes
  useEffect(() => {
    if (!mapData) return
    const url = getMapImageUrl(mapData.file)
    if (!url) return

    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      draw()
    }
    img.onerror = () => { imgRef.current = null; draw() }
    img.src = url
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData?.file])

  useEffect(() => {
    if (imgRef.current) draw()
  }, [draw])

  if (!mapData) {
    return (
      <div className="mb-3 text-xs text-zinc-600 italic px-1">
        No map data for <code className="bg-zinc-800 px-1 rounded">{mapName}</code>
      </div>
    )
  }

  return (
    <div className="mb-3 rounded overflow-hidden border border-zinc-700/60">
      {/* Legend */}
      <div className="flex items-center gap-3 px-2 py-1 bg-zinc-900/70 border-b border-zinc-700/40 text-[0.65rem] text-zinc-500">
        <span className="font-medium text-zinc-400">{mapName}</span>
        <span><span style={{ color: MARKER_COLORS.stand }}>●</span> Stand</span>
        <span><span style={{ color: MARKER_COLORS.aim }}>✕</span> Aim</span>
        <span><span style={{ color: MARKER_COLORS.land }}>●</span> Land</span>
        {onCopySetpos && (
          <button
            type="button"
            className="ml-auto px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded text-zinc-300 cursor-pointer text-[0.65rem] transition-colors"
            onClick={() => {
              const mainMarker = markers.find((m) => m.type === 'stand')
              if (!mainMarker?.position) return
              const [x, y, z] = mainMarker.position
              const pos = `setpos ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`
              const yaw = mainMarker.yaw
              const cmd = yaw !== undefined ? `${pos}; setang 0 ${yaw.toFixed(2)} 0` : pos
              void navigator.clipboard.writeText(cmd)
              onCopySetpos(cmd)
            }}
          >
            Copy setpos
          </button>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_PX}
        height={CANVAS_PX}
        className="w-full aspect-square block"
        style={{ imageRendering: 'crisp-edges' }}
      />
    </div>
  )
}
