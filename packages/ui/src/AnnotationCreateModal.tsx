/**
 * Modal for generating annotation_create commands.
 *
 * Two-step workflow:
 *  Step 1 (form)    — User fills in fields → "Send to CS2" writes annotation_create to cfg.
 *                     CS2 loads the node into memory but does NOT write the file yet.
 *  Step 2 (created) — User checks the lineup inside CS2.
 *                     "Save (F8)"  → writes annotation_save to cfg → CS2 writes the file
 *                                    → file-watcher fires → GuideEditor patches + saves.
 *                     "Abort (F8)" → writes annotation_reload to cfg → CS2 discards the
 *                                    in-memory node and reloads the original file.
 */
import { useState } from 'react'

export type NodeKind = 'grenade' | 'position' | 'text' | 'line' | 'spot'
type GrenadeVariant = 'smoke' | 'flash' | 'he' | 'molotov' | 'incendiary' | 'decoy'
type MountMode = 'float' | 'surface'

export interface CreateMeta {
  kind: NodeKind
  color?: [number, number, number]
  /** Grenade: Desc.Text on the main stand node (shown below the name at your feet). */
  standingPosLabel?: string
  /** Grenade: Desc.Text on the aim_target node (shown at the crosshair). */
  aimText?: string
  /** Line: Title.Text on the master node (the node with no MasterNodeId). */
  lineLabel?: string
}

