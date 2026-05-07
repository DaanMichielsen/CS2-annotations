import { useState, useEffect } from 'react'
import type { AnnotationNode } from '@cs2ann/shared'
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
}

const btn =
  'px-4 py-2 bg-zinc-700 hover:bg-zinc-600 border-none rounded text-zinc-200 cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors'

export default function Guides({ onGuideChange }: GuidesProps = {}) {
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

  function copyLoadCommand(name: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    void navigator.clipboard.writeText(`annotation_load ${name}`)
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
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="m-0 text-2xl">Guides</h1>
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
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm w-52 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="text"
            value={newMapName}
            onChange={(e) => setNewMapName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void createAndOpenGuide() }}
            placeholder="Map name (e.g. de_cache)"
            title="CS2 map name — required for annotation_load to work"
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm w-48 focus:outline-none focus:border-zinc-500"
          />
          <button type="button" className={btn} onClick={createAndOpenGuide} disabled={creating || !newGuideName.trim()}>
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

      {(() => {
        const featured = guides.filter((g) => g.source === 'workshop' && g.workshopId && FEATURED_IDS.has(g.workshopId))
        const yours = guides.filter((g) => !(g.source === 'workshop' && g.workshopId && FEATURED_IDS.has(g.workshopId)))
        return (
          <>
            <div className="mb-1">
              <p className="m-0 mb-2 text-[0.7rem] text-zinc-500 uppercase tracking-wider font-semibold">Featured map guides</p>
              {featured.length === 0 && (
                <p className="text-zinc-600 text-sm">No featured guides configured. Set Workshop content folder in Settings.</p>
              )}
              <ul className="list-none m-0 p-0 space-y-1">
                {featured.map((g) => (
                  <li key={g.workshopId} className="flex items-center gap-1.5">
                    {g.installed ? (
                      <button
                        type="button"
                        className="flex-1 flex items-center justify-between gap-2 min-w-0 px-4 py-3 text-left bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded text-zinc-200 cursor-pointer text-[0.95rem] transition-colors"
                        onClick={() => openGuideByPath(g.name, g.path, g.source)}
                      >
                        <span className="flex-1 text-left overflow-hidden text-ellipsis whitespace-nowrap">{g.name}</span>
                        <span className="shrink-0 text-[0.7rem] px-1.5 py-0.5 bg-indigo-700 text-indigo-200 rounded">Workshop</span>
                      </button>
                    ) : (
                      <div className="flex-1 flex items-center justify-between gap-2 min-w-0 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded text-zinc-500 text-[0.95rem]">
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
                ))}
              </ul>
            </div>

            {yours.length > 0 && (
              <div className="mt-4">
                <p className="m-0 mb-2 text-[0.7rem] text-zinc-500 uppercase tracking-wider font-semibold">Your guides</p>
                <ul className="list-none m-0 p-0 space-y-1">
                  {yours.map((g) => (
                    <li key={g.path} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="flex-1 flex items-center justify-between gap-2 min-w-0 px-4 py-3 text-left bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded text-zinc-200 cursor-pointer text-[0.95rem] transition-colors"
                        onClick={() => openGuideByPath(g.name, g.path, g.source)}
                      >
                        <span className="flex-1 text-left overflow-hidden text-ellipsis whitespace-nowrap">{g.name}</span>
                        {g.source === 'workshop' && (
                          <span className="shrink-0 text-[0.7rem] px-1.5 py-0.5 bg-indigo-700 text-indigo-200 rounded">Workshop</span>
                        )}
                      </button>
                      {g.source === 'local' && (
                        <button
                          type="button"
                          title="Copy annotation_load command"
                          className="shrink-0 px-2.5 py-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200 rounded text-zinc-400 cursor-pointer text-xs transition-colors"
                          onClick={(e) => copyLoadCommand(g.name, e)}
                        >
                          Copy load
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )
      })()}
    </div>
  )
}
