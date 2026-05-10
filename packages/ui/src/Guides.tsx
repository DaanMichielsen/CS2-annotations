import { useState, useEffect } from 'react'
import { FolderInput } from 'lucide-react'
import type { AnnotationNode } from '@cs2ann/shared'
import { getMapColor, KNOWN_MAPS } from '@cs2ann/shared'
import type { GuideSyncState } from '@cs2ann/shared'
import GuideEditor from './GuideEditor'
import { useGuideAdapter } from './GuideAdapterContext'

type GuideSource = 'local' | 'workshop'

interface GuideItem {
  name: string
  path: string
  source: GuideSource
  mapName?: string
  workshopId?: string
  installed: boolean
}

const FEATURED_IDS = new Set([
  '3387810001', '3387870747', '3388581972', '3388611848',
  '3388638091', '3388681214', '3388737112', '3388761697',
])

interface OpenGuide {
  name: string
  filePath: string
  mapName?: string
  source: GuideSource
  root: Record<string, unknown>
  nodes: AnnotationNode[]
  nodesKey: string
}

export interface OpenGuideInfo {
  filePath: string
  name: string
  mapName?: string
  nodeCount?: number
}

interface GuidesProps {
  onGuideChange?: (guide: OpenGuideInfo | null) => void
  cloudStatuses?: Record<string, GuideSyncState>
  onCloudRefresh?: () => void
}

const btn =
  'px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded text-zinc-200 cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors'

function StatusDot({ state }: { state: GuideSyncState | undefined }) {
  let colorClass = 'bg-zinc-700'
  let label = 'Sync status unknown'
  if (state) {
    switch (state.status) {
      case 'synced':       colorClass = 'bg-emerald-500'; label = 'Synced with cloud'; break
      case 'cloud_ahead':  colorClass = 'bg-yellow-500';  label = 'Cloud has newer version — pull to update'; break
      case 'local_ahead':  colorClass = 'bg-orange-500';  label = 'Local changes not pushed'; break
      case 'not_in_cloud': colorClass = 'bg-zinc-500';    label = 'Not backed up to cloud'; break
      case 'loading':      colorClass = 'bg-zinc-700';    label = 'Checking cloud status…'; break
    }
  }
  return (
    <span
      className={`shrink-0 w-2 h-2 rounded-full ${colorClass}`}
      title={label}
      aria-label={label}
    />
  )
}

function MapChip({ mapName }: { mapName?: string }) {
  if (!mapName) return null
  const { accent, dim, label, icon } = getMapColor(mapName)
  if (!label) return null
  return (
    <span
      className="shrink-0 flex items-center gap-1 text-[0.65rem] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
      style={{ color: accent, backgroundColor: dim }}
    >
      {icon && <img src={icon} alt="" width={12} height={12} className="shrink-0" />}
      {label}
    </span>
  )
}

