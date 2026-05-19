'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { CropBox } from '@cs2ann/shared'

interface Props {
  file: File
  onChange(cropBox: CropBox): void
  onCancel(): void
}

export default function ImageZoomEditor({ file, onChange, onCancel }: Props) {
  const srcUrl = useRef(URL.createObjectURL(file))
  useEffect(() => () => URL.revokeObjectURL(srcUrl.current), [])

  const [zoom, setZoom] = useState(1)
  const [ox, setOx] = useState(0)
  const [oy, setOy] = useState(0)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })

  const emit = useCallback((z: number, x: number, y: number) => {
    const w = 1 / z
    const h = 1 / z
    const cx = Math.max(0, Math.min(1 - w, 0.5 - w / 2 - x * w))
    const cy = Math.max(0, Math.min(1 - h, 0.5 - h / 2 - y * h))
    onChange({ x: cx, y: cy, w, h })
  }, [onChange])

  function onZoomChange(v: number) { setZoom(v); emit(v, ox, oy) }

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true
    last.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return
    const dx = (e.clientX - last.current.x) / 200
    const dy = (e.clientY - last.current.y) / 200
    last.current = { x: e.clientX, y: e.clientY }
    const nx = Math.max(-0.5, Math.min(0.5, ox + dx))
    const ny = Math.max(-0.5, Math.min(0.5, oy + dy))
    setOx(nx); setOy(ny)
    emit(zoom, nx, ny)
  }

  function onPointerUp() { dragging.current = false }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg cursor-move select-none"
        style={{ height: 240 }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <img src={srcUrl.current} alt=""
          style={{
            width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none',
            transform: `scale(${zoom}) translate(${ox * 100}%, ${oy * 100}%)`,
            transformOrigin: 'center',
          }} />
      </div>

      <div>
        <div className="flex justify-between text-[0.65rem] text-zinc-500 mb-1">
          <span>Zoom</span><span>{zoom.toFixed(1)}×</span>
        </div>
        <input type="range" min={1} max={4} step={0.1} value={zoom}
          className="w-full accent-violet-500 cursor-pointer"
          onChange={(e) => onZoomChange(Number(e.target.value))} />
      </div>

      <p className="text-[0.65rem] text-zinc-500">Drag the preview to reposition.</p>

      <button type="button" onClick={onCancel}
        className="self-end text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 rounded transition-colors">
        Reset
      </button>
    </div>
  )
}
