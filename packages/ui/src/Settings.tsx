import { useState, useEffect } from 'react'
import { useGuideAdapter } from './GuideAdapterContext'

const btn = 'px-4 py-2 bg-zinc-700 hover:bg-zinc-600 border-none rounded text-zinc-200 cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors'

// Translates a KeyboardEvent into the CS2 engine bind alias.
// Returns null for keys that are not bindable (Escape, tilde/console, unrecognized).
function toCs2Alias(e: KeyboardEvent): string | null {
  const { key, location } = e

  // Numpad keys (location === 3)
  if (location === 3) {
    const numpad: Record<string, string> = {
      // NumLock on — digits and operators
      '0': 'kp_0', '1': 'kp_1', '2': 'kp_2', '3': 'kp_3', '4': 'kp_4',
      '5': 'kp_5', '6': 'kp_6', '7': 'kp_7', '8': 'kp_8', '9': 'kp_9',
      '.': 'kp_del', '+': 'kp_plus', '-': 'kp_minus', '*': 'kp_multiply',
      '/': 'kp_divide', 'Enter': 'kp_enter',
      // NumLock off — nav keys reported through numpad
      'Insert': 'kp_0', 'Delete': 'kp_del',
      'End': 'kp_1', 'ArrowDown': 'kp_2', 'PageDown': 'kp_3',
      'ArrowLeft': 'kp_4', 'Clear': 'kp_5', 'ArrowRight': 'kp_6',
      'Home': 'kp_7', 'ArrowUp': 'kp_8', 'PageUp': 'kp_9',
    }
    return numpad[key] ?? null
  }

  // Modifier keys — location 1 = left, 2 = right
  if (key === 'Shift') return 'shift'
  if (key === 'Control') return location === 2 ? 'rctrl' : 'ctrl'
  if (key === 'Alt') return location === 2 ? 'ralt' : 'alt'

  // Named keys with non-obvious aliases
  const named: Record<string, string> = {
    ' ': 'space',
    'Enter': 'enter',
    'Backspace': 'backspace',
    'Tab': 'tab',
    'CapsLock': 'capslock',
    'Insert': 'ins',
    'Delete': 'del',
    'Home': 'home',
    'End': 'end',
    'PageUp': 'pgup',
    'PageDown': 'pgdn',
    'ArrowUp': 'uparrow',
    'ArrowDown': 'downarrow',
    'ArrowLeft': 'leftarrow',
    'ArrowRight': 'rightarrow',
    'F1': 'f1', 'F2': 'f2', 'F3': 'f3', 'F4': 'f4',
    'F5': 'f5', 'F6': 'f6', 'F7': 'f7', 'F8': 'f8',
    'F9': 'f9', 'F10': 'f10', 'F11': 'f11', 'F12': 'f12',
    ';': 'semicolon',
  }
  if (key in named) return named[key]

  // Single printable characters that CS2 uses verbatim (letters, digits, most punctuation).
  // Exclude backtick/tilde (console toggle in CS2) and Escape.
  if (key.length === 1 && key !== '`' && key !== '~') return key.toLowerCase()

  return null
}

