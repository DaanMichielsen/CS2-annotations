import { useState, useEffect } from 'react'

declare const window: Window & {
  electronAPI: {
    getAnnotationsRoot: () => Promise<string>
    setAnnotationsRoot: (root: string) => Promise<void>
    getWorkshopContentPath: () => Promise<string>
    setWorkshopContentPath: (p: string) => Promise<void>
    detectSteamPath: () => Promise<
      | { path: string; annotationsRoot: string; workshopContentPath: string }
      | { error: string }
    >
  }
}

const btn = 'px-4 py-2 bg-zinc-700 hover:bg-zinc-600 border-none rounded text-zinc-200 cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors'

export default function Settings() {
  const [annotationsRoot, setAnnotationsRootState] = useState('')
  const [workshopContentPath, setWorkshopContentPathState] = useState('')
  const [autoCopyLoadCommandsOnOpen, setAutoCopyLoadCommandsOnOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'detecting' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    window.electronAPI.getAnnotationsRoot().then(setAnnotationsRootState)
    if (typeof window.electronAPI.getWorkshopContentPath === 'function') {
      window.electronAPI.getWorkshopContentPath().then(setWorkshopContentPathState)
    }
    if (typeof window.electronAPI.getAutoCopyLoadCommandsOnOpen === 'function') {
      window.electronAPI.getAutoCopyLoadCommandsOnOpen().then(setAutoCopyLoadCommandsOnOpen)
    }
  }, [])

  const handleDetect = async () => {
    setStatus('detecting')
    setMessage('')
    const result = await window.electronAPI.detectSteamPath()
    if ('error' in result) {
      setStatus('error')
      setMessage(result.error)
      return
    }
    setAnnotationsRootState(result.annotationsRoot)
    if ('workshopContentPath' in result) setWorkshopContentPathState(result.workshopContentPath)
    await window.electronAPI.setAnnotationsRoot(result.annotationsRoot)
    if (typeof window.electronAPI.setWorkshopContentPath === 'function' && 'workshopContentPath' in result) {
      await window.electronAPI.setWorkshopContentPath(result.workshopContentPath)
    }
    setStatus('saved')
    setMessage(`Detected Steam at ${result.path}. Both folders set.`)
  }

  const handleSave = async () => {
    setStatus('idle')
    setMessage('')
    await window.electronAPI.setAnnotationsRoot(annotationsRoot)
    if (typeof window.electronAPI.setWorkshopContentPath === 'function') {
      await window.electronAPI.setWorkshopContentPath(workshopContentPath)
    }
    if (typeof window.electronAPI.setAutoCopyLoadCommandsOnOpen === 'function') {
      await window.electronAPI.setAutoCopyLoadCommandsOnOpen(autoCopyLoadCommandsOnOpen)
    }
    setStatus('saved')
    setMessage('Paths saved.')
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

      <div className="flex gap-2 mb-4">
        <button type="button" className={btn} onClick={handleDetect} disabled={status === 'detecting'}>
          {status === 'detecting' ? 'Detecting…' : 'Detect from Steam'}
        </button>
        <button type="button" className={btn} onClick={handleSave}>
          Save paths
        </button>
      </div>

      {typeof window.electronAPI.getAutoCopyLoadCommandsOnOpen === 'function' && (
        <div className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="auto-copy-load"
            checked={autoCopyLoadCommandsOnOpen}
            onChange={async (e) => {
              const v = e.target.checked
              setAutoCopyLoadCommandsOnOpen(v)
              await window.electronAPI.setAutoCopyLoadCommandsOnOpen(v)
            }}
            className="w-4 h-4 accent-zinc-500 cursor-pointer"
          />
          <label htmlFor="auto-copy-load" className="text-sm text-zinc-300 cursor-pointer">
            Auto-copy load commands when opening a guide (sv_cheats, sv_allow_annotations_access_level, annotation_load)
          </label>
        </div>
      )}

      {message && (
        <p className={`text-sm ${status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>{message}</p>
      )}
    </div>
  )
}
