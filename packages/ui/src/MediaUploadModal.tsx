'use client'
import { useId, useState } from 'react'
import type { AnnotationMedia, CreateMediaPayload, MediaSlot, UpdateMediaPayload } from '@cs2ann/shared'
import { SLOT_LABELS } from '@cs2ann/shared'

interface SlotState {
  mode: 'upload' | 'youtube' | null
  file?: File
  youtubeUrl?: string
  caption?: string
}

interface Props {
  guideId: string
  nodeId: string
  existingMedia: AnnotationMedia[]
  currentUserId: string
  onCreateLink(guideId: string, payload: CreateMediaPayload): Promise<AnnotationMedia>
  onCreateUpload(guideId: string, file: File, nodeId: string, slot: MediaSlot, mediaType: string, caption?: string): Promise<AnnotationMedia>
  onUpdate(guideId: string, mediaId: string, payload: UpdateMediaPayload): Promise<AnnotationMedia>
  onRemove(guideId: string, mediaId: string): Promise<void>
  onClose(): void
  onMediaChange?(): void
}

const empty: SlotState = { mode: null }

const btnSm = 'px-3 py-1.5 text-xs rounded transition-colors'
const inputCls = 'w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-600'

function btnMode(active: boolean) {
  return `${btnSm} border ${active ? 'bg-violet-900/50 border-violet-700 text-violet-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`
}

function SlotEditor({ slot, state, setState }: { slot: MediaSlot; state: SlotState; setState: (s: SlotState) => void }) {
  const fileInputId = useId()

  return (
    <div className="flex flex-col gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
      <p className="text-xs font-medium text-zinc-300">{SLOT_LABELS[slot]}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnMode(state.mode === 'upload')} onClick={() => setState({ ...state, mode: 'upload' })}>
          Upload file
        </button>
        <button type="button" className={btnMode(state.mode === 'youtube')} onClick={() => setState({ ...state, mode: 'youtube' })}>
          YouTube
        </button>
        {state.mode && (
          <button type="button" className={`${btnSm} text-zinc-500 hover:text-zinc-300`} onClick={() => setState(empty)}>
            Clear
          </button>
        )}
      </div>
      {state.mode === 'upload' && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={fileInputId}
            className={`${btnSm} inline-flex w-fit cursor-pointer border bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700`}
          >
            {state.file ? 'Change file' : 'Choose file'}
          </label>
          <input
            id={fileInputId}
            type="file"
            accept={slot === 'full' ? 'video/*' : 'video/*,image/*'}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setState({ ...state, file: f })
            }}
          />
          {state.file && (
            <p className="text-xs text-zinc-400 truncate">{state.file.name}</p>
          )}
        </div>
      )}
      {state.mode === 'youtube' && (
        <input
          type="url"
          placeholder="https://youtube.com/watch?v=..."
          className={inputCls}
          value={state.youtubeUrl ?? ''}
          onChange={(e) => setState({ ...state, youtubeUrl: e.target.value })}
        />
      )}
      {state.mode && (
        <input
          type="text"
          placeholder="Caption (optional)"
          className={inputCls}
          value={state.caption ?? ''}
          onChange={(e) => setState({ ...state, caption: e.target.value })}
        />
      )}
    </div>
  )
}

export default function MediaUploadModal({
  guideId, nodeId, existingMedia, onCreateLink, onCreateUpload, onRemove, onClose, onMediaChange,
}: Props) {
  const [full,       setFull]      = useState<SlotState>(empty)
  const [standing,   setStanding]  = useState<SlotState>(empty)
  const [aim,        setAim]       = useState<SlotState>(empty)
  const [landing,    setLanding]   = useState<SlotState>(empty)
  const [showSlots,  setShowSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]     = useState('')

  async function uploadSlot(slot: MediaSlot, state: SlotState) {
    if (!state.mode || (!state.file && !state.youtubeUrl)) return
    if (state.mode === 'youtube' && state.youtubeUrl) {
      await onCreateLink(guideId, {
        nodeId, slot, mediaType: 'video', source: 'youtube', url: state.youtubeUrl, caption: state.caption,
      })
      return
    }
    if (state.mode === 'upload' && state.file) {
      const mediaType = state.file.type.startsWith('video/') ? 'video' : 'image'
      await onCreateUpload(guideId, state.file, nodeId, slot, mediaType, state.caption)
    }
  }

  async function handleSubmit() {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100 m-0">Media</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-lg leading-none">×</button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4 overflow-y-auto">
          {/* Existing media */}
          {existingMedia.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-zinc-400 m-0">Existing media</p>
              {existingMedia.map((item) => (
                <div key={item.id} className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded-lg border border-zinc-700">
                  <span className="flex-1 text-xs text-zinc-300 truncate">
                    {SLOT_LABELS[item.slot as MediaSlot]}{item.source === 'youtube' ? ' (YouTube)' : ''}
                    {item.caption ? ` — ${item.caption}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(guideId, item.id)}
                    className="text-xs text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add slots */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-zinc-400 m-0">
              Full video <span className="text-zinc-600">(recommended — one clip covering the whole throw)</span>
            </p>
            <SlotEditor slot="full" state={full} setState={setFull} />
          </div>

          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-300 self-center underline underline-offset-2"
            onClick={() => setShowSlots(!showSlots)}
          >
            {showSlots ? 'Hide individual screenshots' : '+ Add individual screenshots (standing / aim / landing)'}
          </button>

          {showSlots && (
            <div className="flex flex-col gap-3">
              <SlotEditor slot="standing" state={standing} setState={setStanding} />
              <SlotEditor slot="aim"      state={aim}      setState={setAim}      />
              <SlotEditor slot="landing"  state={landing}  setState={setLanding}  />
            </div>
          )}

          {error && <p className="text-xs text-red-400 m-0">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-zinc-700/60 flex gap-2 justify-end shrink-0">
          <button type="button" onClick={onClose}
            className={`${btnSm} bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700`}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className={`${btnSm} bg-violet-700 hover:bg-violet-600 text-white font-medium disabled:opacity-40`}>
            {submitting ? 'Uploading…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