export default function Settings() {
  const adapter = useGuideAdapter()
  const [annotationsRoot, setAnnotationsRootState] = useState('')
  const [workshopContentPath, setWorkshopContentPathState] = useState('')
  const [autoCopyLoadCommandsOnOpen, setAutoCopyLoadCommandsOnOpen] = useState(false)
  const [cfgKeybind, setCfgKeybindState] = useState('f8')
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState<'idle' | 'detecting' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [bindCopied, setBindCopied] = useState(false)

  useEffect(() => {
    adapter.getAnnotationsRoot?.().then((value) => setAnnotationsRootState(value ?? ''))
    if (typeof adapter.getWorkshopContentPath === 'function') {
      adapter.getWorkshopContentPath().then((value) => setWorkshopContentPathState(value ?? ''))
    }
    if (typeof adapter.getAutoCopyLoadCommandsOnOpen === 'function') {
      adapter.getAutoCopyLoadCommandsOnOpen().then((value) => setAutoCopyLoadCommandsOnOpen(Boolean(value)))
    }
    if (typeof adapter.getCfgKeybind === 'function') {
      adapter.getCfgKeybind().then((value) => setCfgKeybindState(value ?? 'f8'))
    }
  }, [])

  // Key recording — attach a capture-phase listener so we intercept before anything else.
  useEffect(() => {
    if (!recording) return
    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') { setRecording(false); return }
      const alias = toCs2Alias(e)
      if (alias) { setCfgKeybindState(alias); setRecording(false) }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [recording])

  const handleDetect = async () => {
    setStatus('detecting')
    setMessage('')
    const result = await adapter.detectSteamPath?.()
    if (!result) {
      setStatus('error')
      setMessage('Steam detection is not available on this platform.')
      return
    }
    if ('error' in result) {
      setStatus('error')
      setMessage(result.error)
      return
    }
    setAnnotationsRootState(result.annotationsRoot)
    if ('workshopContentPath' in result) setWorkshopContentPathState(result.workshopContentPath)
    await adapter.setAnnotationsRoot?.(result.annotationsRoot)
    if (typeof adapter.setWorkshopContentPath === 'function' && 'workshopContentPath' in result) {
      await adapter.setWorkshopContentPath(result.workshopContentPath)
    }
    setStatus('saved')
    setMessage(`Detected Steam at ${result.path}. Both folders set.`)
  }

  const handleSave = async () => {
    setStatus('idle')
    setMessage('')
    await adapter.setAnnotationsRoot?.(annotationsRoot)
    if (typeof adapter.setWorkshopContentPath === 'function') {
      await adapter.setWorkshopContentPath(workshopContentPath)
    }
    if (typeof adapter.setAutoCopyLoadCommandsOnOpen === 'function') {
      await adapter.setAutoCopyLoadCommandsOnOpen(autoCopyLoadCommandsOnOpen)
    }
    if (typeof adapter.setCfgKeybind === 'function') {
      const key = cfgKeybind.trim().toLowerCase() || 'f8'
      setCfgKeybindState(key)
      await adapter.setCfgKeybind(key)
    }
    setStatus('saved')
    setMessage('Settings saved.')
  }

  return (
    <div className="max-w-xl overflow-y-auto flex-1">
      <h1 className="mt-0 mb-2 text-2xl">Settings</h1>
      <p className="text-zinc-400 text-sm mb-4">
        Set the CS2 annotations folder (local guides) and/or Workshop content folder (subscribed map
        guides). At least one is needed to see guides.
      </p>

      <div className="mb-4">
        <label className="block mb-1 text-sm text-zinc-400">Annotations folder (local)</label>
        <input
          type="text"
          value={annotationsRoot}
          onChange={(e) => setAnnotationsRootState(e.target.value)}
          placeholder="...\game\csgo\annotations\local"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-500 max-w-none"
        />
      </div>

      <div className="mb-4">
        <label className="block mb-1 text-sm text-zinc-400">Workshop content folder (CS2 map guides)</label>
        <input
          type="text"
          value={workshopContentPath}
          onChange={(e) => setWorkshopContentPathState(e.target.value)}
          placeholder="...\steamapps\workshop\content\730"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-500 max-w-none"
        />
      </div>

      <div className="mb-4">
        <button type="button" className={btn} onClick={handleDetect} disabled={status === 'detecting'}>
          {status === 'detecting' ? 'Detecting…' : 'Detect from Steam'}
        </button>
      </div>

      {typeof adapter.getAutoCopyLoadCommandsOnOpen === 'function' && (
        <div className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="auto-copy-load"
            checked={autoCopyLoadCommandsOnOpen}
            onChange={(e) => setAutoCopyLoadCommandsOnOpen(e.target.checked)}
            className="w-4 h-4 accent-zinc-500 cursor-pointer"
          />
          <label htmlFor="auto-copy-load" className="text-sm text-zinc-300 cursor-pointer">
            Auto-copy load commands when opening a guide (sv_cheats, sv_allow_annotations_access_level, annotation_load)
          </label>
        </div>
      )}

      {typeof adapter.getCfgKeybind === 'function' && (
        <div className="mb-5">
          <label className="block mb-1 text-sm text-zinc-400">CS2 execution keybind</label>
          <div className="flex items-center gap-2">
            <div className="px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 text-sm font-mono w-24 text-center select-none">
              {cfgKeybind.trim() || 'f8'}
            </div>
            {recording ? (
              <button
                type="button"
                onClick={() => setRecording(false)}
                className="px-3 py-2 bg-violet-900/40 border border-violet-700 rounded text-violet-300 text-sm animate-pulse cursor-pointer"
              >
                Press a key… (Esc to cancel)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRecording(true)}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 text-sm transition-colors cursor-pointer"
              >
                Record key
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-600 mt-1.5 mb-2">
            The key you want to press in CS2 to execute the command file.
            Run the line below in CS2 console once to set it up.
          </p>
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded text-xs font-mono">
            <span className="text-emerald-400 flex-1 select-all">
              bind {cfgKeybind.trim() || 'f8'} exec annotation_manager
            </span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(`bind ${cfgKeybind.trim() || 'f8'} exec annotation_manager`)
                setBindCopied(true)
                setTimeout(() => setBindCopied(false), 1500)
              }}
              className="shrink-0 px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 transition-colors"
            >
              {bindCopied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-zinc-800 flex items-center gap-3">
        <button type="button" className={`${btn} bg-violet-700 hover:bg-violet-600`} onClick={handleSave}>
          Save
        </button>
        {message && (
          <p className={`text-sm m-0 ${status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>{message}</p>
        )}
      </div>
    </div>
  )
}
