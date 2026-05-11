import { useState, useEffect, useCallback } from 'react'
import { Upload, Download, RefreshCw, CloudOff } from 'lucide-react'
import type { GuideSummary } from '@cs2ann/shared'
import type { GuideSyncState } from '@cs2ann/shared'
import { getMapColor } from '@cs2ann/shared'

interface AuthState {
  token: string | null
  name: string
  avatar: string
}

interface Props {
  guides: GuideSummary[]
  statuses: Record<string, GuideSyncState>
  loading: boolean
  onRefresh: () => void
  onStatusChange?: (dotColor: string, statusText: string) => void
}

const btnIcon = 'p-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
const btnPrimary = `${btnIcon} text-violet-300 hover:bg-violet-900/40`
const btnSecondary = `${btnIcon} text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200`

interface GuideRowProps {
  guide: GuideSummary
  action: React.ReactNode
  pushing: Set<string>
  pulling: Set<string>
  messages: Record<string, string>
  errors: Record<string, string>
  statuses: Record<string, GuideSyncState>
}

function GuideRow({ guide, action, pushing, pulling, messages, errors, statuses }: GuideRowProps) {
  const { accent } = getMapColor(guide.mapName)
  const isPushing = pushing.has(guide.id)
  const isPulling = pulling.has(guide.id)
  const msg = messages[guide.id]
  const err = errors[guide.id]
  const isNew = statuses[guide.id]?.status === 'not_in_cloud'
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 border-l-2"
      style={{ borderLeftColor: accent }}
    >
      <span className="flex-1 text-xs text-zinc-300 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
        {guide.name}
        {isNew && (
          <span className="ml-1.5 text-[0.6rem] px-1 py-0.5 bg-zinc-700 text-zinc-400 rounded">NEW</span>
        )}
      </span>
      {err && <span className="text-[0.6rem] text-red-400 shrink-0">{err}</span>}
      {msg && !err && <span className="text-[0.6rem] text-emerald-400 shrink-0">{msg}</span>}
      <div className="shrink-0 flex items-center gap-1">
        {(isPushing || isPulling) ? (
          <RefreshCw size={13} className="text-zinc-500 animate-spin" />
        ) : action}
      </div>
    </div>
  )
}

function SectionHeader({
  label,
  count,
  color,
  action,
}: {
  label: string
  count: number
  color: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <div className="flex items-center gap-2">
        <span
          className="text-[0.65rem] font-bold uppercase tracking-wider"
          style={{ color, fontFamily: 'var(--font-display)' }}
        >
          {label}
        </span>
        <span className="text-[0.6rem] px-1 py-0.5 bg-zinc-800 text-zinc-500 rounded-full">{count}</span>
      </div>
      {action}
    </div>
  )
}

