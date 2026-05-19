'use client'
import { useState, useRef, useEffect } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

interface Props {
  file: File
  onTrimmed(trimmedFile: File, trimStart: number, trimEnd: number, speedRate: number): void
  onCancel(): void
}

const CDN = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
let _ffmpeg: FFmpeg | null = null

export default function VideoTrimmer({ file, onTrimmed, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const srcUrl = useRef(URL.createObjectURL(file))
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [phase, setPhase] = useState<'trim' | 'loading' | 'processing'>('trim')
  const [progress, setProgress] = useState(0)

  useEffect(() => () => URL.revokeObjectURL(srcUrl.current), [])

  function onMeta() {
    const d = videoRef.current?.duration ?? 0
    setDuration(d)
    setEnd(d)
  }

  function seekStart(v: number) {
    setStart(v)
    if (videoRef.current) videoRef.current.currentTime = v
  }

  function seekEnd(v: number) {
    setEnd(v)
    if (videoRef.current) videoRef.current.currentTime = v
  }

  async function handleApply() {
    setPhase('loading')
    if (!_ffmpeg) _ffmpeg = new FFmpeg()
    if (!_ffmpeg.loaded) {
      await _ffmpeg.load({
        coreURL: await toBlobURL(`${CDN}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CDN}/ffmpeg-core.wasm`, 'application/wasm'),
      })
    }
    setPhase('processing')
    _ffmpeg.on('progress', ({ progress: p }) => setProgress(Math.round(p * 100)))
    const name = 'in.' + (file.name.split('.').pop() ?? 'mp4')
    await _ffmpeg.writeFile(name, await fetchFile(file))
    await _ffmpeg.exec(['-i', name, '-ss', String(start), '-to', String(end), '-c', 'copy', 'out.mp4'])
    const data = await _ffmpeg.readFile('out.mp4') as Uint8Array
    await _ffmpeg.deleteFile(name)
    await _ffmpeg.deleteFile('out.mp4')
    const trimmedFile = new File([data], file.name, { type: 'video/mp4' })
    onTrimmed(trimmedFile, start, end, speed)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const inputCls = 'w-full accent-violet-500 cursor-pointer'
  const btnSm = 'px-3 py-1.5 text-xs rounded transition-colors'

  if (phase === 'loading') return (
    <div className="flex flex-col items-center gap-2 py-6 text-zinc-400 text-sm">
      <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      Loading video editor…
    </div>
  )

  if (phase === 'processing') return (
    <div className="flex flex-col gap-2 py-6">
      <p className="text-xs text-zinc-400 text-center">Trimming… {progress}%</p>
      <div className="w-full bg-zinc-800 rounded-full h-1.5">
        <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <video ref={videoRef} src={srcUrl.current} onLoadedMetadata={onMeta}
        className="w-full rounded-lg max-h-52 bg-black" controls />

      {duration > 0 && (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[0.65rem] text-zinc-500">
              <span>Start: {fmt(start)}</span>
              <span>End: {fmt(end)}</span>
              <span>Duration: {fmt(end - start)}</span>
            </div>
            <label className="text-[0.65rem] text-zinc-500">Trim start</label>
            <input type="range" className={inputCls} min={0} max={duration} step={0.1}
              value={start} onChange={(e) => seekStart(Number(e.target.value))} />
            <label className="text-[0.65rem] text-zinc-500">Trim end</label>
            <input type="range" className={inputCls} min={0} max={duration} step={0.1}
              value={end} onChange={(e) => seekEnd(Number(e.target.value))} />
          </div>

          <div>
            <p className="text-[0.65rem] text-zinc-500 mb-1">Playback speed</p>
            <div className="flex gap-1.5">
              {([1, 1.5, 2] as const).map((s) => (
                <button key={s} type="button"
                  className={`${btnSm} border ${speed === s ? 'bg-violet-900/50 border-violet-700 text-violet-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                  onClick={() => setSpeed(s)}>{s}×</button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className={`${btnSm} bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700`}>
          Cancel
        </button>
        <button type="button" onClick={handleApply} disabled={end <= start}
          className={`${btnSm} bg-violet-700 hover:bg-violet-600 text-white disabled:opacity-40`}>
          Apply trim
        </button>
      </div>
    </div>
  )
}
