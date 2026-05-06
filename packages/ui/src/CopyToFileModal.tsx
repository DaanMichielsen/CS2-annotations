import { useState, useEffect } from 'react'
import type { AnnotationNode, SelectedGroup } from '@cs2ann/shared'
import { classifyDuplicates } from '@cs2ann/shared'
import { useGuideAdapter } from './GuideAdapterContext'

interface GuideOption {
  name: string
  filePath: string
  nodeCount: number
}

interface Props {
  currentFilePath: string
  currentMapName: string
  selectedGroups: SelectedGroup[]
  onClose: () => void
  onSuccess: (message: string) => void
}

export default function CopyToFileModal({
  currentFilePath,
  currentMapName,
  selectedGroups,
  onClose,
  onSuccess,
}: Props) {
  const adapter = useGuideAdapter()
  const [guides, setGuides] = useState<GuideOption[]>([])
  const [loadingGuides, setLoadingGuides] = useState(true)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [createMode, setCreateMode] = useState(false)
  const [newName, setNewName] = useState('')
  const [targetNodes, setTargetNodes] = useState<AnnotationNode[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoadingGuides(true)
      const list = await adapter.listGuides()
      const candidates = list.filter(
        (g) =>
          g.source === 'local' &&
          (g.installed ?? true) &&
          g.id !== currentFilePath &&
          g.mapName === currentMapName
      )
      const opts: GuideOption[] = []
      for (const g of candidates) {
        const result = await adapter.loadGuide(g.id)
        if ('error' in result) continue
        opts.push({ name: g.name, filePath: g.id, nodeCount: result.nodes.length })
      }
      setGuides(opts)
      if (opts.length === 0) setCreateMode(true)
      setLoadingGuides(false)
    }
    void load()
  }, [currentFilePath, currentMapName])

  useEffect(() => {
    if (!selectedFilePath) { setTargetNodes(null); return }
    let cancelled = false
    const fp = selectedFilePath
    async function load() {
      const result = await adapter.loadGuide(fp)
      if (!cancelled && !('error' in result)) setTargetNodes(result.nodes)
    }
    void load()
    return () => { cancelled = true }
  }, [selectedFilePath])

  const { toAdd, skipped } =
    targetNodes !== null && !createMode
      ? classifyDuplicates(selectedGroups, targetNodes)
      : { toAdd: selectedGroups, skipped: [] }

  const nodesToWrite = toAdd.flatMap((g) => g.nodes)
  const allDuplicates = toAdd.length === 0 && selectedGroups.length > 0
  const canConfirm =
    !busy &&
    !allDuplicates &&
    ((createMode && newName.trim().length > 0) || (!createMode && selectedFilePath !== null))

  async function handleConfirm() {
    setBusy(true)
    setError('')
    if (createMode) {
      const result = await adapter.createGuide({
        filename: newName.trim(),
        mapName: currentMapName,
        nodes: nodesToWrite,
        nodesKey: 'Nodes',
        root: currentMapName ? { MapName: currentMapName } : {},
      })
      if (result.error) { setError(result.error); setBusy(false); return }
      onSuccess(
        `Copied ${toAdd.length} annotation${toAdd.length !== 1 ? 's' : ''} to new file "${result.loadName}". Open it from the Guides screen.`
      )
    } else if (selectedFilePath) {
      const result = await adapter.appendNodes({
        targetId: selectedFilePath,
        nodes: nodesToWrite,
      })
      if (result.error) { setError(result.error); setBusy(false); return }
      const targetName = guides.find((g) => g.filePath === selectedFilePath)?.name ?? selectedFilePath
      onSuccess(
        `Copied ${toAdd.length} annotation${toAdd.length !== 1 ? 's' : ''} to "${targetName}".`
      )
    }
    setBusy(false)
    onClose()
  }

  const btnPrimary = 'px-3 py-1.5 bg-zinc-600 hover:bg-zinc-500 border-none rounded text-zinc-100 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
  const btnSecondary = 'px-3 py-1.5 bg-zinc-800 border border-zinc-600 hover:bg-zinc-700 rounded text-zinc-300 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
  const inputCls = 'w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-500'

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-sm mx-4 flex flex-col overflow-hidden max-h-[90vh]">

        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60 shrink-0">
          <h2 className="text-base font-semibold text-zinc-100 m-0">
            Copy {selectedGroups.length} annotation{selectedGroups.length !== 1 ? 's' : ''} to…
          </h2>
          <button type="button" className="text-zinc-500 hover:text-zinc-200 text-lg leading-none" onClick={onClose}>✕</button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-4 overflow-y-auto">
          {loadingGuides ? (
            <p className="text-zinc-500 text-sm text-center py-2">Loading…</p>
          ) : (
            <>
              {guides.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[0.7rem] text-zinc-500 m-0 uppercase tracking-wider font-semibold">
                    Existing files for {currentMapName || '(no map name)'}
                  </p>
                  {guides.map((g) => (
                    <label
                      key={g.filePath}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedFilePath === g.filePath && !createMode
                          ? 'border-zinc-500 bg-zinc-700/60'
                          : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="targetFile"
                        className="accent-zinc-500 cursor-pointer"
                        checked={selectedFilePath === g.filePath && !createMode}
                        onChange={() => { setSelectedFilePath(g.filePath); setCreateMode(false); setNewName('') }}
                      />
                      <span className="flex-1 text-sm text-zinc-200 truncate">{g.name}</span>
                      <span className={`text-[0.65rem] shrink-0 ${g.nodeCount > 250 ? 'text-amber-400' : 'text-zinc-500'}`}>
                        {g.nodeCount > 250 ? `⚠ ${g.nodeCount}` : g.nodeCount} nodes
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {guides.length > 0 && <div className="border-t border-zinc-700/60" />}

              <div className="flex flex-col gap-2">
                <label
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    createMode
                      ? 'border-zinc-500 bg-zinc-700/60'
                      : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="targetFile"
                    className="accent-zinc-500 cursor-pointer"
                    checked={createMode}
                    onChange={() => { setCreateMode(true); setSelectedFilePath(null); setTargetNodes(null) }}
                  />
                  <span className="text-sm text-zinc-200">+ Create new file for this map</span>
                </label>
                {createMode && (
                  <div className="pl-2 flex flex-col gap-1.5">
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="File name (e.g. de_mirage_smokes)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      autoFocus
                    />
                    <p className="text-[0.65rem] text-zinc-600 m-0">
                      Map: <span className="text-zinc-500">{currentMapName || '(none)'}</span> · saved to annotations folder
                    </p>
                  </div>
                )}
              </div>

              {(selectedFilePath !== null || createMode) && (
                <div className="px-3 py-2 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-xs flex flex-col gap-0.5">
                  {allDuplicates ? (
                    <span className="text-amber-400">All selected annotations already exist in this file.</span>
                  ) : (
                    <>
                      <span className="text-zinc-300">{toAdd.length} annotation{toAdd.length !== 1 ? 's' : ''} will be copied</span>
                      {skipped.length > 0 && (
                        <span className="text-zinc-500">{skipped.length} already exist and will be skipped</span>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {error && <p className="text-red-400 text-xs m-0">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-zinc-700/60 flex items-center gap-2 justify-end shrink-0">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={btnPrimary}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {busy ? 'Copying…' : allDuplicates ? 'All duplicates' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
