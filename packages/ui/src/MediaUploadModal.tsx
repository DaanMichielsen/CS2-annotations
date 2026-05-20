'use client'
import { useState } from 'react'
import type { AnnotationNode, AnnotationMedia, CreateMediaPayload, CropBox, MediaSlot, UpdateMediaPayload } from '@cs2ann/shared'
import { SLOT_LABELS, VALID_SLOTS, nodeLabel } from '@cs2ann/shared'
import VideoTrimmer from './VideoTrimmer'

interface SlotState {
  mode: 'upload' | 'youtube' | null
  file?: File
  youtubeUrl?: string
  caption?: string
  trimStart?: number
  trimEnd?: number
  trimming?: boolean
}

interface Props {
  guideId: string
  nodes: AnnotationNode[]
  existingMedia: Record<string, AnnotationMedia[]>
  currentUserId: string
  onCreateLink(guideId: string, payload: CreateMediaPayload): Promise<AnnotationMedia>
  onCreateUpload(guideId: string, formData: FormData): Promise<AnnotationMedia>
  onUpdate(guideId: string, mediaId: string, payload: UpdateMediaPayload): Promise<AnnotationMedia>
  onRemove(guideId: string, mediaId: string): Promise<void>
  onClose(): void
  onMediaChange?(): void
}

const empty: SlotState = { mode: null }

export default function MediaUploadModal({
  guideId, nodes, existingMedia, onCreateLink, onCreateUpload, onUpdate, onRemove, onClose, onMediaChange,
}: Props) {
  const [nodeId,      setNodeId]      = useState('')
  const [full,        setFull]        = useState<SlotState>(empty)
  const [standing,    setStanding]    = useState<SlotState>(empty)
  const [aim,         setAim]         = useState<SlotState>(empty)
  const [landing,     setLanding]     = useState<SlotState>(empty)
  const [showSlots,   setShowSlots]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')

  const mainNodes = nodes.filter(
    (n) => n.Type === 'grenade' && n.SubType !== 'aim_target' && n.SubType !== 'destination'
  )

  async function uploadSlot(slot: MediaSlot, state: SlotState) {
    if (!state.mode || (!state.file && !state.youtubeUrl)) return
    if (state.mode === 'youtube' && state.youtubeUrl) {
      await onCreateLink(guideId, {
        nodeId, slot, mediaType: 'video', source: 'youtube', url: state.youtubeUrl, caption: state.caption,
      })
      return
    }
    if (state.mode === 'upload' && state.file) {
      const fd = new FormData()
      fd.append('file', state.file)
      fd.append('nodeId', nodeId)
      fd.append('slot', slot)
      fd.append('mediaType', state.file.type.startsWith('video/') ? 'video' : 'image')
      if (state.caption)  fd.append('caption',   state.caption)
      if (state.trimStart !== undefined) fd.append('trimStart', String(state.trimStart))
      if (state.trimEnd   !== undefined) fd.append('trimEnd',   String(state.trimEnd))
      await onCreateUpload(guideId, fd)
    }
  }

  async function handleSubmit() {
    if (!nodeId) return
    setSubmitting(true)
    setError('')
    try {
      await uploadSlot('full',     full)
      await uploadSlot('standing', standing)
      await uploadSlot('aim',      aim)
      await uploadSlot('landing',  landing)
      onMediaChange?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  const btnSm  = 'px-3 py-1.5 text-xs rounded transition-colors'
  const btnMode = (active: boolean) =>
    `${btnSm} border ${active ? 'bg-violet-900/50 border-violet-700 text-violet-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`

  function SlotEditor({ slot, state, setState }: { slot: MediaSlot; state: SlotState; setState: (s: SlotState) => void }) {
    if (state.trimming && state.file) {
      return (
        <VideoTrimmer
          file={state.file}
          onTrimmed={(f, ts, te) => setState({ ...state, file: f, trimStart: ts, trimEnd: te, trimming: false })}
          onCancel={() => setState({ ...state, trimming: false })}
        />
      )
    }
    return (
      <div className="flex flex-col gap-2 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
        <p className="text-xs font-medium text-zinc-300">{SLOT_LABELS[slot]}</p>
        <div className="flex gap-2">
          <button type="button" className={btnMode(state.mode === 'upload')} onClick={() => setState({ ...state, mode: 'upload' })}>
            Upload file
          </button>
          <button type="button" className={btnMode(state.mode === 'youtube')} onClick={() => setState({ ...state, mode: 'youtube' })}>
            YouTube
          </button>
          {state.mode && <button type="button" className={`${btnSm} text-zinc-500 hover:text-zinc-300`} onClick={() => setState(empty)}>Clear</button>}
        </div>

        {state.mode === 'upload' && (
          <div className="flex flex-col gap-2">
            <input type="file" accept={slot === 'full' ? 'video/*' : 'video/*,image/*'}
              className="text-xs text-zinc-400"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setState({ ...state, file: f })
              }} />
            {state.file && state.file.type.startsWith('video/') && (
              <button type="button" className={`${btnSm} bg-zinc-700 text-zinc-300 self-start`}
                onClick={() => setState({ ...state, trimming: true })}>
                Trim video
              </button>
            )}
          </div>
        )}

        {state.mode === 'youtube' && (
          <input type="url" placeholder="https://youtube.com/watch?v=..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600"
            value={state.youtubeUrl ?? ''}
            onChange={(e) => setState({ ...state, youtubeUrl: e.target.value })} />
        )}

        {state.mode && (
          <input type="text" placeholder="Caption (optional)"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600"
            value={state.caption ?? ''}
            onChange={(e) => setState({ ...state, caption: e.target.value })} />
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Add media</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-lg leading-none">×</button>
        </div>

        {/* Step 1: select node */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400">Select grenade</label>
          <select value={nodeId} onChange={(e) => setNodeId(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200">
            <option value="">— pick a grenade —</option>
            {mainNodes.map((n) => (
              <option key={n.Id} value={n.Id ?? ''}>
                {nodeLabel(n)}{existingMedia[n.Id ?? '']?.length ? ' ✓' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: full video (primary) */}
        {nodeId && (
          <>
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-zinc-400">Full video <span className="text-zinc-600">(recommended — one clip covering the whole throw)</span></p>
              <SlotEditor slot="full" state={full} setState={setFull} />
            </div>

            <button type="button" className="text-xs text-zinc-500 hover:text-zinc-300 self-start underline underline-offset-2"
              onClick={() => setShowSlots(!showSlots)}>
              {showSlots ? 'Hide individual screenshots' : '+ Add individual screenshots (standing / aim / landing)'}
            </button>

            {showSlots && (
              <div className="flex flex-col gap-3">
                <SlotEditor slot="standing" state={standing} setState={setStanding} />
                <SlotEditor slot="aim"      state={aim}      setState={setAim}      />
                <SlotEditor slot="landing"  state={landing}  setState={setLanding}  />
              </div>
            )}
          </>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose}
            className={`${btnSm} bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700`}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit}
            disabled={!nodeId || submitting}
            className={`${btnSm} bg-violet-700 hover:bg-violet-600 text-white disabled:opacity-40`}>
            {submitting ? 'Uploading…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
