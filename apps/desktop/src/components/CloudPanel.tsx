import { useState, useEffect, useCallback } from 'react'
import type { OpenGuideInfo } from '@cs2ann/ui'

function syncDotColor(state: SyncState | null): string {
  if (!state) return 'bg-zinc-600'
  if (state.synced) return 'bg-emerald-500'
  if (state.behind) return 'bg-yellow-500'
  if (state.cloudId) return 'bg-orange-500'
  return 'bg-zinc-600'
}

function syncStatusText(state: SyncState | null): string {
  if (!state) return 'Checking…'
  if (state.synced) return 'Up to date'
  if (state.behind) return 'Cloud has newer version'
  if (state.cloudId) return 'Local changes not pushed'
  return 'Not backed up yet'
}

interface SyncState {
  synced: boolean
  cloudId?: string
  localVersion?: number
  cloudVersion?: number
  behind?: boolean
}

interface CloudGuide {
  id: string
  title: string
  map: string
  version: number
}

interface Props {
  guide: OpenGuideInfo
  onStatusChange?: (dotColor: string, statusText: string) => void
}

const btn = 'px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const btnPrimary = `${btn} bg-indigo-700 hover:bg-indigo-600 text-white`
const btnSecondary = `${btn} bg-zinc-700 hover:bg-zinc-600 text-zinc-200`

export default function CloudPanel({ guide, onStatusChange }: Props) {
  const [authState, setAuthState] = useState<{ token: string | null; name: string; avatar: string } | null>(null)
  const [syncState, setSyncState] = useState<SyncState | null>(null)
  const [cloudGuides, setCloudGuides] = useState<CloudGuide[]>([])
  const [loadingSync, setLoadingSync] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')

  const loadSyncState = useCallback(async () => {
    if (!guide.filePath) return
    setLoadingSync(true)
    try {
      const state = await window.electronAPI.cloudGetSyncState(guide.filePath)
      setSyncState(state)
    } finally {
      setLoadingSync(false)
    }
  }, [guide.filePath])

  useEffect(() => {
    window.electronAPI.getAuthState().then(setAuthState)
    const unsub = window.electronAPI.onAuthStateChanged(setAuthState)
    return unsub
  }, [])

  useEffect(() => {
    setSyncState(null)
    setStatusMsg('')
    setError('')
    if (authState?.token) {
      void loadSyncState()
      void window.electronAPI.cloudListGuides().then((r) => {
        if (r.guides) setCloudGuides(r.guides)
      })
    }
  }, [guide.filePath, authState?.token, loadSyncState])

  useEffect(() => {
    onStatusChange?.(syncDotColor(syncState), syncStatusText(syncState))
  }, [syncState, onStatusChange])

  async function handlePush() {
    setPushing(true)
    setError('')
    setStatusMsg('')
    try {
      const res = await window.electronAPI.cloudPushGuide({
        filePath: guide.filePath,
        title: guide.name,
        map: guide.mapName ?? '',
        nodeCount: guide.nodeCount,
        cloudId: syncState?.cloudId,
        cloudVersion: syncState?.cloudVersion,
      })
      if (res.conflict) {
        setError(`Conflict: cloud is at version ${res.cloudVersion}. Pull first then push again.`)
      } else if (res.error) {
        setError(res.error)
      } else {
        setStatusMsg('Pushed successfully')
        await loadSyncState()
      }
    } finally {
      setPushing(false)
    }
  }

  async function handlePull() {
    if (!syncState?.cloudId) return
    setPulling(true)
    setError('')
    setStatusMsg('')
    try {
      const res = await window.electronAPI.cloudPullGuide({
        cloudId: syncState.cloudId,
        filePath: guide.filePath,
      })
      if (res.error) {
        setError(res.error)
      } else {
        setStatusMsg('Pulled successfully — reload guide to see changes')
        await loadSyncState()
      }
    } finally {
      setPulling(false)
    }
  }

  if (!authState) return null

  if (!authState.token) {
    return (
      <div className="p-4 text-zinc-500 text-xs">
        <p className="m-0 mb-1 font-semibold text-zinc-400">Cloud backup</p>
        <p className="m-0">Sign in to enable cloud backup for this guide.</p>
      </div>
    )
  }

  const isSynced = syncState?.synced
  const isBehind = syncState?.behind
  const hasCloudCopy = !!syncState?.cloudId

  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="m-0 text-[0.7rem] text-zinc-500 uppercase tracking-wider font-semibold">Cloud backup</p>

      <div className="text-xs text-zinc-400 truncate" title={guide.name}>
        {guide.name}
        {guide.mapName && <span className="ml-1 text-zinc-600">({guide.mapName})</span>}
      </div>

      {loadingSync && <p className="m-0 text-xs text-zinc-600">Checking sync…</p>}

      {!loadingSync && syncState && (
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${isSynced ? 'bg-emerald-500' : isBehind ? 'bg-yellow-500' : hasCloudCopy ? 'bg-orange-500' : 'bg-zinc-600'}`}
          />
          <span className="text-xs text-zinc-400">
            {isSynced
              ? 'Up to date'
              : isBehind
              ? 'Cloud has newer version'
              : hasCloudCopy
              ? 'Local changes not pushed'
              : 'Not backed up yet'}
          </span>
        </div>
      )}

      {error && <p className="m-0 text-xs text-red-400">{error}</p>}
      {statusMsg && <p className="m-0 text-xs text-emerald-400">{statusMsg}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          className={btnPrimary}
          onClick={handlePush}
          disabled={pushing || pulling}
          title="Upload local guide to cloud"
        >
          {pushing ? 'Pushing…' : 'Push'}
        </button>
        {hasCloudCopy && (
          <button
            type="button"
            className={btnSecondary}
            onClick={handlePull}
            disabled={pulling || pushing}
            title="Download cloud guide to local file (creates .bak backup)"
          >
            {pulling ? 'Pulling…' : 'Pull'}
          </button>
        )}
        <button
          type="button"
          className={btnSecondary}
          onClick={loadSyncState}
          disabled={loadingSync || pushing || pulling}
          title="Refresh sync status"
        >
          ↻
        </button>
      </div>

      {cloudGuides.length > 0 && (
        <div className="mt-2">
          <p className="m-0 mb-1.5 text-[0.65rem] text-zinc-600 uppercase tracking-wider">All cloud guides</p>
          <ul className="list-none m-0 p-0 space-y-1">
            {cloudGuides.map((g) => (
              <li
                key={g.id}
                className={`text-xs px-2 py-1 rounded truncate ${g.id === syncState?.cloudId ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500'}`}
                title={g.title}
              >
                {g.title}
                {g.map && <span className="ml-1 text-zinc-600">({g.map})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}