// ── helpers ───────────────────────────────────────────────────────────────────
function q(s: string) { return `"${s.replace(/"/g, '')}"` }
function rgbToHex(c: [number, number, number]) {
  return '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}

const GRENADE_VARIANTS: GrenadeVariant[] = ['smoke', 'flash', 'he', 'molotov', 'incendiary', 'decoy']
const COLOR_PRESETS: { label: string; color: [number, number, number] }[] = [
  { label: 'White',      color: [255, 255, 255] },
  { label: '⚡ Instant', color: [200,  70, 180] },
  { label: '🟡 T-side',  color: [250, 230,   3] },
  { label: '🔵 CT-side', color: [ 60, 150, 230] },
  { label: 'Green',      color: [ 80, 220,  80] },
  { label: 'Red',        color: [255,  80,  80] },
  { label: 'Orange',     color: [255, 150,   0] },
]

interface Props {
  onClose: () => void
  /** Step 1 — send annotation_create command (no pending meta stored yet). */
  onSendCreate: (command: string) => Promise<void>
  /** Step 2 — send annotation_save; GuideEditor stores meta + watches for file change. */
  onSaveCreate: (meta: CreateMeta) => Promise<void>
  /** Step 2 — send annotation_reload to discard in-memory node + clear pending meta. */
  onAbortCreate: () => Promise<void>
  /** Key the user has bound to exec annotation_manager in CS2. Shown in button labels. */
  cfgKey?: string
}

export default function AnnotationCreateModal({ onClose, onSendCreate, onSaveCreate, onAbortCreate, cfgKey = 'F8' }: Props) {
  // ── form state ────────────────────────────────────────────────────────────
  const [kind, setKind] = useState<NodeKind>('grenade')
  const [step, setStep] = useState<'form' | 'created'>('form')
  const [busy, setBusy] = useState(false)
  /** Command sent in step 1, shown as reference in step 2. */
  const [sentCmd, setSentCmd] = useState('')

  const [grenadeType, setGrenadeType]           = useState<GrenadeVariant>('smoke')
  const [grenadeLabel, setGrenadeLabel]         = useState('')
  const [standingPosLabel, setStandingPosLabel] = useState('')
  const [aimText, setAimText]                   = useState('')
  const [posLabel, setPosLabel]                 = useState('')
  const [textTitle, setTextTitle]               = useState('')
  const [textBody, setTextBody]                 = useState('')
  const [textMount, setTextMount]               = useState<MountMode>('float')
  const [textFacePlayer, setTextFacePlayer]     = useState(false)
  const [lineMount, setLineMount]               = useState<MountMode>('float')
  const [lineStarted, setLineStarted]           = useState(false)
  const [pointsPlaced, setPointsPlaced]         = useState(0)
  const [lineLabel, setLineLabel]               = useState('')
  const [color, setColor]                       = useState<[number, number, number] | undefined>(undefined)

  // ── command builders ──────────────────────────────────────────────────────
  function buildCmd() {
    switch (kind) {
      case 'grenade': {
        const lbl = grenadeLabel.trim()
        return lbl ? `annotation_create grenade ${grenadeType} ${q(lbl)}` : `annotation_create grenade ${grenadeType}`
      }
      case 'position': {
        const lbl = posLabel.trim()
        return lbl ? `annotation_create position ${q(lbl)}` : 'annotation_create position'
      }
      case 'text': {
        const title = textTitle.trim() || 'Title'
        const body  = textBody.trim()  || 'Text'
        const fp    = textFacePlayer ? ' faceplayer' : ''
        return `annotation_create text ${q(title)} ${q(body)} ${textMount}${fp}`
      }
      case 'line':  return `annotation_create line ${lineMount} new`
      case 'spot':  return 'annotation_create spot'
    }
  }
  function buildLineAddCmd() { return `annotation_create line ${lineMount}` }

  function buildMeta(): CreateMeta {
    return {
      kind,
      color,
      standingPosLabel: standingPosLabel.trim() || undefined,
      aimText: aimText.trim() || undefined,
      lineLabel: lineLabel.trim() || undefined,
    }
  }

  // ── step actions ──────────────────────────────────────────────────────────
  async function handleSendCreate(cmd: string) {
    setBusy(true)
    await onSendCreate(cmd)
    setSentCmd(cmd)
    setStep('created')
    setBusy(false)
  }

  async function handleSave() {
    setBusy(true)
    await onSaveCreate(buildMeta())
    // Keep modal open so banner shows "waiting for file change"
    setBusy(false)
    onClose()
  }

  async function handleAbort() {
    setBusy(true)
    await onAbortCreate()
    setBusy(false)
    setStep('form')
    onClose()
  }

  // ── style helpers ─────────────────────────────────────────────────────────
  const btnPrimary   = 'px-3 py-1.5 bg-zinc-600 hover:bg-zinc-500 border-none rounded text-zinc-100 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
  const btnSecondary = 'px-3 py-1.5 bg-zinc-800 border border-zinc-600 hover:bg-zinc-700 rounded text-zinc-300 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
  const btnDanger    = 'px-3 py-1.5 bg-red-900/60 border border-red-700/70 hover:bg-red-800/60 rounded text-red-300 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
  const inputCls     = 'w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-500'
  const labelCls     = 'block mb-0.5 text-[0.7rem] text-zinc-400'
  const hintCls      = 'text-[0.65rem] text-zinc-500'

  const kindBtnCls = (k: NodeKind) =>
    `px-2.5 py-1 rounded border text-xs cursor-pointer transition-colors ${
      kind === k
        ? 'bg-zinc-600 border-zinc-500 text-zinc-100'
        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
    }`
  const variantBtnCls = (active: boolean) =>
    `px-2.5 py-1 rounded border text-xs cursor-pointer transition-colors ${
      active
        ? 'bg-zinc-600 border-zinc-500 text-zinc-100'
        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
    }`

  function ColorPicker() {
    const currentHex = color ? rgbToHex(color) : '#808080'
    return (
      <div>
        <label className={labelCls}>
          Color <span className={hintCls}>(applied automatically once saved)</span>
        </label>
        <div className="flex flex-wrap gap-1.5 items-center mt-1">
          <button type="button" title="No color (default)"
            className={`w-6 h-6 rounded border-2 flex items-center justify-center text-[10px] transition-colors ${!color ? 'border-white text-white' : 'border-zinc-600 text-zinc-500 hover:border-zinc-400'}`}
            style={{ backgroundColor: '#27272a' }} onClick={() => setColor(undefined)}>×
          </button>
          {COLOR_PRESETS.map((p) => (
            <button key={p.label} type="button" title={p.label}
              style={{ backgroundColor: rgbToHex(p.color) }}
              className={`w-6 h-6 rounded border-2 transition-colors hover:scale-110 ${color && rgbToHex(color) === rgbToHex(p.color) ? 'border-white scale-110' : 'border-zinc-600 hover:border-zinc-300'}`}
              onClick={() => setColor(p.color)} />
          ))}
          <input type="color" className="w-7 h-6 rounded border border-zinc-600 cursor-pointer bg-transparent p-0.5"
            value={currentHex} title="Custom color"
            onChange={(e) => { const rgb = hexToRgb(e.target.value); if (rgb) setColor(rgb) }} />
          {color && <span className="text-[0.6rem] text-zinc-600 font-mono">[{color.map(Math.round).join(', ')}]</span>}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  STEP 2 — confirmation / save / abort
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'created') {
    const meta = buildMeta()
    const hasExtra = meta.color || meta.standingPosLabel || meta.aimText
    return (
      <div className="fixed inset-0 z-500 flex items-center justify-center bg-black/60">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden max-h-[90vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60 shrink-0">
            <h2 className="text-base font-semibold text-zinc-100 m-0">Check your lineup</h2>
            <button type="button" className="text-zinc-500 hover:text-zinc-200 text-lg leading-none" onClick={onClose}>✕</button>
          </div>

          <div className="px-4 py-4 flex flex-col gap-4 overflow-y-auto">
            {/* Status banner */}
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-950/60 border border-amber-700/50 rounded-lg">
              <span className="text-amber-400 mt-0.5">⏳</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-amber-200 text-sm font-medium">Annotation created in CS2 memory</span>
                <span className="text-amber-400/80 text-xs">
                  The annotation is live in CS2 but not saved to disk yet. Adjust your position and aim, then save or abort below.
                </span>
              </div>
            </div>

            {/* Sent command */}
            <div>
              <p className={`${hintCls} mb-1`}>Command that was sent</p>
              <code className="block px-2 py-1.5 bg-zinc-800 border border-zinc-700/60 rounded text-[0.7rem] text-zinc-400 break-all">
                {sentCmd}
              </code>
            </div>

            {/* Metadata that will be applied on save */}
            {hasExtra && (
              <div className="flex flex-col gap-1.5">
                <p className={`${hintCls} mb-0.5`}>Will be applied automatically when saved:</p>
                <div className="flex flex-col gap-1 px-3 py-2 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-xs">
                  {meta.color && (
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full border border-zinc-600 shrink-0"
                        style={{ backgroundColor: rgbToHex(meta.color) }} />
                      <span className="text-zinc-300">Color</span>
                      <span className="text-zinc-500 font-mono text-[0.6rem]">[{meta.color.map(Math.round).join(', ')}]</span>
                    </div>
                  )}
                  {meta.standingPosLabel && (
                    <div className="flex gap-2">
                      <span className="text-zinc-500 shrink-0">Standing text:</span>
                      <span className="text-zinc-300 italic">"{meta.standingPosLabel}"</span>
                    </div>
                  )}
                  {meta.aimText && (
                    <div className="flex gap-2">
                      <span className="text-zinc-500 shrink-0">Aim instruction:</span>
                      <span className="text-zinc-300 italic">"{meta.aimText}"</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="text-xs text-zinc-500 flex flex-col gap-1">
              <p className="m-0">① In CS2, verify your standing position and aim are correct.</p>
              <p className="m-0">② Click <strong className="text-zinc-300">Save ({cfgKey})</strong> — press {cfgKey} in CS2 to write the file.</p>
              <p className="m-0 text-red-400/80">Or click <strong className="text-red-400">Abort ({cfgKey})</strong> to discard this annotation entirely.</p>
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-950/40 border border-red-700/40 rounded-lg">
              <span className="text-red-400 mt-0.5">⚠</span>
              <div className="text-xs text-red-200/90 leading-snug">
                <strong>Important:</strong> `annotation_save` writes the current in-memory annotation state from CS2.
                If you ran `annotation_clear` (or otherwise cleared loaded annotations) before creating a new node,
                saving can overwrite the guide file with only the newly created annotations.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-zinc-700/60 flex items-center gap-2 justify-end shrink-0">
            <button type="button" className={btnSecondary} onClick={() => setStep('form')}>← Edit</button>
            <div className="flex-1" />
            <button type="button" className={btnDanger} disabled={busy} onClick={handleAbort}>
              {busy ? '…' : `✕ Abort (${cfgKey})`}
            </button>
            <button type="button" className={`${btnPrimary} font-semibold`} disabled={busy} onClick={handleSave}>
              {busy ? 'Sending…' : `✓ Save annotation (${cfgKey})`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  STEP 1 — form
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60 shrink-0">
          <h2 className="text-base font-semibold text-zinc-100 m-0">Create annotation in CS2</h2>
          <button type="button" className="text-zinc-500 hover:text-zinc-200 text-lg leading-none" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 flex flex-col gap-4 overflow-y-auto">

          {/* Type selector */}
          <div>
            <p className={`${hintCls} mb-2`}>Node type</p>
            <div className="flex flex-wrap gap-1.5">
              {(['grenade', 'position', 'text', 'line', 'spot'] as NodeKind[]).map((k) => (
                <button key={k} type="button" className={kindBtnCls(k)} onClick={() => setKind(k)}>
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Grenade ── */}
          {kind === 'grenade' && (
            <div className="flex flex-col gap-3">
              <p className={`${hintCls} m-0`}>
                Creates three nodes from your current position/facing and the last grenade trajectory. Adjust in CS2, then save.
              </p>
              <div>
                <label className={labelCls}>Grenade type</label>
                <div className="flex flex-wrap gap-1.5">
                  {GRENADE_VARIANTS.map((gt) => (
                    <button key={gt} type="button" className={variantBtnCls(grenadeType === gt)} onClick={() => setGrenadeType(gt)}>{gt}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Label <span className={hintCls}>(annotation name)</span></label>
                <input type="text" className={inputCls} placeholder='e.g. "A site smoke"'
                  value={grenadeLabel} onChange={(e) => setGrenadeLabel(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Standing position text <span className={hintCls}>(auto-applied on save)</span></label>
                <input type="text" className={inputCls} placeholder='e.g. "Short side of van"'
                  value={standingPosLabel} onChange={(e) => setStandingPosLabel(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Aim instruction <span className={hintCls}>(auto-applied on save)</span></label>
                <input type="text" className={inputCls} placeholder='e.g. "standing W-Jumpthrow"'
                  value={aimText} onChange={(e) => setAimText(e.target.value)} />
              </div>
              <ColorPicker />
            </div>
          )}

          {/* ── Position ── */}
          {kind === 'position' && (
            <div className="flex flex-col gap-3">
              <p className={`${hintCls} m-0`}>Creates a position marker at your current location and facing direction.</p>
              <div>
                <label className={labelCls}>Label</label>
                <input type="text" className={inputCls} placeholder='e.g. "Catwalk peek"'
                  value={posLabel} onChange={(e) => setPosLabel(e.target.value)} />
              </div>
              <ColorPicker />
            </div>
          )}

          {/* ── Text ── */}
          {kind === 'text' && (
            <div className="flex flex-col gap-3">
              <p className={`${hintCls} m-0`}>Places a floating text label. All content is specified in the command itself.</p>
              <div>
                <label className={labelCls}>Title</label>
                <input type="text" className={inputCls} placeholder='e.g. "Van Jump"' value={textTitle} onChange={(e) => setTextTitle(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Body text</label>
                <input type="text" className={inputCls} placeholder='e.g. "↓ jump here ↓"' value={textBody} onChange={(e) => setTextBody(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Mount</label>
                <div className="flex gap-3">
                  {(['float', 'surface'] as MountMode[]).map((m) => (
                    <label key={m} className="flex items-center gap-1.5 cursor-pointer text-sm text-zinc-300">
                      <input type="radio" className="accent-zinc-500 cursor-pointer" checked={textMount === m} onChange={() => setTextMount(m)} />
                      {m === 'float' ? 'Float (at my position)' : 'Surface (look at target)'}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
                <input type="checkbox" className="w-4 h-4 accent-zinc-500 cursor-pointer" checked={textFacePlayer} onChange={(e) => setTextFacePlayer(e.target.checked)} />
                Face player
              </label>
            </div>
          )}

          {/* ── Line ── */}
          {kind === 'line' && (
            <div className="flex flex-col gap-3">
              <p className={`${hintCls} m-0`}>
                Build a line point-by-point. Start, add points, then save. A line needs at least two points to be visible in CS2.
              </p>

              {/* Step indicators */}
              <div className="bg-zinc-800/60 rounded-lg px-3 py-2.5 flex flex-col gap-2">
                {/* Step 1 */}
                <div className="flex items-start gap-2">
                  <span className={`text-sm mt-0.5 w-4 shrink-0 ${lineStarted ? 'text-green-400' : 'text-amber-400 animate-pulse'}`}>
                    {lineStarted ? '✓' : '●'}
                  </span>
                  <div className="flex flex-col gap-1 flex-1">
                    <span className={`text-xs ${lineStarted ? 'text-zinc-500' : 'text-zinc-200'}`}>
                      Go to your start position → <strong>Start new line</strong>
                    </span>
                    <button
                      type="button"
                      className={`${btnPrimary} self-start`}
                      disabled={busy || lineStarted}
                      onClick={async () => {
                        setBusy(true)
                        await onSendCreate(`annotation_create line ${lineMount} new`)
                        setLineStarted(true)
                        setPointsPlaced(1)
                        setBusy(false)
                      }}
                    >
                      {lineStarted ? '✓ Started' : `▶ Start new line (${cfgKey})`}
                    </button>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-2">
                  <span className={`text-sm mt-0.5 w-4 shrink-0 ${!lineStarted ? 'text-zinc-600' : pointsPlaced >= 2 ? 'text-zinc-500' : 'text-amber-400 animate-pulse'}`}>
                    {pointsPlaced >= 2 ? '✓' : '●'}
                  </span>
                  <div className="flex flex-col gap-1 flex-1">
                    <span className={`text-xs ${!lineStarted ? 'text-zinc-600' : 'text-zinc-200'}`}>
                      Move to next waypoint → <strong>Add point</strong>. Repeat for each waypoint.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={busy || !lineStarted}
                        onClick={async () => {
                          setBusy(true)
                          await onSendCreate(`annotation_create line ${lineMount}`)
                          setPointsPlaced((n) => n + 1)
                          setBusy(false)
                        }}
                      >
                        + Add point ({cfgKey})
                      </button>
                      {pointsPlaced >= 2 && (
                        <span className="text-[0.65rem] text-zinc-500">{pointsPlaced} points</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-2">
                  <span className={`text-sm mt-0.5 w-4 shrink-0 ${pointsPlaced >= 2 ? 'text-amber-400 animate-pulse' : 'text-zinc-600'}`}>●</span>
                  <span className={`text-xs mt-0.5 ${pointsPlaced >= 2 ? 'text-zinc-200' : 'text-zinc-600'}`}>
                    Click <strong>Save annotation</strong> when all points are placed.
                  </span>
                </div>
              </div>

              {/* Mount */}
              <div>
                <label className={labelCls}>Mount</label>
                <div className="flex gap-3">
                  {(['float', 'surface'] as MountMode[]).map((m) => (
                    <label key={m} className="flex items-center gap-1.5 cursor-pointer text-sm text-zinc-300">
                      <input type="radio" className="accent-zinc-500 cursor-pointer" checked={lineMount === m} onChange={() => setLineMount(m)} />
                      {m === 'float' ? 'Float (at my position)' : 'Surface (look at target)'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Line label */}
              <div>
                <label className={labelCls}>Line label <span className={hintCls}>(optional, auto-applied on save)</span></label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder='e.g. "Catwalk to A site"'
                  value={lineLabel}
                  onChange={(e) => setLineLabel(e.target.value)}
                />
              </div>

              {/* Save / Abort */}
              <div className="relative group">
                <button
                  type="button"
                  className={`${btnPrimary} w-full`}
                  disabled={busy || pointsPlaced < 2}
                  onClick={async () => { setBusy(true); await onSaveCreate(buildMeta()); setBusy(false); onClose() }}
                >
                  {busy ? 'Sending…' : `✓ Save annotation (${cfgKey})`}
                </button>
                {pointsPlaced < 2 && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-zinc-700 text-zinc-200 text-[0.65rem] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Add at least one point first
                  </span>
                )}
              </div>
              <button type="button" className={`${btnDanger} w-full`} disabled={busy} onClick={handleAbort}>
                {busy ? '…' : `✕ Abort & discard (${cfgKey})`}
              </button>
            </div>
          )}

          {/* ── Spot ── */}
          {kind === 'spot' && (
            <div className="flex flex-col gap-3">
              <p className={`${hintCls} m-0`}>
                Aim spot at your current position/facing. Fades from red (far) to green (correct position).
              </p>
              <ColorPicker />
            </div>
          )}

          {/* Command preview (non-line) */}
          {kind !== 'line' && (
            <div className="flex flex-col gap-1">
              <p className={`${hintCls} m-0`}>Command preview</p>
              <code className="block px-2 py-1.5 bg-zinc-800 border border-zinc-700/60 rounded text-[0.7rem] text-zinc-300 break-all">
                {buildCmd()}
              </code>
            </div>
          )}
        </div>

        {/* Footer (non-line) */}
        {kind !== 'line' && (
          <div className="px-4 py-3 border-t border-zinc-700/60 flex items-center gap-2 shrink-0">
            <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
            <div className="flex-1" />
            <button type="button" className={btnPrimary} disabled={busy}
              onClick={() => handleSendCreate(buildCmd())}>
              {busy ? 'Sending…' : `▶ Send to CS2 (${cfgKey})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