export default function CloudPanel({ guides, statuses, loading, onRefresh, onStatusChange }: Props) {
  const [authState, setAuthState] = useState<AuthState | null>(null)
  const [pushing, setPushing] = useState<Set<string>>(new Set())
  const [pulling, setPulling] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [syncedCollapsed, setSyncedCollapsed] = useState(true)

  useEffect(() => {
    window.electronAPI.getAuthState().then(setAuthState)
    const unsub = window.electronAPI.onAuthStateChanged(setAuthState)
    return unsub
  }, [])

  useEffect(() => {
    const vals = Object.values(statuses).map((s) => s.status)
    if (vals.some((s) => s === 'cloud_ahead')) {
      onStatusChange?.('bg-yellow-500', 'Some guides need pulling')
    } else if (vals.some((s) => s === 'local_ahead' || s === 'not_in_cloud')) {
      onStatusChange?.('bg-orange-500', 'Some guides not pushed')
    } else if (vals.length > 0 && vals.every((s) => s === 'synced')) {
      onStatusChange?.('bg-emerald-500', 'All guides synced')
    } else {
      onStatusChange?.('bg-zinc-600', loading ? 'Checking…' : 'Cloud sync')
    }
  }, [statuses, loading, onStatusChange])

  const handlePush = useCallback(async (guide: GuideSummary) => {
    const state = statuses[guide.id]
    setPushing((prev) => new Set(prev).add(guide.id))
    setErrors((prev) => { const n = { ...prev }; delete n[guide.id]; return n })
    setMessages((prev) => { const n = { ...prev }; delete n[guide.id]; return n })
    try {
      const res = await window.electronAPI.cloudPushGuide({
        filePath: guide.id,
        title: guide.name,
        map: guide.mapName ?? '',
        nodeCount: 0,
        cloudId: state?.cloudId,
        cloudVersion: state?.cloudVersion,
      })
      if ((res as { conflict?: boolean }).conflict) {
        setErrors((prev) => ({ ...prev, [guide.id]: 'Conflict — pull first' }))
      } else if ((res as { error?: string }).error) {
        setErrors((prev) => ({ ...prev, [guide.id]: (res as { error: string }).error }))
      } else {
        setMessages((prev) => ({ ...prev, [guide.id]: '✓ Pushed' }))
        onRefresh()
      }
    } finally {
      setPushing((prev) => { const n = new Set(prev); n.delete(guide.id); return n })
    }
  }, [statuses, onRefresh])

  const handlePull = useCallback(async (guide: GuideSummary) => {
    const state = statuses[guide.id]
    if (!state?.cloudId) return
    setPulling((prev) => new Set(prev).add(guide.id))
    setErrors((prev) => { const n = { ...prev }; delete n[guide.id]; return n })
    setMessages((prev) => { const n = { ...prev }; delete n[guide.id]; return n })
    try {
      const res = await window.electronAPI.cloudPullGuide({ cloudId: state.cloudId, filePath: guide.id })
      if ((res as { error?: string }).error) {
        setErrors((prev) => ({ ...prev, [guide.id]: (res as { error: string }).error }))
      } else {
        setMessages((prev) => ({ ...prev, [guide.id]: '✓ Pulled' }))
        onRefresh()
      }
    } finally {
      setPulling((prev) => { const n = new Set(prev); n.delete(guide.id); return n })
    }
  }, [statuses, onRefresh])

  const pushAll = useCallback(async (guideList: GuideSummary[]) => {
    for (const g of guideList) await handlePush(g)
  }, [handlePush])

  const pullAll = useCallback(async (guideList: GuideSummary[]) => {
    for (const g of guideList) await handlePull(g)
  }, [handlePull])

  if (!authState) return null

  if (!authState.token) {
    return (
      <div className="flex-1 min-h-0 p-4 flex flex-col gap-2">
        <p
          className="m-0 text-[0.7rem] text-zinc-500 uppercase tracking-wider font-semibold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Cloud sync
        </p>
        <p className="m-0 text-xs text-zinc-500">Sign in to enable cloud sync.</p>
      </div>
    )
  }

  const localGuides = guides.filter((g) => g.source === 'local')
  const behind = localGuides.filter((g) => statuses[g.id]?.status === 'cloud_ahead')
  const notPushed = localGuides.filter((g) => {
    const s = statuses[g.id]?.status
    return s === 'not_in_cloud' || s === 'local_ahead'
  })
  const synced = localGuides.filter((g) => statuses[g.id]?.status === 'synced')

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 py-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pb-1 border-b border-zinc-800 mb-1">
        <span
          className="text-[0.7rem] text-zinc-500 uppercase tracking-wider font-semibold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Cloud sync
        </span>
        <button
          type="button"
          className={`${btnSecondary}`}
          onClick={onRefresh}
          disabled={loading}
          title="Refresh sync status"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* BEHIND section */}
      {behind.length > 0 && (
        <div>
          <SectionHeader
            label="Behind"
            count={behind.length}
            color="#eab308"
            action={
              <button
                type="button"
                className="text-[0.6rem] text-yellow-600 hover:text-yellow-400 transition-colors"
                onClick={() => void pullAll(behind)}
                disabled={pulling.size > 0}
              >
                Pull all
              </button>
            }
          />
          {behind.map((g) => (
            <GuideRow
              key={g.id}
              guide={g}
              action={
                <button
                  type="button"
                  className={btnSecondary}
                  title="Pull from cloud"
                  onClick={() => void handlePull(g)}
                  disabled={pulling.has(g.id) || pushing.has(g.id)}
                >
                  <Download size={13} />
                </button>
              }
              pushing={pushing}
              pulling={pulling}
              messages={messages}
              errors={errors}
              statuses={statuses}
            />
          ))}
        </div>
      )}

      {/* NOT PUSHED section */}
      {notPushed.length > 0 && (
        <div>
          <SectionHeader
            label="Not pushed"
            count={notPushed.length}
            color="#f97316"
            action={
              <button
                type="button"
                className="text-[0.6rem] text-orange-600 hover:text-orange-400 transition-colors"
                onClick={() => void pushAll(notPushed)}
                disabled={pushing.size > 0}
              >
                Push all
              </button>
            }
          />
          {notPushed.map((g) => (
            <GuideRow
              key={g.id}
              guide={g}
              action={
                <button
                  type="button"
                  className={btnPrimary}
                  title="Push to cloud"
                  onClick={() => void handlePush(g)}
                  disabled={pushing.has(g.id) || pulling.has(g.id)}
                >
                  <Upload size={13} />
                </button>
              }
              pushing={pushing}
              pulling={pulling}
              messages={messages}
              errors={errors}
              statuses={statuses}
            />
          ))}
        </div>
      )}

      {/* SYNCED section (collapsed by default) */}
      {synced.length > 0 && (
        <div>
          <button
            type="button"
            className="w-full text-left"
            onClick={() => setSyncedCollapsed((v) => !v)}
          >
            <SectionHeader
              label={syncedCollapsed ? `Synced ▸` : `Synced ▾`}
              count={synced.length}
              color="#22c55e"
            />
          </button>
          {!syncedCollapsed && synced.map((g) => (
            <GuideRow
              key={g.id}
              guide={g}
              action={null}
              pushing={pushing}
              pulling={pulling}
              messages={messages}
              errors={errors}
              statuses={statuses}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {localGuides.length === 0 && !loading && (
        <div className="px-3 py-4 flex flex-col items-center gap-2 text-zinc-600">
          <CloudOff size={20} />
          <p className="m-0 text-xs text-center">No local guides to sync.</p>
        </div>
      )}

      {loading && localGuides.length === 0 && (
        <div className="px-3 py-2 text-xs text-zinc-600">Checking…</div>
      )}
    </div>
  )
}