export default function Guides({ onGuideChange, cloudStatuses = {}, onCloudRefresh }: GuidesProps = {}) {
  const adapter = useGuideAdapter()
  const [guides, setGuides] = useState<GuideItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openGuide, setOpenGuide] = useState<OpenGuide | null>(null)
  const [loadError, setLoadError] = useState('')
  const [newGuideName, setNewGuideName] = useState('')
  const [newMapName, setNewMapName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [mapFilter, setMapFilter] = useState<string | null>(null)

  useEffect(() => { loadGuides() }, [])

  useEffect(() => {
    if (!onGuideChange) return
    if (!openGuide) { onGuideChange(null); return }
    const mapName = (openGuide.root['MapName'] as string | undefined) ?? openGuide.mapName
    onGuideChange({ filePath: openGuide.filePath, name: openGuide.name, mapName, nodeCount: openGuide.nodes.length })
  }, [openGuide])

  async function loadGuides() {
    setLoading(true)
    setError('')
    try {
      const list = await adapter.listGuides()
      setGuides(list.map((g) => ({
        name: g.name,
        path: g.id,
        source: g.source as GuideSource,
        mapName: g.mapName,
        workshopId: g.workshopId,
        installed: g.installed ?? true,
      })))
      const hasAnyPath =
        (await adapter.getAnnotationsRoot?.()) ||
        (await adapter.getWorkshopContentPath?.())
      if (!hasAnyPath && list.length === 0) {
        setError('Set the annotations folder and/or Workshop content folder in Settings.')
      } else {
        setError('')
      }
    } catch (e) {
      setError(String(e))
      setGuides([])
    } finally {
      setLoading(false)
    }
  }

  async function openGuideByPath(name: string, filePath: string, source: GuideSource = filePath.toLowerCase().includes('workshop') ? 'workshop' : 'local') {
    setLoadError('')
    const result = await adapter.loadGuide(filePath)
    if ('error' in result) { setLoadError(result.error); return }
    setOpenGuide({ name, filePath, source, root: result.root as Record<string, unknown>, nodes: result.nodes, nodesKey: result.nodesKey })
    if (typeof adapter.getAutoCopyLoadCommandsOnOpen === 'function') {
      const autoCopy = await adapter.getAutoCopyLoadCommandsOnOpen()
      if (autoCopy) {
        const lines = 'sv_cheats 1; sv_allow_annotations_access_level 2; annotation_load ' + name
        void navigator.clipboard.writeText(lines)
      }
    }
  }

  async function createAndOpenGuide() {
    const name = newGuideName.trim()
    if (!name) return
    setCreating(true)
    setCreateError('')
    const result = await adapter.createGuide({ filename: name, mapName: newMapName.trim() || undefined })
    if (result.error) { setCreateError(result.error); setCreating(false); return }
    setNewGuideName('')
    setCreating(false)
    await loadGuides()
    const loadName = result.loadName ?? name.replace(/\s+/g, '_')
    const root = await adapter.getAnnotationsRoot?.()
    if (!root) return
    const localPath = [root.replace(/[/\\]+$/, ''), loadName, loadName + '.txt'].join('\\')
    await openGuideByPath(loadName, localPath, 'local')
  }

  function loadGuideCommand(name: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    void navigator.clipboard.writeText(`annotation_load ${name}`)
  }

  async function handleCloudPush() {
    if (!openGuide) return
    const state = cloudStatuses[openGuide.filePath]
    await (window.electronAPI as any).cloudPushGuide({
      filePath: openGuide.filePath,
      title: openGuide.name,
      map: (openGuide.root['MapName'] as string | undefined) ?? openGuide.mapName ?? '',
      nodeCount: openGuide.nodes.length,
      cloudId: state?.cloudId,
      cloudVersion: state?.cloudVersion,
    })
    onCloudRefresh?.()
  }

  async function handleCloudPull() {
    if (!openGuide) return
    const state = cloudStatuses[openGuide.filePath]
    if (!state?.cloudId) return
    await (window.electronAPI as any).cloudPullGuide({ cloudId: state.cloudId, filePath: openGuide.filePath })
    onCloudRefresh?.()
  }

  if (openGuide) {
    const isWorkshop = openGuide.source === 'workshop'
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <GuideEditor
          guideName={openGuide.name}
          filePath={openGuide.filePath}
          isWorkshop={isWorkshop}
          canDelete={openGuide.source === 'local'}
          nodes={openGuide.nodes}
          root={openGuide.root}
          nodesKey={openGuide.nodesKey}
          onSave={async (nodes: AnnotationNode[], root: Record<string, unknown>, nodesKey: string) => {
            const res = await adapter.saveGuide({ id: openGuide.filePath, root, nodes, nodesKey, createBackup: true })
            if (!res.error) setOpenGuide((prev) => (prev ? { ...prev, nodes, root, nodesKey } : null))
            return res
          }}
          onSaveAsLocalGuide={isWorkshop
            ? async (localName: string, root: Record<string, unknown>, nodes: AnnotationNode[]) => {
                const res = await adapter.saveAsLocal({ root, nodes, nodesKey: openGuide.nodesKey, localName })
                if (!res.error && res.id && res.loadName) {
                  await loadGuides()
                  const rootPath = await adapter.getAnnotationsRoot?.()
                  if (!rootPath) return res
                  const localPath = [rootPath.replace(/[/\\]+$/, ''), res.loadName, res.loadName + '.txt'].join('\\')
                  await openGuideByPath(res.loadName, localPath, 'local')
                }
                return res
              }
            : undefined}
          onBack={() => setOpenGuide(null)}
          onDeleted={async () => { await loadGuides() }}
          cloudStatus={openGuide.source === 'local' ? cloudStatuses[openGuide.filePath] : undefined}
          onCloudPush={openGuide.source === 'local' ? () => void handleCloudPush() : undefined}
          onCloudPull={openGuide.source === 'local' ? () => void handleCloudPull() : undefined}
        />
      </div>
    )
  }

  const featured = guides.filter((g) => g.source === 'workshop' && g.workshopId && FEATURED_IDS.has(g.workshopId))
  const yours = guides.filter((g) => !(g.source === 'workshop' && g.workshopId && FEATURED_IDS.has(g.workshopId)))

  function matchesFilters(g: GuideItem): boolean {
    const nameOk = !nameFilter || g.name.toLowerCase().includes(nameFilter.toLowerCase())
    const mapOk = !mapFilter || g.mapName === mapFilter
    return nameOk && mapOk
  }
  const filteredFeatured = featured.filter(matchesFilters)
  const filteredYours = yours.filter(matchesFilters)

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1
          className="m-0 text-2xl font-bold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Guides
        </h1>
        <button type="button" className={btn} onClick={loadGuides} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="flex flex-col gap-2 mb-4 shrink-0">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newGuideName}
            onChange={(e) => setNewGuideName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void createAndOpenGuide() }}
            placeholder="Guide name (e.g. cache_nades)"
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm w-52 focus:outline-none focus:border-zinc-600"
          />
          <input
            type="text"
            value={newMapName}
            onChange={(e) => setNewMapName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void createAndOpenGuide() }}
            placeholder="Map name (e.g. de_cache)"
            title="CS2 map name — required for annotation_load to work"
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm w-48 focus:outline-none focus:border-zinc-600"
          />
          <button
            type="button"
            className="px-4 py-2 rounded text-white text-sm font-semibold cursor-pointer disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: 'var(--color-brand)' }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--color-brand-hover)' }}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-brand)')}
            onClick={createAndOpenGuide}
            disabled={creating || !newGuideName.trim()}
          >
            {creating ? 'Creating…' : 'New guide'}
          </button>
        </div>
        <p className="m-0 text-[0.68rem] text-zinc-600">Map name is written into the file as <code className="bg-zinc-800 px-1 rounded">MapName</code> — CS2 requires it for <code className="bg-zinc-800 px-1 rounded">annotation_load</code> to resolve the file.</p>
      </div>

      {createError && <p className="text-red-400 mb-3 text-sm">{createError}</p>}
      {loadError && <p className="text-red-400 mb-3 text-sm">{loadError}</p>}
      {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}

      {!loading && !error && guides.length === 0 && (
        <p className="text-zinc-400">
          No guides found. Set the annotations folder and/or Workshop content folder (730) in
          Settings, or create a guide above.
        </p>
      )}

      {/* Filter controls */}
      <div className="flex flex-col gap-1.5 mb-3 shrink-0">
        <input
          type="text"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder="Search guides…"
          className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600"
        />
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={`px-1.5 py-0.5 rounded text-[0.65rem] font-semibold uppercase tracking-wide border transition-colors ${
              !mapFilter
                ? 'bg-violet-700 text-white border-transparent'
                : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            onClick={() => setMapFilter(null)}
          >
            All
          </button>
          {KNOWN_MAPS.map((mapName) => {
            const { label, accent, icon } = getMapColor(mapName)
            const isActive = mapFilter === mapName
            return (
              <button
                key={mapName}
                type="button"
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.65rem] font-semibold uppercase tracking-wide border transition-colors ${
                  isActive ? 'border-transparent text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                style={isActive ? { backgroundColor: accent } : undefined}
                onClick={() => setMapFilter(isActive ? null : mapName)}
              >
                {icon && <img src={icon} alt="" width={10} height={10} className="shrink-0" />}
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Featured guides */}
      <div className="mb-1">
        <p
          className="m-0 mb-2 text-[0.7rem] text-zinc-500 uppercase tracking-wider font-semibold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Featured map guides
        </p>
        {featured.length === 0 && (
          <p className="text-zinc-600 text-sm">No featured guides configured. Set Workshop content folder in Settings.</p>
        )}
        {featured.length > 0 && filteredFeatured.length === 0 && (
          <p className="text-zinc-600 text-sm">No featured guides match the filter.</p>
        )}
        <ul className="list-none m-0 p-0 space-y-1">
          {filteredFeatured.map((g) => {
            const { accent } = getMapColor(g.mapName)
            return (
              <li key={g.workshopId}>
                {g.installed ? (
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 min-w-0 px-3 py-2.5 text-left bg-zinc-800/60 hover:bg-zinc-800 rounded text-zinc-200 cursor-pointer text-[0.9rem] transition-colors border-l-[3px]"
                    style={{ borderLeftColor: accent }}
                    onClick={() => openGuideByPath(g.name, g.path, g.source)}
                  >
                    <span
                      className="flex-1 text-left overflow-hidden text-ellipsis whitespace-nowrap font-semibold"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {g.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <MapChip mapName={g.mapName} />
                      <span className="text-[0.65rem] px-1.5 py-0.5 bg-indigo-900/60 text-indigo-300 rounded">Workshop</span>
                    </div>
                  </button>
                ) : (
                  <div
                    className="flex items-center justify-between gap-2 min-w-0 px-3 py-2.5 bg-zinc-800/30 border-l-[3px] rounded text-zinc-500 text-[0.9rem]"
                    style={{ borderLeftColor: accent }}
                  >
                    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{g.name}</span>
                    <a
                      href={`steam://url/CommunityFilePage/${g.workshopId}`}
                      className="shrink-0 text-[0.7rem] px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded cursor-pointer no-underline transition-colors"
                    >
                      Subscribe
                    </a>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Your guides */}
      {filteredYours.length > 0 && (
        <div className="mt-4">
          <p
            className="m-0 mb-2 text-[0.7rem] text-zinc-500 uppercase tracking-wider font-semibold"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Your guides
          </p>
          <ul className="list-none m-0 p-0 space-y-1">
            {filteredYours.map((g) => {
              const { accent } = getMapColor(g.mapName)
              const syncState = g.source === 'local' ? cloudStatuses[g.path] : undefined
              return (
                <li key={g.path} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="flex-1 flex items-center gap-2.5 min-w-0 px-3 py-2.5 text-left rounded text-zinc-200 cursor-pointer text-[0.9rem] transition-colors border-l-[3px]"
                    style={{ borderLeftColor: accent }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    onClick={() => openGuideByPath(g.name, g.path, g.source)}
                  >
                    {g.source === 'local' && (
                      <StatusDot state={syncState} />
                    )}
                    <span
                      className="flex-1 text-left overflow-hidden text-ellipsis whitespace-nowrap font-semibold"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {g.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <MapChip mapName={g.mapName} />
                      {g.source === 'workshop' && (
                        <span className="text-[0.65rem] px-1.5 py-0.5 bg-indigo-900/60 text-indigo-300 rounded">Workshop</span>
                      )}
                    </div>
                  </button>
                  {g.source === 'local' && (
                    <button
                      type="button"
                      title="Load guide"
                      className="shrink-0 p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200 rounded text-zinc-400 cursor-pointer transition-colors"
                      onClick={(e) => loadGuideCommand(g.name, e)}
                    >
                      <FolderInput size={14} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
