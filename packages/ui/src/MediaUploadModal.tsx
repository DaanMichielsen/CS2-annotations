'use client'
import { useState } from 'react'
import type { AnnotationNode, AnnotationMedia, CreateMediaPayload, CropBox, MediaSlot, UpdateMediaPayload } from '@cs2ann/shared'
import { SLOT_LABELS, nodeLabel } from '@cs2ann/shared'
import VideoTrimmer from './VideoTrimmer'
import ImageZoomEditor from './ImageZoomEditor'
import MediaViewer from './MediaViewer'

type Step = 1 | 2 | 3 | 4 | 5

interface SlotState {
  mode: 'upload' | 'youtube' | null
  file?: File
  youtubeUrl?: string
  caption?: string
  trimStart?: number
  trimEnd?: number
  speedRate?: number
  cropBox?: CropBox
  trimming?: boolean
}

interface Props {
  guideId: string
  nodes: AnnotationNode[]
  existingMedia: Record<string, AnnotationMedia[]>
  currentUserId: string
  onCreateLink(guideId: string, payload: CreateMediaPayload): Promise<AnnotationMedia>
  onCreateUpload(guideId: string, formData: FormData): Promise<AnnotationMedia>
  onUpdate(mediaId: string, payload: UpdateMediaPayload): Promise<AnnotationMedia>
  onRemove(mediaId: string): Promise<void>
  onClose(): void
  onMediaChange?(): void
}

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: 'Select' },
  { step: 2, label: 'Standing' },
  { step: 3, label: 'Aim' },
  { step: 4, label: 'Landing' },
  { step: 5, label: 'Notes' },
]

const empty: SlotState = { mode: null }

