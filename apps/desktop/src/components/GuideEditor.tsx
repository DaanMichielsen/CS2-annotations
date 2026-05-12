import { useState, useMemo, useEffect, useRef } from 'react'
import type { AnnotationNode, NodeType, GrenadeType, TextDescObject } from '@cs2ann/shared'
import { GRENADE_TYPES, defaultTextDesc, defaultPosition, defaultAngles, generateId } from '@cs2ann/shared'

// Nade-type icons bundled by Vite
const _nadeIconModules = import.meta.glob(
  '../../resources/nades/*.png',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>
const NADE_ICON_NAME: Partial<Record<GrenadeType, string>> = {
  smoke: 'smoke', flash: 'flash', he: 'hegrenade',
  molotov: 'molotov', decoy: 'decoy',
}
function getNadeIconUrl(gt: GrenadeType | undefined): string | null {
  if (!gt) return null
  const name = NADE_ICON_NAME[gt]
  return name ? (_nadeIconModules[`../../resources/nades/${name}.png`] ?? null) : null
}
import {
  inferColorCategory, inferThrowType,
  COLOR_CATEGORY_SHORT,
  THROW_TYPE_LABEL, THROW_TYPE_SHORT,
  type ColorCategory, type ThrowType,
} from '@cs2ann/shared'
import MapOverlay, { type MapMarker } from './MapOverlay'
import AnnotationCreateModal, { type CreateMeta } from './AnnotationCreateModal'
import CopyToFileModal from './CopyToFileModal'
import NodeMapView from './NodeMapView'
import { buildSetposCommand } from '@cs2ann/shared'
import { buildNodeGroups, nodeLabel, buildSelectedGroups, type NodeGroup, type SelectedGroup } from '@cs2ann/shared'

const MAX_NODES = 300

// ─── button variants ─────────────────────────────────────────────────────────
const btnPrimary =
  'px-3 py-1.5 bg-zinc-600 hover:bg-zinc-500 border-none rounded text-zinc-100 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
const btnSecondary =
  'px-3 py-1.5 bg-zinc-800 border border-zinc-600 hover:bg-zinc-700 rounded text-zinc-300 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
const btnDanger =
  'px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-800 rounded text-red-300 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

interface GuideEditorProps {
  guideName: string
  filePath?: string
  isWorkshop?: boolean
  canDelete?: boolean
  nodes: AnnotationNode[]
  root: Record<string, unknown>
  nodesKey: string
  onSave: (nodes: AnnotationNode[], root: Record<string, unknown>, nodesKey: string) => Promise<{ error?: string }>
  onSaveAsLocalGuide?: (
    localName: string,
    root: Record<string, unknown>,
    nodes: AnnotationNode[]
  ) => Promise<{ error?: string; path?: string; loadName?: string }>
  onBack: () => void
  onDeleted?: () => void
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function createEmptyNode(type: NodeType, overrides?: Partial<AnnotationNode>): AnnotationNode {
  return {
    Type: type,
    SubType: 'main',
    Id: generateId(),
    Position: defaultPosition(),
    Angles: defaultAngles(),
    Title: defaultTextDesc(),
    Desc: defaultTextDesc(),
    ...overrides,
  }
}

function createGrenadeSet(grenadeType: GrenadeType): AnnotationNode[] {
  const mainId = generateId()
  return [
    createEmptyNode('grenade', { Id: mainId, SubType: 'main', GrenadeType: grenadeType }),
    createEmptyNode('grenade', { SubType: 'aim_target', MasterNodeId: mainId, Id: generateId() }),
    createEmptyNode('grenade', { SubType: 'destination', MasterNodeId: mainId, Id: generateId() }),
  ]
}

// ─── component ────────────────────────────────────────────────────────────────
export default function GuideEditor({
  guideName,
  filePath = '',
  isWorkshop = false,
  canDelete = false,
  nodes: initialNodes,
  root: initialRoot,
  nodesKey: initialNodesKey,
  onSave,
  onSaveAsLocalGuide,
  onBack,
  onDeleted,
}: GuideEditorProps) {
  const [nodes, setNodes] = useState<AnnotationNode[]>(initialNodes)
  const [root, setRoot] = useState<Record<string, unknown>>(initialRoot)
  const [nodesKey, setNodesKey] = useState(initialNodesKey)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessageText] = useState('')
  const [isMessageError, setIsMessageError] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [localGuideName, setLocalGuideName] = useState('')
  const [saveAsLocalStatus, setSaveAsLocalStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle')
  const [runCommandStatus, setRunCommandStatus] = useState<'idle' | 'running'>('idle')
  const [lastCfgPath, setLastCfgPath] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<number>>(new Set())
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)

  // ── pending create metadata (applied when CS2 writes the file) ────────────
  interface PendingNodeMeta extends CreateMeta { existingIds: Set<string> }
  const pendingMetaRef  = useRef<PendingNodeMeta | null>(null)
  const [pendingMeta, setPendingMetaState] = useState<PendingNodeMeta | null>(null)
  const pendingMetaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function storePendingMeta(m: PendingNodeMeta | null) {
    pendingMetaRef.current = m
    setPendingMetaState(m)
  }
  function clearPendingMeta() {
    if (pendingMetaTimer.current) { clearTimeout(pendingMetaTimer.current); pendingMetaTimer.current = null }
    storePendingMeta(null)
  }

  // ── filter / sort state ───────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState<NodeType | 'all'>('all')
  const [filterColorCat, setFilterColorCat] = useState<ColorCategory | 'all'>('all')
  const [filterThrowType, setFilterThrowType] = useState<ThrowType | 'all'>('all')
  const [filterGrenadeType, setFilterGrenadeType] = useState<GrenadeType | 'all'>('all')
  const [sortBy, setSortBy] = useState<'index' | 'name' | 'newest'>('index')
  const [groupByPos, setGroupByPos] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')

  const selectedNode = selectedIndex !== null ? nodes[selectedIndex] : null
  const groups = useMemo(() => buildNodeGroups(nodes), [nodes])
  const selectedGroups = useMemo<SelectedGroup[]>(
    () => buildSelectedGroups(selectedKeys, nodes, groups),
    [selectedKeys, nodes, groups]
  )
  const nodeCountWarning = nodes.length >= MAX_NODES - 50

  const visibleItems = useMemo(() => {
    const q = searchText.toLowerCase().trim()

    const matchNode = (n: AnnotationNode): boolean => {
      if (q) {
        const hay = [n.Title?.Text ?? '', n.Desc?.Text ?? '', n.Type, n.GrenadeType ?? ''].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filterColorCat !== 'all' && inferColorCategory(n.Color) !== filterColorCat) return false
      return true
    }

    const byLabel = (a: number, b: number) => nodeLabel(nodes[a]).localeCompare(nodeLabel(nodes[b]))
    const byGroupLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)
    const byGroupIndexDesc = (a: NodeGroup, b: NodeGroup) => b.indices[0] - a.indices[0]
    const byIndexDesc = (a: number, b: number) => b - a

    const grenadeGroups = groups.grenadeGroups
      .filter(g => {
        if (filterType !== 'all' && filterType !== 'grenade') return false
        const main = nodes[g.indices[0]]
        if (!matchNode(main)) return false
        if (filterThrowType !== 'all' && inferThrowType(main) !== filterThrowType) return false
        if (filterGrenadeType !== 'all' && main.GrenadeType !== filterGrenadeType) return false
        return true
      })
      .sort(sortBy === 'name' ? byGroupLabel : sortBy === 'newest' ? byGroupIndexDesc : () => 0)

    const lineGroups = groups.lineGroups
      .filter(g => {
        if (filterType !== 'all' && filterType !== 'line') return false
        return matchNode(nodes[g.indices[0]])
      })
      .sort(sortBy === 'name' ? byGroupLabel : () => 0)

    const filterIdx = (arr: number[], t: NodeType) =>
      arr
        .filter(i => (filterType === 'all' || filterType === t) && matchNode(nodes[i]))
        .sort(sortBy === 'name' ? byLabel : sortBy === 'newest' ? byIndexDesc : () => 0)

    return {
      grenadeGroups,
      lineGroups,
      positionIndices: filterIdx(groups.positionIndices, 'position'),
      textIndices:     filterIdx(groups.textIndices, 'text'),
      spotIndices:     filterIdx(groups.spotIndices, 'spot'),
    }
  }, [nodes, groups, searchText, filterType, filterColorCat, filterThrowType, filterGrenadeType, sortBy])

  // ── position clusters (groupByPos view) ──────────────────────────────────
  const positionClusters = useMemo(() => {
    if (!groupByPos) return null
    const TOLERANCE = 80
    const result: Array<{ label: string; pos: [number, number]; groups: NodeGroup[] }> = []
    for (const g of visibleItems.grenadeGroups) {
      const pos = nodes[g.indices[0]].Position
      if (!pos) {
        const slot = result.find((c) => c.label === '(no position)')
        if (slot) slot.groups.push(g)
        else result.push({ label: '(no position)', pos: [0, 0], groups: [g] })
        continue
      }
      const [x, y] = pos
      const slot = result.find((c) => c.label !== '(no position)' && Math.hypot(c.pos[0] - x, c.pos[1] - y) < TOLERANCE)
      if (slot) slot.groups.push(g)
      else result.push({ label: `${Math.round(x)}, ${Math.round(y)}`, pos: [x, y], groups: [g] })
    }
    return result
  }, [groupByPos, visibleItems.grenadeGroups, nodes])

  // ── position conflicts ────────────────────────────────────────────────────
  const positionConflicts = useMemo(() => {
    const THRESHOLD = 20
    const mains = groups.grenadeGroups.map((g) => ({ idx: g.indices[0], pos: nodes[g.indices[0]].Position }))
    const conflicted = new Set<number>()
    for (let i = 0; i < mains.length; i++) {
      if (!mains[i].pos) continue
      for (let j = i + 1; j < mains.length; j++) {
        if (!mains[j].pos) continue
        const [ax, ay, az] = mains[i].pos!
        const [bx, by, bz] = mains[j].pos!
        if (Math.hypot(ax - bx, ay - by, az - bz) < THRESHOLD) {
          conflicted.add(mains[i].idx)
          conflicted.add(mains[j].idx)
        }
      }
    }
    return conflicted
  }, [groups.grenadeGroups, nodes])

  // ── map overlay ───────────────────────────────────────────────────────────
  const mapName = typeof root.MapName === 'string' ? root.MapName : ''

  const mapMarkers = useMemo((): MapMarker[] => {
    if (selectedIndex === null) return []
    const node = nodes[selectedIndex]

    if (node.Type === 'grenade') {
      // Find the grenade group and build stand/aim/land markers
      const group = groups.grenadeGroups.find((g) => g.indices.includes(selectedIndex))
      if (group) {
        return group.indices.flatMap((i): MapMarker[] => {
          const n = nodes[i]
          if (!n.Position) return []
          if (n.SubType === 'main' || !n.SubType)
            return [{ position: n.Position, yaw: n.Angles?.[1], type: 'stand' }]
          if (n.SubType === 'destination')
            return [{ position: n.Position, type: 'land' }]
          if (n.SubType === 'aim_target')
            return [{ position: n.Position, yaw: n.Angles?.[1], type: 'aim' }]
          return []
        })
      }
    }

    // For line groups, show start + end
    if (node.Type === 'line') {
      const group = groups.lineGroups.find((g) => g.indices.includes(selectedIndex))
      if (group) {
        return group.indices.flatMap((i): MapMarker[] => {
          const n = nodes[i]
          if (!n.Position) return []
          return [{ position: n.Position, yaw: n.Angles?.[1], type: i === group.indices[0] ? 'stand' : 'land' }]
        })
      }
    }

    // Any other node type
    if (node.Position) return [{ position: node.Position, yaw: node.Angles?.[1], type: 'point' }]
    return []
  }, [selectedIndex, nodes, groups])

  // ── file watcher (auto-reload on external change) ─────────────────────────
  useEffect(() => {
    if (!filePath) return
    window.electronAPI.watchGuideFile(filePath)
    const cleanup = window.electronAPI.onGuideFileChanged(async (changedPath) => {
      if (changedPath !== filePath) return
      const result = await window.electronAPI.loadGuide(filePath)
      if ('error' in result) { setMsg(`Reload failed: ${result.error}`, true); return }

      const meta = pendingMetaRef.current
      if (meta) {
        // Detect which nodes are new (by Id)
        const newIndices: number[] = []
        const patched = result.nodes.map((n, i) => {
          const isNew = n.Id ? !meta.existingIds.has(n.Id) : false
          if (!isNew) return n
          newIndices.push(i)
          const u = { ...n }
          // Color on the main/stand node
          if (meta.color && (!n.SubType || n.SubType === 'main')) u.Color = meta.color
          // Standing position text on the main grenade node
          if (meta.standingPosLabel && n.Type === 'grenade' && (!n.SubType || n.SubType === 'main')) {
            u.Desc = { ...u.Desc, Text: meta.standingPosLabel }
          }
          // Aim instruction on the aim_target node
          if (meta.aimText && n.SubType === 'aim_target') {
            u.Desc = { ...u.Desc, Text: meta.aimText }
          }
          // Line label on the master node (the one with no MasterNodeId)
          if (meta.lineLabel && !n.MasterNodeId) {
            u.Title = { ...u.Title, Text: meta.lineLabel }
          }
          return u
        })

        if (newIndices.length > 0) {
          setNodes(patched)
          setRoot(result.root as Record<string, unknown>)
          setNodesKey(result.nodesKey)
          // Select the new main node so the editor opens immediately
          const mainIdx = newIndices.find((i) => !patched[i].SubType || patched[i].SubType === 'main')
          setSelectedIndex(mainIdx ?? newIndices[0])
          // Clear pending state
          if (pendingMetaTimer.current) { clearTimeout(pendingMetaTimer.current); pendingMetaTimer.current = null }
          pendingMetaRef.current = null
          setPendingMetaState(null)
          // Auto-save with patched data
          const saveResult = await onSave(patched, result.root as Record<string, unknown>, result.nodesKey)
          if (saveResult.error) setMsg(`New annotation created — save failed: ${saveResult.error}`, true)
          else setMsg('New annotation created — metadata applied and saved.')
          return
        }
      }

      // Normal reload (no pending meta or no new nodes found)
      setNodes(result.nodes)
      setRoot(result.root as Record<string, unknown>)
      setNodesKey(result.nodesKey)
      setSelectedIndex(null)
      setMsg('Reloaded — file changed externally.')
    })
    return () => { window.electronAPI.unwatchGuideFile(); cleanup() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath])

  const setMsg = (msg: string, isError = false) => {
    setMessageText(msg)
    setIsMessageError(isError)
  }

  function handleSelectAllVisible() {
    const keys = new Set<number>()
    visibleItems.grenadeGroups.forEach((g) => keys.add(g.indices[0]))
    visibleItems.lineGroups.forEach((g) => keys.add(g.indices[0]))
    visibleItems.positionIndices.forEach((i) => keys.add(i))
    visibleItems.textIndices.forEach((i) => keys.add(i))
    visibleItems.spotIndices.forEach((i) => keys.add(i))
    setSelectedKeys(keys)
  }

  function handleDeleteSelected() {
    const indicesToRemove = new Set<number>()
    for (const key of selectedKeys) {
      const grenadeGroup = groups.grenadeGroups.find((g) => g.indices[0] === key)
      if (grenadeGroup) { grenadeGroup.indices.forEach((i) => indicesToRemove.add(i)); continue }
      const lineGroup = groups.lineGroups.find((g) => g.indices[0] === key)
      if (lineGroup) { lineGroup.indices.forEach((i) => indicesToRemove.add(i)); continue }
      indicesToRemove.add(key)
    }
    setNodes((prev) => prev.filter((_, i) => !indicesToRemove.has(i)))
    if (selectedIndex !== null && indicesToRemove.has(selectedIndex)) setSelectedIndex(null)
    setSelectedKeys(new Set())
    setDeleteConfirmPending(false)
  }

  // ── actions ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveStatus('saving')
    setMsg('')
    const result = await onSave(nodes, root, nodesKey)
    if (result.error) { setSaveStatus('error'); setMsg(result.error, true) }
    else { setSaveStatus('saved'); setMsg('Saved.') }
  }

  const handleRunInCS2 = async (command: string) => {
    setRunCommandStatus('running')
    setMsg('')
    try {
      // Primary path: write to annotation_manager.cfg → user presses F8 in CS2
      const writeCfg = window.electronAPI?.writeCS2Cfg
      if (typeof writeCfg === 'function') {
        const cfgResult = await writeCfg(command)
        if (!cfgResult?.error) {
          setRunCommandStatus('idle')
          if (cfgResult?.cfgPath) setLastCfgPath(cfgResult.cfgPath)
          setMsg('Written to annotation_manager.cfg and copied to clipboard. Press F8 or paste in CS2 console.')
          return
        }
        setMsg(cfgResult.error, true)
      } else {
        // Fallback: keysender direct keystroke
        const send = window.electronAPI?.sendCS2ConsoleCommand
        if (typeof send === 'function') {
          const result = await send(command)
          if (!result.error) { setRunCommandStatus('idle'); setMsg(`Sent to CS2: ${command}`); return }
          setMsg(result.error, true)
        } else {
          setMsg('writeCS2Cfg not available — restart the app.', true)
        }
      }
    } catch (e) {
      setMsg(String(e), true)
    }
    setRunCommandStatus('idle')
  }

  /**
   * Step 1 — send annotation_create command.
   * CS2 holds the node in memory; the file is NOT written yet.
   * Pending meta is NOT stored here — we wait for the user to confirm.
   */
  const handleSendCreate = async (command: string) => {
    await handleRunInCS2(command)
  }

  /**
   * Step 2a — user confirmed the lineup.
   * Snapshot existing IDs, store meta, then write annotation_save to cfg.
   * The file-watcher handler will pick it up, patch the new nodes, and save.
   */
  const handleSaveAnnotation = async (meta: CreateMeta) => {
    const existingIds = new Set(nodes.map((n) => n.Id).filter(Boolean) as string[])
    if (pendingMetaTimer.current) clearTimeout(pendingMetaTimer.current)
    storePendingMeta({ ...meta, existingIds })
    pendingMetaTimer.current = setTimeout(() => {
      storePendingMeta(null)
      setMsg('Save timed out — no file change detected. Did you press F8?', true)
    }, 120_000)
    await handleRunInCS2(`annotation_save ${guideName}`)
  }

  /**
   * Step 2b — user aborted.
   * annotation_reload is blocked on workshop/community maps; use annotation_load instead
   * which reloads from disk and discards the in-memory node.
   */
  const handleAbortAnnotation = async () => {
    clearPendingMeta()
    await handleRunInCS2(`annotation_load ${guideName}`)
    setMsg('Annotation creation aborted.')
  }

  function handleCopySuccess(message: string) {
    setShowCopyModal(false)
    setSelectedKeys(new Set())
    setMsg(message)
  }

  const handleSaveAsLocalGuide = async () => {
    const name = localGuideName.trim()
    if (!name || !onSaveAsLocalGuide) return
    setSaveAsLocalStatus('saving')
    const result = await onSaveAsLocalGuide(name, root, nodes)
    if (result.error) { setSaveAsLocalStatus('error'); setMsg(result.error, true) }
    else { setSaveAsLocalStatus('done'); setMsg('Saved as local guide.'); setLocalGuideName('') }
  }

  const handleAddNode = (type: NodeType, grenadeType?: GrenadeType) => {
    setAddMenuOpen(false)
    if (type === 'grenade' && grenadeType) {
      setNodes((prev) => [...prev, ...createGrenadeSet(grenadeType)])
    } else {
      const node = createEmptyNode(type)
      setNodes((prev) => { setSelectedIndex(prev.length); return [...prev, node] })
    }
  }

  const handleUpdateNode = (index: number, updates: Partial<AnnotationNode>) => {
    setNodes((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      // Cascade Color from a main node to all its children
      if ('Color' in updates) {
        const node = next[index]
        if (node.Id && (node.SubType === 'main' || !node.SubType)) {
          for (let i = 0; i < next.length; i++) {
            if (next[i].MasterNodeId === node.Id) {
              next[i] = { ...next[i], Color: updates.Color }
            }
          }
        }
      }
      return next
    })
  }

  const handleDeleteGuideFile = async () => {
    if (!filePath || !canDelete) return
    if (!window.confirm('Delete this annotation file from disk? This cannot be undone.')) return
    setDeleteStatus('deleting')
    const result = await window.electronAPI.deleteGuide(filePath)
    if (result.error) { setDeleteStatus('error'); setMsg(result.error, true) }
    else { onDeleted?.(); onBack() }
  }

  const handleSetGroupEnabled = (indices: number[], enabled: boolean) => {
    setNodes((prev) => {
      const next = [...prev]
      // Toggle both Enabled AND VisiblePfx — Enabled hides the label, VisiblePfx hides the 3D marker
      indices.forEach((i) => { next[i] = { ...next[i], Enabled: enabled, VisiblePfx: enabled } })
      return next
    })
  }

  const handleDeleteNode = (index: number) => {
    const node = nodes[index]
    if (node.Type === 'grenade' && (node.SubType === 'main' || !node.SubType) && node.Id) {
      const mainId = node.Id
      const toRemove = new Set(
        nodes.map((n, j) => (n.Id === mainId || n.MasterNodeId === mainId ? j : -1)).filter((j) => j >= 0)
      )
      setNodes((prev) => prev.filter((_, i) => !toRemove.has(i)))
    } else {
      setNodes((prev) => prev.filter((_, i) => i !== index))
    }
    setSelectedIndex(null)
  }

  // ── node list renderers ───────────────────────────────────────────────────
  const renderNodeRow = (i: number) => {
    const n = nodes[i]
    const label = nodeLabel(n)
    const isEnabled = n.Enabled !== false
    const isSelected = selectedKeys.has(i)
    return (
      <div key={i} className="flex items-center gap-1">
        <input
          type="checkbox"
          className="shrink-0 w-3.5 h-3.5 cursor-pointer accent-zinc-500"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            setSelectedKeys((prev) => {
              const next = new Set(prev)
              if (e.target.checked) next.add(i)
              else next.delete(i)
              return next
            })
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          title={label}
          onClick={() => setSelectedIndex(i)}
          className={`flex-1 min-w-0 px-2 py-1.5 text-left text-sm rounded border-none cursor-pointer transition-colors flex items-center gap-1.5
            ${selectedIndex === i ? 'bg-zinc-700 text-zinc-100 ring-1 ring-zinc-500' : 'bg-transparent text-zinc-300 hover:bg-zinc-700/60'}
            ${!isEnabled ? 'opacity-50 italic' : ''}`}
        >
          {n.Color && <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: rgbToHex(n.Color) }} />}
          <span className="truncate">{label}</span>
        </button>
        <button
          type="button"
          title={isEnabled ? 'Hide in CS2' : 'Show in CS2'}
          className="shrink-0 p-1 text-zinc-500 hover:text-zinc-300 border-none bg-transparent cursor-pointer transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            handleUpdateNode(i, { Enabled: !isEnabled, VisiblePfx: !isEnabled })
          }}
        >
          {isEnabled ? <EyeOpenIcon /> : <EyeClosedIcon />}
        </button>
      </div>
    )
  }

  const renderGroupRow = (group: NodeGroup, typeLabel: string) => {
    const allEnabled = group.indices.every((i) => nodes[i].Enabled !== false)
    const active = selectedIndex !== null && group.indices.includes(selectedIndex)
    const isSelected = selectedKeys.has(group.indices[0])
    const mainNode = nodes[group.indices[0]]
    const isGrenade = typeLabel === 'Grenade'
    const throwShort = isGrenade ? THROW_TYPE_SHORT[inferThrowType(mainNode)] : null
    const colorCat = mainNode?.Color ? inferColorCategory(mainNode.Color) : 'unknown'
    const hasConflict = isGrenade && positionConflicts.has(group.indices[0])
    const iconUrl = isGrenade ? getNadeIconUrl(mainNode.GrenadeType) : null
    const tooltipText = [
      group.label,
      mainNode.GrenadeType,
      throwShort,
      hasConflict ? '⚠ Same throw position as another nade' : null,
    ].filter(Boolean).join(' · ')
    return (
      <div key={group.indices.join('-')} className="flex items-center gap-1">
        <input
          type="checkbox"
          className="shrink-0 w-3.5 h-3.5 cursor-pointer accent-zinc-500"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            setSelectedKeys((prev) => {
              const next = new Set(prev)
              if (e.target.checked) next.add(group.indices[0])
              else next.delete(group.indices[0])
              return next
            })
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          title={tooltipText}
          onClick={() => setSelectedIndex(group.indices[0])}
          className={`flex-1 min-w-0 px-2 py-1.5 text-left text-sm rounded border-none cursor-pointer transition-colors
            ${active ? 'bg-zinc-700 text-zinc-100 ring-1 ring-zinc-500' : 'bg-transparent text-zinc-300 hover:bg-zinc-700/60'}
            ${!allEnabled ? 'opacity-50 italic' : ''}`}
        >
          <div className="flex items-center gap-1.5 leading-none mb-0.5">
            {iconUrl
              ? <img src={iconUrl} className="w-3.5 h-3.5 shrink-0 object-contain opacity-80" alt={mainNode.GrenadeType ?? ''} />
              : <span className="text-[0.65rem] font-semibold text-zinc-500 uppercase tracking-wide">{typeLabel}</span>
            }
            {mainNode?.Color && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rgbToHex(mainNode.Color) }} />
            )}
            {throwShort && colorCat !== 'unknown' && (
              <span className="text-[0.6rem] text-zinc-600">{COLOR_CATEGORY_SHORT[colorCat]}</span>
            )}
            {throwShort && (
              <span className="text-[0.6rem] px-1 py-px bg-zinc-700/60 rounded text-zinc-500">{throwShort}</span>
            )}
            {hasConflict && (
              <span className="text-[0.65rem] text-amber-400" title="Same throw position as another nade — labels will overlap in CS2">⚠</span>
            )}
          </div>
          <span className="block truncate">{group.label}</span>
        </button>
        <button
          type="button"
          title={allEnabled ? 'Hide in CS2' : 'Show in CS2'}
          className="shrink-0 p-1 text-zinc-500 hover:text-zinc-300 border-none bg-transparent cursor-pointer transition-colors"
          onClick={(e) => { e.stopPropagation(); handleSetGroupEnabled(group.indices, !allEnabled) }}
        >
          {allEnabled ? <EyeOpenIcon /> : <EyeClosedIcon />}
        </button>
      </div>
    )
  }

  const renderSection = (title: string, items: React.ReactNode[]) => {
    if (items.length === 0) return null
    return (
      <div className="mb-2">
        <div className="text-[0.65rem] font-semibold text-zinc-500 uppercase tracking-widest px-2 py-0.5 mb-0.5">
          {title}
        </div>
        <div className="flex flex-col gap-0.5">{items}</div>
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    // Root: fills the space given by Guides.tsx wrapper
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* ── Top bar: back + title + primary actions ── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 border-b border-zinc-700/60 shrink-0">
        <button type="button" className={btnSecondary} onClick={onBack}>
          ← Back
        </button>
        <h2 className="flex-1 min-w-0 m-0 text-lg font-semibold truncate text-zinc-100">
          {guideName}
        </h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" className={btnPrimary} onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {canDelete && filePath && (
            <button type="button" className={btnDanger} onClick={handleDeleteGuideFile} disabled={deleteStatus === 'deleting'}>
              {deleteStatus === 'deleting' ? 'Deleting…' : 'Delete file'}
            </button>
          )}
        </div>
      </div>

      {/* ── Action toolbar: CS2 commands + workshop save-as ── */}
      <div className="flex items-center gap-1.5 flex-wrap px-4 py-1.5 bg-zinc-800/40 border-b border-zinc-700/60 shrink-0">
        {isWorkshop && onSaveAsLocalGuide && (
          <>
            <input
              type="text"
              className="py-1 px-2 w-36 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
              placeholder="local name…"
              value={localGuideName}
              onChange={(e) => setLocalGuideName(e.target.value)}
            />
            <button
              type="button"
              className={btnSecondary}
              onClick={handleSaveAsLocalGuide}
              disabled={saveAsLocalStatus === 'saving' || !localGuideName.trim()}
            >
              {saveAsLocalStatus === 'saving' ? 'Saving…' : 'Save as local'}
            </button>
            <div className="w-px h-4 bg-zinc-700 mx-1" />
          </>
        )}
        <button
          type="button"
          className={btnSecondary}
          onClick={async () => {
            const res = await window.electronAPI?.launchCS2?.()
            setMsg(res?.error ?? 'Launching CS2 via Steam…', !!res?.error)
          }}
        >
          Launch CS2
        </button>
        {!isWorkshop && (
          <button
            type="button"
            className={btnSecondary}
            disabled={runCommandStatus === 'running'}
            onClick={() => handleRunInCS2(`annotation_load ${guideName}`)}
          >
            Load in CS2
          </button>
        )}
        <button
          type="button"
          className={btnSecondary}
          disabled={runCommandStatus === 'running'}
          onClick={() => handleRunInCS2('annotation_clear')}
        >
          Clear in CS2
        </button>
        <div className="w-px h-4 bg-zinc-700 mx-0.5" />
        <button
          type="button"
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 rounded text-zinc-100 cursor-pointer text-sm transition-colors"
          onClick={() => setShowCreateModal(true)}
        >
          + Create annotation
        </button>
      </div>

      {/* ── Pending create indicator (waiting for annotation_save to flush to disk) ── */}
      {pendingMeta && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-950/60 border-b border-amber-700/50 shrink-0">
          <span className="text-amber-400 text-sm animate-pulse">⏳</span>
          <span className="text-amber-300 text-xs flex-1">
            Waiting for CS2 to write the file… Press <strong>F8</strong> in CS2 to complete the save.
            Metadata will be applied automatically.
          </span>
          <button
            type="button"
            title="Abort — sends annotation_load to CS2 to discard the unsaved node"
            className="px-2 py-0.5 text-xs rounded bg-red-900/50 border border-red-700/50 text-red-300 hover:bg-red-800/60 cursor-pointer"
            onClick={handleAbortAnnotation}
          >
            Abort
          </button>
        </div>
      )}

      {/* ── Status / hint strip ── */}
      {(message || nodeCountWarning || lastCfgPath) && (
        <div className="flex flex-col gap-0.5 px-4 py-1.5 bg-zinc-900/60 border-b border-zinc-700/40 shrink-0 text-xs">
          {message && (
            <span className={isMessageError ? 'text-red-400' : 'text-zinc-400'}>{message}</span>
          )}
          {lastCfgPath && !isMessageError && (
            <span className="text-zinc-600 flex items-center gap-1.5">
              <span className="font-mono truncate">{lastCfgPath}</span>
              <button
                type="button"
                className="shrink-0 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors"
                onClick={() => window.electronAPI?.showItemInFolder?.(lastCfgPath)}
              >
                Open folder
              </button>
            </span>
          )}
          {nodeCountWarning && (
            <span className="text-amber-400">Nodes: {nodes.length} / {MAX_NODES} — approaching limit.</span>
          )}
        </div>
      )}

      {/* ── Hint (persistent, small) ── */}
      <div className="px-4 py-1.5 border-b border-zinc-700/30 shrink-0 flex flex-col gap-0.5">
        {isWorkshop ? (
          <p className="m-0 text-[0.68rem] text-violet-400/80">
            Workshop guide — save as local, then{' '}
            <code className="bg-zinc-800 px-1 rounded">annotation_load &lt;name&gt;</code> in CS2.
          </p>
        ) : (
          <p className="m-0 text-[0.68rem] text-zinc-600">
            After saving, run <code className="bg-zinc-800 px-1 rounded">annotation_load {guideName}</code> in the CS2 console.
          </p>
        )}
        {filePath && (
          <span className="flex items-center gap-1.5 text-[0.65rem] text-zinc-700">
            <span className="font-mono truncate flex-1">{filePath}</span>
            <button
              type="button"
              className="shrink-0 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
              onClick={() => window.electronAPI?.showItemInFolder?.(filePath)}
            >
              Open folder
            </button>
          </span>
        )}
      </div>

      {/* ── Main body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Node list / map panel — expands when in map view */}
        <aside className={`${viewMode === 'map' ? 'flex-1 min-w-0' : 'w-80 shrink-0'} flex flex-col border-r border-zinc-700/60`}>

          {/* ── Panel header: title + view toggle + add button ── */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-700/60 shrink-0 bg-zinc-800/40">
            <span className="text-xs text-zinc-400 font-medium shrink-0">
              Nodes{' '}
              <span className="text-zinc-600">
                ({[
                  visibleItems.grenadeGroups.length,
                  visibleItems.lineGroups.length,
                  visibleItems.positionIndices.length,
                  visibleItems.textIndices.length,
                  visibleItems.spotIndices.length,
                ].reduce((a, b) => a + b, 0)} / {nodes.length})
              </span>
            </span>
            {/* View mode toggle */}
            <div className="flex rounded border border-zinc-700 overflow-hidden text-xs">
              {(['list', 'map'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  title={m === 'list' ? 'List view' : 'Map view'}
                  className={`px-2 py-0.5 cursor-pointer border-none transition-colors ${
                    viewMode === m
                      ? 'bg-zinc-600 text-zinc-100'
                      : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
                  }`}
                  onClick={() => setViewMode(m)}
                >
                  {m === 'list' ? '☰' : '🗺'}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="relative">
              <button
                type="button"
                className="px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 border-none rounded text-zinc-300 cursor-pointer text-xs transition-colors"
                onClick={() => setAddMenuOpen((o) => !o)}
              >
                + Add
              </button>
              {addMenuOpen && (
                <div className="absolute top-full right-0 mt-1 bg-zinc-800 border border-zinc-600 rounded-lg shadow-2xl py-1 flex flex-col z-200 min-w-[150px] max-h-72 overflow-y-auto">
                  {(['position', 'text', 'line', 'spot'] as NodeType[]).map((t) => (
                    <button key={t} type="button"
                      className="px-3 py-1.5 text-left bg-transparent hover:bg-zinc-700 border-none text-zinc-200 cursor-pointer text-sm capitalize"
                      onClick={() => handleAddNode(t)}>{t}</button>
                  ))}
                  <div className="my-1 border-t border-zinc-700" />
                  {GRENADE_TYPES.map((gt) => (
                    <button key={gt} type="button"
                      className="px-3 py-1.5 text-left bg-transparent hover:bg-zinc-700 border-none text-zinc-200 cursor-pointer text-sm"
                      onClick={() => handleAddNode('grenade', gt)}>Grenade ({gt})</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Filter controls ── */}
          <div className="shrink-0 flex flex-col gap-1.5 px-2 py-2 border-b border-zinc-700/60 bg-zinc-900/40">
            {/* Search */}
            <input
              type="text"
              placeholder="Search nodes…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full py-1 px-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-xs focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
            />

            {/* Type filter + sort */}
            <FilterRow label="Type">
              {(['all', 'grenade', 'line', 'position', 'text', 'spot'] as const).map((t) => (
                <FilterPill key={t} active={filterType === t} onClick={() => setFilterType(t)}>
                  {t === 'all' ? 'All' : t === 'grenade' ? 'Nade' : t === 'position' ? 'Pos' : t[0].toUpperCase() + t.slice(1)}
                </FilterPill>
              ))}
              <span className="flex-1" />
              <FilterPill active={sortBy === 'index'}  onClick={() => setSortBy('index')}  dim>↕ Idx</FilterPill>
              <FilterPill active={sortBy === 'name'}   onClick={() => setSortBy('name')}   dim>↕ Name</FilterPill>
              <FilterPill active={sortBy === 'newest'} onClick={() => setSortBy('newest')} dim title="Show newest (last added) first">New↓</FilterPill>
            </FilterRow>

            {/* Grenade sub-type filter — only when grenades shown */}
            {(filterType === 'all' || filterType === 'grenade') && (
              <FilterRow label="Nade">
                <FilterPill active={filterGrenadeType === 'all'} onClick={() => setFilterGrenadeType('all')}>All</FilterPill>
                {GRENADE_TYPES.map((gt) => {
                  const icon = getNadeIconUrl(gt)
                  return (
                    <FilterPill key={gt} active={filterGrenadeType === gt} onClick={() => setFilterGrenadeType(gt)}
                      title={gt}>
                      {icon
                        ? <img src={icon} className="w-3.5 h-3.5 object-contain" alt={gt} />
                        : gt.slice(0, 3)
                      }
                    </FilterPill>
                  )
                })}
                <span className="flex-1" />
                <FilterPill
                  active={groupByPos}
                  onClick={() => setGroupByPos((p) => !p)}
                  dim
                  title="Group grenades by throw position"
                >
                  Pos↗
                </FilterPill>
              </FilterRow>
            )}

            {/* Color category filter */}
            <FilterRow label="Color">
              <FilterPill active={filterColorCat === 'all'} onClick={() => setFilterColorCat('all')}>All</FilterPill>
              {(['instant', 't_side', 'ct_side', 'unknown'] as ColorCategory[]).map((c) => (
                <FilterPill key={c} active={filterColorCat === c} onClick={() => setFilterColorCat(c)}>
                  {COLOR_CATEGORY_SHORT[c]}
                </FilterPill>
              ))}
            </FilterRow>

            {/* Throw type filter — only useful when grenades are shown */}
            {(filterType === 'all' || filterType === 'grenade') && (
              <FilterRow label="Throw">
                <FilterPill active={filterThrowType === 'all'} onClick={() => setFilterThrowType('all')}>All</FilterPill>
                {(['stand', 'run', 'walk', 'stand_jump', 'run_jump', 'w_jump', 'crouch_jump', 'm2', 'm2_jump', 'm1m2_jump'] as ThrowType[]).map((t) => (
                  <FilterPill key={t} active={filterThrowType === t} onClick={() => setFilterThrowType(t)}
                    title={THROW_TYPE_LABEL[t]}>
                    {THROW_TYPE_SHORT[t]}
                  </FilterPill>
                ))}
              </FilterRow>
            )}
          </div>

          {/* ── Bulk action bar (fixed height slot) ── */}
          <div className="shrink-0 h-8 flex items-center gap-2 px-2 border-b border-zinc-700/60 bg-zinc-800/40 overflow-hidden text-xs">
            {selectedKeys.size > 0 && (
              deleteConfirmPending ? (
                <>
                  <span className="text-red-400 shrink-0">
                    Delete {selectedKeys.size} annotation{selectedKeys.size !== 1 ? 's' : ''}?
                  </span>
                  <button
                    type="button"
                    className="px-2 py-0.5 bg-red-900/60 border border-red-700/70 hover:bg-red-800/60 rounded text-red-300 cursor-pointer shrink-0"
                    onClick={handleDeleteSelected}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded text-zinc-400 cursor-pointer shrink-0"
                    onClick={() => setDeleteConfirmPending(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="text-zinc-400 shrink-0">{selectedKeys.size} selected</span>
                  <button
                    type="button"
                    className="text-zinc-500 hover:text-zinc-300 cursor-pointer bg-transparent border-none shrink-0"
                    onClick={handleSelectAllVisible}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-zinc-500 hover:text-zinc-300 cursor-pointer bg-transparent border-none shrink-0"
                    onClick={() => setSelectedKeys(new Set())}
                  >
                    Deselect all
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    className="px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 rounded text-zinc-200 cursor-pointer shrink-0"
                    onClick={() => setShowCopyModal(true)}
                  >
                    Copy to file…
                  </button>
                  <button
                    type="button"
                    className="px-2 py-0.5 bg-red-950 hover:bg-red-900 border border-red-800 rounded text-red-300 cursor-pointer shrink-0"
                    onClick={() => setDeleteConfirmPending(true)}
                  >
                    Delete selected
                  </button>
                </>
              )
            )}
          </div>

          {viewMode === 'list' ? (
            /* Scrollable list */
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1.5">
              {positionClusters
                ? positionClusters.map((cluster) => (
                    <div key={cluster.label} className="mb-2">
                      <div className="flex items-center gap-1 px-2 py-0.5 mb-0.5">
                        <span className="text-[0.6rem] font-semibold text-amber-500/80 uppercase tracking-widest">
                          📍 {cluster.label}
                        </span>
                        <span className="text-[0.6rem] text-zinc-600">({cluster.groups.length})</span>
                      </div>
                      <div className="flex flex-col gap-0.5 pl-2 border-l border-zinc-700/50">
                        {cluster.groups.map((g) => renderGroupRow(g, 'Grenade'))}
                      </div>
                    </div>
                  ))
                : renderSection('Grenades', visibleItems.grenadeGroups.map((g) => renderGroupRow(g, 'Grenade')))
              }
              {renderSection('Lines',     visibleItems.lineGroups.map((g) => renderGroupRow(g, 'Line')))}
              {renderSection('Positions', visibleItems.positionIndices.map(renderNodeRow))}
              {renderSection('Text',      visibleItems.textIndices.map(renderNodeRow))}
              {renderSection('Spots',     visibleItems.spotIndices.map(renderNodeRow))}
              {nodes.length === 0 && (
                <p className="text-zinc-500 text-xs p-2 m-0 text-center">No nodes yet.<br />Click + Add to start.</p>
              )}
              {nodes.length > 0 && [
                visibleItems.grenadeGroups.length,
                visibleItems.lineGroups.length,
                visibleItems.positionIndices.length,
                visibleItems.textIndices.length,
                visibleItems.spotIndices.length,
              ].every((n) => n === 0) && (
                <p className="text-zinc-600 text-xs p-2 m-0 text-center">No nodes match the current filters.</p>
              )}
            </div>
          ) : (
            /* Map view */
            mapName
              ? <NodeMapView
                  mapName={mapName}
                  nodes={nodes}
                  grenadeGroups={visibleItems.grenadeGroups}
                  selectedIndex={selectedIndex}
                  onSelectIndex={(i) => setSelectedIndex(i)}
                  className="flex-1 min-h-0"
                />
              : <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm p-4 text-center">
                  Map view requires the annotation to have a MapName set.<br />
                  <span className="text-zinc-700 text-xs mt-1">Set it via root fields or open a guide with a map name.</span>
                </div>
          )}
        </aside>

        {/* Edit panel — splits horizontally when wide enough */}
        <section className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {selectedNode ? (
            <div className="flex flex-1 min-h-0 flex-col xl:flex-row overflow-hidden">
              {/* Form — always on left/top, scrollable */}
              <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
                <NodeEditForm
                  node={selectedNode}
                  index={selectedIndex!}
                  onChange={(u) => handleUpdateNode(selectedIndex!, u)}
                  onDelete={() => handleDeleteNode(selectedIndex!)}
                  onNotify={setMsg}
                  onUpdateNodeAt={handleUpdateNode}
                  aimTargetNode={(() => {
                    const node = selectedNode
                    if (node?.Type !== 'grenade' || (node.SubType !== 'main' && node.SubType)) return null
                    const g = groups.grenadeGroups.find((gr) => gr.indices[0] === selectedIndex!)
                    if (!g) return null
                    const aimIdx = g.indices.find((i) => nodes[i].SubType === 'aim_target')
                    return aimIdx !== undefined ? nodes[aimIdx] : null
                  })()}
                  aimTargetIndex={(() => {
                    const node = selectedNode
                    if (node?.Type !== 'grenade' || (node.SubType !== 'main' && node.SubType)) return null
                    const g = groups.grenadeGroups.find((gr) => gr.indices[0] === selectedIndex!)
                    if (!g) return null
                    return g.indices.find((i) => nodes[i].SubType === 'aim_target') ?? null
                  })()}
                />
              </div>
              {/* Map — right sidebar on wide screens, compact strip at bottom otherwise */}
              {mapName && mapMarkers.length > 0 && (
                <>
                  {/* xl+: fixed-width right sidebar */}
                  <div className="hidden xl:flex xl:w-96 xl:shrink-0 xl:flex-col xl:overflow-y-auto xl:border-l xl:border-zinc-700/60 p-3">
                    <MapOverlay
                      mapName={mapName}
                      markers={mapMarkers}
                      onCopySetpos={(cmd) => setMsg(`Copied: ${cmd}`)}
                    />
                  </div>
                  {/* Below xl: compact collapsible strip at the bottom of the edit area */}
                  <div className="xl:hidden shrink-0 border-t border-zinc-700/60 overflow-hidden" style={{ maxHeight: 220 }}>
                    <MapOverlay
                      mapName={mapName}
                      markers={mapMarkers}
                      onCopySetpos={(cmd) => setMsg(`Copied: ${cmd}`)}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
              Select a node to edit, or add one.
            </div>
          )}
        </section>
      </div>

      {showCreateModal && (
        <AnnotationCreateModal
          onClose={() => setShowCreateModal(false)}
          onSendCreate={handleSendCreate}
          onSaveCreate={handleSaveAnnotation}
          onAbortCreate={handleAbortAnnotation}
        />
      )}
      {showCopyModal && (
        <CopyToFileModal
          currentFilePath={filePath}
          currentMapName={mapName}
          selectedGroups={selectedGroups}
          onClose={() => setShowCopyModal(false)}
          onSuccess={handleCopySuccess}
        />
      )}
    </div>
  )
}

// ─── color helpers ────────────────────────────────────────────────────────────
function rgbToHex(c: [number, number, number]): string {
  return '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return null
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

const COLOR_PRESETS: { label: string; color: [number, number, number] }[] = [
  { label: 'White',          color: [255, 255, 255] },
  { label: '⚡ Instant',     color: [200,  70, 180] },  // instant lineups
  { label: '🟡 T-side',      color: [250, 230,   3] },  // T-side
  { label: '🔵 CT-side',     color: [ 60, 150, 230] },  // CT-side
  { label: 'Green',          color: [ 80, 220,  80] },
  { label: 'Red',            color: [255,  80,  80] },
  { label: 'Orange',         color: [255, 150,   0] },
]

// ─── NodeEditForm ─────────────────────────────────────────────────────────────
function NodeEditForm({
  node,
  onChange,
  onDelete,
  onNotify,
  onUpdateNodeAt,
  aimTargetNode,
  aimTargetIndex,
}: {
  node: AnnotationNode
  index: number
  onChange: (u: Partial<AnnotationNode>) => void
  onDelete: () => void
  onNotify?: (msg: string, isError?: boolean) => void
  onUpdateNodeAt?: (index: number, u: Partial<AnnotationNode>) => void
  aimTargetNode?: AnnotationNode | null
  aimTargetIndex?: number | null
}) {
  const update = (key: keyof AnnotationNode, value: unknown) => onChange({ [key]: value })
  const updateTextDesc = (field: 'Title' | 'Desc', key: keyof TextDescObject, v: string | number | boolean | undefined) =>
    onChange({ [field]: { ...node[field], [key]: v } })

  const posStr = node.Position?.join(', ') ?? ''
  const anglesStr = node.Angles?.join(', ') ?? ''
  const textOffsetStr = node.TextPositionOffset?.join(', ') ?? ''

  const handleCopySetpos = async () => {
    if (!node.Position) return
    const cmd = buildSetposCommand(node.Position, node.Angles)
    try {
      const copyViaIpc = window.electronAPI?.copyToClipboard
      if (typeof copyViaIpc === 'function') {
        const result = await copyViaIpc(cmd)
        if (result?.error) throw new Error(result.error)
      } else {
        await navigator.clipboard.writeText(cmd)
      }
      onNotify?.(`Copied: ${cmd}`)
    } catch (err) {
      onNotify?.(`Copy failed: ${err instanceof Error ? err.message : String(err)}`, true)
    }
  }

  const currentHex = node.Color ? rgbToHex(node.Color) : '#ffffff'
  const isMainNode = node.SubType === 'main' || !node.SubType

  return (
    <div className="p-5 flex flex-col gap-0">

      {/* ── Section: Identity ── */}
      <Section title="Identity">
        <Field label="Type">
          <span className="text-zinc-200 text-sm">
            {node.Type}{node.SubType ? ` (${node.SubType})` : ''}
          </span>
        </Field>
        <Field label="Show label">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 cursor-pointer accent-zinc-500"
              checked={node.Enabled !== false}
              onChange={(e) => update('Enabled', e.target.checked)}
            />
            <span className="text-xs text-zinc-500">Show text/title in-game (uncheck to hide label only; node stays in file)</span>
          </label>
        </Field>
        <Field label="Show 3D marker">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 cursor-pointer accent-zinc-500"
              checked={node.VisiblePfx !== false}
              onChange={(e) => update('VisiblePfx', e.target.checked)}
            />
            <span className="text-xs text-zinc-500">Show crosshair/dot/line in 3D (uncheck to hide marker only)</span>
          </label>
        </Field>
        <Field label="Node ID">
          <input type="text" value={node.Id ?? ''} onChange={(e) => update('Id', e.target.value)} />
        </Field>
        <Field label="Master node ID">
          <input type="text" value={node.MasterNodeId ?? ''} onChange={(e) => update('MasterNodeId', e.target.value)} />
        </Field>
      </Section>

      {/* ── Section: Style / Color ── */}
      <Section title={`Style${isMainNode ? ' (color cascades to children)' : ''}`}>
        <Field label="Color">
          <div className="flex flex-col gap-2">
            {/* Preset swatches */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                title="No color (default white)"
                className="w-6 h-6 rounded border-2 border-zinc-600 bg-zinc-900 text-zinc-500 text-[10px] flex items-center justify-center hover:border-zinc-400 transition-colors"
                onClick={() => update('Color', undefined)}
              >
                ×
              </button>
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  title={p.label}
                  style={{ backgroundColor: rgbToHex(p.color) }}
                  className={`w-6 h-6 rounded border-2 transition-colors hover:scale-110 ${
                    node.Color && rgbToHex(node.Color) === rgbToHex(p.color)
                      ? 'border-white scale-110'
                      : 'border-zinc-600 hover:border-zinc-300'
                  }`}
                  onClick={() => update('Color', p.color)}
                />
              ))}
            </div>
            {/* Custom color picker */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-7 rounded border border-zinc-600 cursor-pointer bg-transparent p-0.5"
                value={currentHex}
                onChange={(e) => {
                  const rgb = hexToRgb(e.target.value)
                  if (rgb) update('Color', rgb)
                }}
              />
              <span className="text-xs text-zinc-500">Custom</span>
              {node.Color && (
                <span className="text-xs text-zinc-600 font-mono">
                  [{node.Color.map(Math.round).join(', ')}]
                </span>
              )}
            </div>
          </div>
        </Field>
        <Field label="Text align">
          <select
            value={node.TextHorizontalAlign ?? 'center'}
            onChange={(e) => update('TextHorizontalAlign', e.target.value)}
          >
            <option value="center">Center</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </Field>
      </Section>

      {/* ── Section: Transform ── */}
      <Section title="Transform">
        <Field label="Position (x, y, z)">
          <input
            type="text"
            value={posStr}
            onChange={(e) => {
              const arr = e.target.value.split(',').map((s) => parseFloat(s.trim()))
              if (arr.length === 3 && arr.every((n) => !Number.isNaN(n)))
                update('Position', arr as [number, number, number])
            }}
          />
        </Field>
        <Field label="Angles (pitch, yaw, roll)">
          <input
            type="text"
            value={anglesStr}
            onChange={(e) => {
              const arr = e.target.value.split(',').map((s) => parseFloat(s.trim()))
              if (arr.length === 3 && arr.every((n) => !Number.isNaN(n)))
                update('Angles', arr as [number, number, number])
            }}
          />
        </Field>
        <Field label="Teleport">
          <button
            type="button"
            disabled={!node.Position}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-600 hover:bg-zinc-700 rounded text-zinc-300 cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Copy setpos + setang command to clipboard"
            onClick={handleCopySetpos}
          >
            Copy setpos cmd
          </button>
        </Field>
      </Section>

      {/* ── Section: Labels ── */}
      <Section title="Labels">
        <Field label="Title">
          <input
            type="text"
            value={node.Title?.Text ?? ''}
            onChange={(e) => updateTextDesc('Title', 'Text', e.target.value)}
          />
        </Field>
        <Field label="Description">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={node.Desc?.Text ?? ''}
              onChange={(e) => updateTextDesc('Desc', 'Text', e.target.value)}
            />
            <label
              className="shrink-0 flex items-center gap-1.5 cursor-pointer"
              title="Hide this description text by setting its fade-out to 0. Title still shows. Useful for overlapping lineups."
            >
              <input
                type="checkbox"
                className="w-3.5 h-3.5 cursor-pointer accent-zinc-500"
                checked={(node.Desc?.FadeOutDist ?? -1) !== 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    updateTextDesc('Desc', 'FadeOutDist', -1)
                    updateTextDesc('Desc', 'FadeInDist', node.Desc?.FadeInDist ?? -1)
                  } else {
                    updateTextDesc('Desc', 'FadeOutDist', 0)
                    updateTextDesc('Desc', 'FadeInDist', 0)
                  }
                }}
              />
              <span className="text-[0.65rem] text-zinc-500">Show</span>
            </label>
          </div>
        </Field>
        <Field label="Label offset (x,y,z)">
          <input
            type="text"
            value={textOffsetStr}
            placeholder="0, 0, 0"
            title="Moves only the label text in world space. e.g. 0, 0, 40 to raise. Does not change 3D position."
            onChange={(e) => {
              const raw = e.target.value.trim()
              if (!raw) { update('TextPositionOffset', undefined); return }
              const arr = raw.split(',').map((s) => parseFloat(s.trim()))
              if (arr.length === 3 && arr.every((n) => !Number.isNaN(n)))
                update('TextPositionOffset', arr as [number, number, number])
            }}
          />
        </Field>

        {/* Fade + font — compact two-column layout */}
        <div className="mt-2 pt-2 border-t border-zinc-700/40 flex flex-col gap-1.5">
          <span className="text-[0.65rem] text-zinc-500">
            Fade: -1 = always visible · 0 = never · positive = visible within N units.
          </span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {/* Title column */}
            <div className="flex flex-col gap-1">
              <span className="text-[0.6rem] font-semibold text-zinc-500 uppercase tracking-wide">Title</span>
              <FadeSlider label="Fade in"  value={node.Title?.FadeInDist  ?? -1} onChange={(v) => updateTextDesc('Title', 'FadeInDist',  v)} />
              <FadeSlider label="Fade out" value={node.Title?.FadeOutDist ?? -1} onChange={(v) => updateTextDesc('Title', 'FadeOutDist', v)} />
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[0.6rem] text-zinc-500 w-12 shrink-0">Font</span>
                <input type="number" min={1} max={500} className="w-14 text-xs"
                  value={node.Title?.FontSize ?? 100}
                  onChange={(e) => { const v = parseInt(e.target.value, 10); updateTextDesc('Title', 'FontSize', Number.isNaN(v) ? undefined : v) }} />
                <label className="flex items-center gap-1 cursor-pointer ml-auto">
                  <input type="checkbox" className="w-3 h-3 cursor-pointer accent-zinc-500"
                    checked={node.Title?.ShowBackground !== false}
                    onChange={(e) => updateTextDesc('Title', 'ShowBackground', e.target.checked)} />
                  <span className="text-[0.6rem] text-zinc-500">BG</span>
                </label>
              </div>
            </div>
            {/* Desc column */}
            <div className="flex flex-col gap-1">
              <span className="text-[0.6rem] font-semibold text-zinc-500 uppercase tracking-wide">Description</span>
              <FadeSlider label="Fade in"  value={node.Desc?.FadeInDist  ?? -1} onChange={(v) => updateTextDesc('Desc', 'FadeInDist',  v)} />
              <FadeSlider label="Fade out" value={node.Desc?.FadeOutDist ?? -1} onChange={(v) => updateTextDesc('Desc', 'FadeOutDist', v)} />
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[0.6rem] text-zinc-500 w-12 shrink-0">Font</span>
                <input type="number" min={1} max={500} className="w-14 text-xs"
                  value={node.Desc?.FontSize ?? 75}
                  onChange={(e) => { const v = parseInt(e.target.value, 10); updateTextDesc('Desc', 'FontSize', Number.isNaN(v) ? undefined : v) }} />
                <label className="flex items-center gap-1 cursor-pointer ml-auto">
                  <input type="checkbox" className="w-3 h-3 cursor-pointer accent-zinc-500"
                    checked={node.Desc?.ShowBackground !== false}
                    onChange={(e) => updateTextDesc('Desc', 'ShowBackground', e.target.checked)} />
                  <span className="text-[0.6rem] text-zinc-500">BG</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Section: Aim instruction (grenade main only) ── */}
      {aimTargetNode != null && aimTargetIndex != null && typeof onUpdateNodeAt === 'function' && (
        <Section title="Aim instruction (crosshair label in-game)">
          <p className="text-[0.7rem] text-zinc-500 mb-2">
            Text shown at the aim crosshair. Often the throw type, e.g. &quot;standing W-Jumpthrow&quot;.
          </p>
          <Field label="Aim title">
            <input
              type="text"
              value={aimTargetNode.Title?.Text ?? ''}
              onChange={(e) =>
                onUpdateNodeAt(aimTargetIndex, {
                  Title: { ...defaultTextDesc(), ...aimTargetNode.Title, Text: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Aim description">
            <input
              type="text"
              value={aimTargetNode.Desc?.Text ?? ''}
              placeholder="e.g. standing W-Jumpthrow"
              onChange={(e) =>
                onUpdateNodeAt(aimTargetIndex, {
                  Desc: { ...defaultTextDesc(), ...aimTargetNode.Desc, Text: e.target.value },
                })
              }
            />
          </Field>
          <div className="flex flex-wrap gap-4 mt-2 items-center">
            <Field label="Show aim label">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 cursor-pointer accent-zinc-500"
                  checked={aimTargetNode.Enabled !== false}
                  onChange={(e) => onUpdateNodeAt(aimTargetIndex, { Enabled: e.target.checked })}
                />
                <span className="text-xs text-zinc-500">Show standing instruction text</span>
              </label>
            </Field>
            <Field label="Show aim marker">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 cursor-pointer accent-zinc-500"
                  checked={aimTargetNode.VisiblePfx !== false}
                  onChange={(e) => onUpdateNodeAt(aimTargetIndex, { VisiblePfx: e.target.checked })}
                />
                <span className="text-xs text-zinc-500">Show crosshair in 3D</span>
              </label>
            </Field>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-700/40 flex flex-col gap-1.5">
            <FadeSlider
              label="Fade in"
              value={aimTargetNode.Desc?.FadeInDist ?? -1}
              onChange={(v) => onUpdateNodeAt(aimTargetIndex, {
                Title: { ...defaultTextDesc(), ...aimTargetNode.Title, FadeInDist: v },
                Desc:  { ...defaultTextDesc(), ...aimTargetNode.Desc,  FadeInDist: v },
              })}
            />
            <FadeSlider
              label="Fade out"
              value={aimTargetNode.Desc?.FadeOutDist ?? -1}
              onChange={(v) => onUpdateNodeAt(aimTargetIndex, {
                Title: { ...defaultTextDesc(), ...aimTargetNode.Title, FadeOutDist: v },
                Desc:  { ...defaultTextDesc(), ...aimTargetNode.Desc,  FadeOutDist: v },
              })}
            />
            <div className="flex items-center gap-1.5">
              <span className="text-[0.6rem] text-zinc-500 w-12 shrink-0">Font size</span>
              <input type="number" min={1} max={500} className="w-14 text-xs"
                value={aimTargetNode.Desc?.FontSize ?? 75}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (Number.isNaN(v)) return
                  onUpdateNodeAt(aimTargetIndex, { Desc: { ...defaultTextDesc(), ...aimTargetNode.Desc, FontSize: v } })
                }}
              />
            </div>
          </div>
        </Section>
      )}

      {/* ── Section: Grenade-specific ── */}
      {node.Type === 'grenade' && isMainNode && (
        <Section title="Grenade">
          <Field label="Grenade type">
            <select
              value={node.GrenadeType ?? 'smoke'}
              onChange={(e) => update('GrenadeType', e.target.value as GrenadeType)}
            >
              {GRENADE_TYPES.map((gt) => (
                <option key={gt} value={gt}>{gt}</option>
              ))}
            </select>
          </Field>
        </Section>
      )}

      {/* ── Delete ── */}
      <div className="mt-4 pt-4 border-t border-zinc-700/60">
        <button
          type="button"
          className="px-4 py-2 bg-red-950 hover:bg-red-900 border border-red-800 rounded text-red-300 cursor-pointer text-sm transition-colors"
          onClick={onDelete}
        >
          {node.Type === 'grenade' && isMainNode ? 'Delete entire grenade set' : 'Delete node'}
        </button>
      </div>
    </div>
  )
}

// ── Filter UI helpers ─────────────────────────────────────────────────────────
// ── FadeSlider ────────────────────────────────────────────────────────────────
function FadeSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[0.6rem] text-zinc-500 w-12 shrink-0">{label}</span>
      <input
        type="range"
        min={-1}
        max={1200}
        step={10}
        value={value}
        className="flex-1 h-1 accent-zinc-500 cursor-pointer"
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      />
      <span className="text-[0.6rem] text-zinc-400 w-8 text-right shrink-0 font-mono">
        {value === -1 ? '∞' : value}
      </span>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[0.6rem] text-zinc-600 w-8 shrink-0">{label}</span>
      {children}
    </div>
  )
}

function FilterPill({
  active, onClick, children, dim, title,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  dim?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`px-1.5 py-0.5 rounded text-[0.65rem] border-none cursor-pointer transition-colors leading-none ${
        active
          ? 'bg-zinc-600 text-zinc-100'
          : dim
            ? 'bg-transparent text-zinc-600 hover:text-zinc-400'
            : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  )
}

// ── Small layout helpers ──────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[0.65rem] font-semibold text-zinc-500 uppercase tracking-widest mb-2 pb-1 border-b border-zinc-700/60">
        {title}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <label className="w-36 shrink-0 text-xs text-zinc-400 pt-1.5 leading-tight">{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function EyeOpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1.5 7c0 0 2.5-4.5 5.5-4.5S12.5 7 12.5 7s-2.5 4.5-5.5 4.5S1.5 7 1.5 7z"
        stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="7" r="1.8" fill="currentColor" />
    </svg>
  )
}

function EyeClosedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1.5 7c0 0 2.5-4.5 5.5-4.5S12.5 7 12.5 7s-2.5 4.5-5.5 4.5S1.5 7 1.5 7z"
        stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      <line x1="2.5" y1="2.5" x2="11.5" y2="11.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
