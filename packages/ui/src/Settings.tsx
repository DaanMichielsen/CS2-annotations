import { useState, useEffect } from 'react'
import { useGuideAdapter } from './GuideAdapterContext'

const btn = 'px-4 py-2 bg-zinc-700 hover:bg-zinc-600 border-none rounded text-zinc-200 cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors'

export default function Settings() {
  const adapter = useGuideAdapter()
  const [annotationsRoot, setAnnotationsRootState] = useState('')
  const [workshopContentPath, setWorkshopContentPathState] = useState('')
  const [autoCopyLoadCommandsOnOpen, setAutoCopyLoadCommandsOnOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'detecting' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    adapter.getAnnotationsRoot?.().then((value) => setAnnotationsRootState(value ?? ''))
    if (typeof adapter.getWorkshopContentPath === 'function') {
      adapter.getWorkshopContentPath().then((value) => setWorkshopContentPathState(value ?? ''))
    }
    if (typeof adapter.getAutoCopyLoadCommandsOnOpen === 'function') {
      adapter.getAutoCopyLoadCommandsOnOpen().then((value) => setAutoCopyLoadCommandsOnOpen(Boolean(value)))
    }
  }, [])

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

      {typeof adapter.getAutoCopyLoadCommandsOnOpen === 'function' && (
        <div className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="auto-copy-load"
            checked={autoCopyLoadCommandsOnOpen}
            onChange={async (e) => {
              const v = e.target.checked
              setAutoCopyLoadCommandsOnOpen(v)
              await adapter.setAutoCopyLoadCommandsOnOpen?.(v)
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