export default function MediaUploadModal({
  guideId, nodes, existingMedia, currentUserId,
  onCreateLink, onCreateUpload, onUpdate, onRemove, onClose, onMediaChange,
}: Props) {
  const [step, setStep] = useState<Step>(1)
  const [nodeId, setNodeId] = useState('')
  const [standing, setStanding] = useState<SlotState>(empty)
  const [aim, setAim] = useState<SlotState>(empty)
  const [landing, setLanding] = useState<SlotState>(empty)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const mainNodes = nodes.filter(
    (n) => n.Type === 'grenade' && n.SubType !== 'aim_target' && n.SubType !== 'destination'
  )

  const slotSetters: Record<number, React.Dispatch<React.SetStateAction<SlotState>>> = {
    2: setStanding, 3: setAim, 4: setLanding,
  }
  const slotStates: Record<number, SlotState> = {
    2: standing, 3: aim, 4: landing,
  }
  const slotNames: Record<number, MediaSlot> = {
    2: 'standing', 3: 'aim', 4: 'landing',
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      const slots: Array<{ slot: MediaSlot; state: SlotState }> = [
        { slot: 'standing', state: standing },
        { slot: 'aim', state: aim },
        { slot: 'landing', state: landing },
      ]
      for (const { slot, state } of slots) {
        if (!state.mode) continue
        if (state.mode === 'youtube' && state.youtubeUrl) {
          await onCreateLink(guideId, {
            nodeId, slot, mediaType: 'video', source: 'youtube',
            url: state.youtubeUrl, caption: state.caption,
            notes: slot === 'landing' ? notes || undefined : undefined,
          })
        } else if (state.mode === 'upload' && state.file) {
          const fd = new FormData()
          fd.append('file', state.file)
          fd.append('nodeId', nodeId)
          fd.append('slot', slot)
          fd.append('mediaType', state.file.type.startsWith('video/') ? 'video' : 'image')
          if (state.caption) fd.append('caption', state.caption)
          if (slot === 'landing' && notes) fd.append('notes', notes)
          if (state.trimStart != null) fd.append('trimStart', String(state.trimStart))
          if (state.trimEnd != null) fd.append('trimEnd', String(state.trimEnd))
          if (state.speedRate) fd.append('speedRate', String(state.speedRate))
          if (state.cropBox) fd.append('cropBox', JSON.stringify(state.cropBox))
          await onCreateUpload(guideId, fd)
        }
      }
      onMediaChange?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-violet-600'
  const labelCls = 'block mb-0.5 text-[0.7rem] text-zinc-400'
  const btnPrimary = 'px-4 py-2 bg-violet-700 hover:bg-violet-600 text-white text-sm rounded transition-colors disabled:opacity-40'
  const btnSecondary = 'px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 text-sm rounded transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + step indicator */}
        <div className="px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-base text-zinc-100">Add media</h2>
            <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-lg">✕</button>
          </div>
          <div className="flex gap-1">
            {STEPS.map(({ step: s, label }) => (
              <div key={s} className={`flex-1 text-center text-[0.6rem] font-data uppercase tracking-wide py-0.5 rounded ${step === s ? 'bg-violet-800 text-violet-200' : step > s ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-800 text-zinc-600'}`}>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Step 1: Select annotation */}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-zinc-400">Choose which grenade lineup to add media to.</p>
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                {mainNodes.map((n) => {
                  const label = nodeLabel(n) || n.GrenadeType || 'Unnamed'
                  const hasMedia = !!(n.Id && existingMedia[n.Id]?.length)
                  return (
                    <button key={n.Id} type="button"
                      onClick={() => { setNodeId(n.Id ?? ''); setStep(2) }}
                      className={`flex items-center gap-2 px-3 py-2 rounded text-left text-sm transition-colors ${nodeId === n.Id ? 'bg-violet-900/50 border border-violet-700 text-violet-200' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'}`}>
                      <span className="flex-1 truncate">{label}</span>
                      {hasMedia && <span className="text-[0.6rem] text-violet-400">📷</span>}
                      <span className="text-[0.65rem] text-zinc-500 capitalize">{n.GrenadeType}</span>
                    </button>
                  )
                })}
                {mainNodes.length === 0 && (
                  <p className="text-xs text-zinc-600">No grenade lineups in this guide.</p>
                )}
              </div>
            </div>
          )}

          {/* Steps 2–4: Slot steps */}
          {(step === 2 || step === 3 || step === 4) && (() => {
            const state = slotStates[step]
            const setter = slotSetters[step]
            const slot = slotNames[step]

            if (state.trimming) {
              return (
                <VideoTrimmer
                  file={state.file!}
                  onTrimmed={(f, ts, te, sr) => setter((prev) => ({ ...prev, file: f, trimStart: ts, trimEnd: te, speedRate: sr, trimming: false }))}
                  onCancel={() => setter((prev) => ({ ...prev, trimming: false }))}
                />
              )
            }

            return (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-zinc-400">{SLOT_LABELS[slot]} media <span className="text-zinc-600">(optional)</span></p>

                {/* Source selector */}
                <div className="flex gap-2">
                  {(['upload', 'youtube'] as const).map((m) => (
                    <button key={m} type="button"
                      onClick={() => setter((prev) => ({ ...prev, mode: prev.mode === m ? null : m }))}
                      className={`flex-1 py-2 text-xs rounded border transition-colors ${state.mode === m ? 'bg-violet-900/50 border-violet-700 text-violet-200' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}>
                      {m === 'upload' ? '📁 Upload file' : '▶ YouTube link'}
                    </button>
                  ))}
                </div>

                {state.mode === 'upload' && (
                  <div className="flex flex-col gap-2">
                    {state.file ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded text-xs text-zinc-300">
                        <span className="flex-1 truncate">{state.file.name}</span>
                        {state.file.type.startsWith('video/') && (
                          <button type="button" onClick={() => setter((prev) => ({ ...prev, trimming: true }))}
                            className="text-violet-400 hover:text-violet-300 shrink-0">Trim ✂</button>
                        )}
                        <button type="button" onClick={() => setter((prev) => ({ ...prev, file: undefined, trimStart: undefined, trimEnd: undefined }))}
                          className="text-zinc-500 hover:text-zinc-300">✕</button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-2 px-4 py-6 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-violet-600 transition-colors">
                        <span className="text-2xl">📁</span>
                        <span className="text-xs text-zinc-400">Drop a video or image, or click to browse</span>
                        <input type="file" accept="video/*,image/*" className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) setter((prev) => ({ ...prev, file: f }))
                          }} />
                      </label>
                    )}
                    {state.file?.type.startsWith('image/') && (
                      <ImageZoomEditor file={state.file}
                        onChange={(cb) => setter((prev) => ({ ...prev, cropBox: cb }))}
                        onCancel={() => setter((prev) => ({ ...prev, cropBox: undefined }))} />
                    )}
                  </div>
                )}

                {state.mode === 'youtube' && (
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>YouTube URL</label>
                    <input type="url" className={inputCls} placeholder="https://youtube.com/watch?v=..."
                      value={state.youtubeUrl ?? ''}
                      onChange={(e) => setter((prev) => ({ ...prev, youtubeUrl: e.target.value }))} />
                    {state.youtubeUrl && /[A-Za-z0-9_-]{11}/.test(state.youtubeUrl) && (
                      <div className="aspect-video rounded overflow-hidden bg-black">
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${state.youtubeUrl.match(/[A-Za-z0-9_-]{11}/)?.[0]}`}
                          className="w-full h-full" allowFullScreen />
                      </div>
                    )}
                  </div>
                )}

                {state.mode && (
                  <div>
                    <label className={labelCls}>Caption <span className="text-zinc-600">(optional)</span></label>
                    <input type="text" className={inputCls} placeholder={`e.g. "Line up crosshair with the balcony edge"`}
                      value={state.caption ?? ''}
                      onChange={(e) => setter((prev) => ({ ...prev, caption: e.target.value }))} />
                  </div>
                )}
              </div>
            )
          })()}

          {/* Step 5: Notes + summary */}
          {step === 5 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>Notes <span className="text-zinc-600">(optional)</span></label>
                <textarea className={`${inputCls} resize-none h-24`} placeholder="Any extra tips for this lineup…"
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div>
                <p className={labelCls}>Summary</p>
                <div className="flex gap-2">
                  {(['standing', 'aim', 'landing'] as MediaSlot[]).map((s, i) => {
                    const state = [standing, aim, landing][i]
                    return (
                      <div key={s} className={`flex-1 text-center text-[0.65rem] py-1.5 rounded border ${state.mode ? 'border-violet-700 text-violet-300 bg-violet-900/30' : 'border-zinc-800 text-zinc-600'}`}>
                        {SLOT_LABELS[s].split(' ')[0]}
                        <div>{state.mode === 'upload' ? '📁' : state.mode === 'youtube' ? '▶' : '—'}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex items-center gap-2 shrink-0">
          {step > 1 && (
            <button type="button" className={btnSecondary} onClick={() => setStep((s) => (s - 1) as Step)}>← Back</button>
          )}
          <div className="flex-1" />
          {step < 5 && step > 1 && (
            <button type="button" className="text-xs text-zinc-500 hover:text-zinc-300 mr-2"
              onClick={() => setStep((s) => (s + 1) as Step)}>Skip →</button>
          )}
          {step === 1 && (
            <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
          )}
          {step < 5 && step > 0 && (
            <button type="button" className={btnPrimary}
              disabled={step === 1 && !nodeId}
              onClick={() => setStep((s) => (s + 1) as Step)}>
              Next →
            </button>
          )}
          {step === 5 && (
            <button type="button" className={btnPrimary} disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Uploading…' : 'Upload & save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
