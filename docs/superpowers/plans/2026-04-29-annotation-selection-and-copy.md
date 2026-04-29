# Annotation Selection & Cross-File Copy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repurpose annotation row checkboxes for bulk selection, replace visibility checkboxes with eye icons, and enable copying selected annotations to another guide file or a newly-created one with full KV3 file-integrity safeguards.

**Architecture:** Extract shared group-building and duplicate-detection logic into `src/annotation/groupUtils.ts`. Add two Electron IPC handlers for atomic file operations (backup → write → validate → rollback). Redesign GuideEditor row layout. Create a standalone `CopyToFileModal` component.

**Tech Stack:** React 18, TypeScript 5, Electron 28, Vite / electron-vite, Vitest (added for utility tests), Tailwind CSS v4

---

## File Map

| File | Action | Responsibility |
| --- | --- | --- |
| `src/annotation/groupUtils.ts` | Create | `NodeGroup`, `SelectedGroup` types; `buildNodeGroups`, `nodeLabel`, `buildSelectedGroups`, `classifyDuplicates` |
| `src/annotation/groupUtils.test.ts` | Create | Vitest unit tests for `classifyDuplicates` and `buildSelectedGroups` |
| `vitest.config.ts` | Create | Vitest config for `src/**/*.test.ts` |
| `src/components/CopyToFileModal.tsx` | Create | Modal: guide list, create-new form, duplicate pre-flight, confirm |
| `src/components/GuideEditor.tsx` | Modify | Import from groupUtils, add selection state, eye icons, action bar, delete-selected, wire modal |
| `electron/main/index.ts` | Modify | Add `appendNodesToGuide` and `createGuideWithNodes` IPC handlers |
| `electron/preload/index.ts` | Modify | Expose new handlers |
| `src/vite-env.d.ts` | Modify | Add new handler types to `ElectronAPI` |
| `package.json` | Modify | Add `vitest` dev dependency and `test` script |

---

## Task 1: Install Vitest and create groupUtils.ts

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/annotation/groupUtils.ts`
- Create: `src/annotation/groupUtils.test.ts`
- Modify: `src/components/GuideEditor.tsx` (remove local definitions, add import)

- [ ] **Step 1.1: Add Vitest to package.json**

Replace the `"scripts"` and `"devDependencies"` sections in `package.json`:

```json
"scripts": {
  "dev": "electron-vite dev",
  "build": "electron-vite build",
  "preview": "electron-vite preview",
  "test": "vitest run"
},
```

```json
"devDependencies": {
  "@types/node": "^20.10.0",
  "@types/react": "^18.2.45",
  "@types/react-dom": "^18.2.18",
  "@vitejs/plugin-react": "^4.2.1",
  "electron": "^28.0.0",
  "electron-vite": "^2.0.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.3.3",
  "vite": "^5.0.0",
  "vitest": "^1.6.0"
}
```

- [ ] **Step 1.2: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 1.3: Install the new dependency**

```bash
npm install
```

Expected: installs vitest, no errors.

- [ ] **Step 1.4: Write the failing tests first**

Create `src/annotation/groupUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildNodeGroups, buildSelectedGroups, classifyDuplicates } from './groupUtils'
import type { AnnotationNode } from './types'

function grenade(
  id: string,
  mainPos: [number, number, number],
  aimPos: [number, number, number],
  destPos: [number, number, number]
): AnnotationNode[] {
  return [
    { Type: 'grenade', SubType: 'main', Id: id, Position: mainPos, Angles: [0, 0, 0], GrenadeType: 'smoke' } as AnnotationNode,
    { Type: 'grenade', SubType: 'aim_target', MasterNodeId: id, Id: id + '_aim', Position: aimPos, Angles: [0, 45, 0] } as AnnotationNode,
    { Type: 'grenade', SubType: 'destination', MasterNodeId: id, Id: id + '_dest', Position: destPos } as AnnotationNode,
  ]
}

function posNode(id: string, pos: [number, number, number], angles: [number, number, number]): AnnotationNode {
  return { Type: 'position', Id: id, Position: pos, Angles: angles } as AnnotationNode
}

describe('classifyDuplicates – grenade', () => {
  it('flags a grenade as duplicate when all three positions match existing', () => {
    const nodes = grenade('g1', [100, 200, 0], [0, 0, 64], [300, 400, 0])
    const incoming = [{ type: 'grenade' as const, nodes }]
    const { toAdd, skipped } = classifyDuplicates(incoming, nodes)
    expect(toAdd).toHaveLength(0)
    expect(skipped).toHaveLength(1)
  })

  it('does not flag grenade as duplicate when main position differs', () => {
    const existing = grenade('g1', [100, 200, 0], [0, 0, 64], [300, 400, 0])
    const incoming = [{ type: 'grenade' as const, nodes: grenade('g2', [101, 200, 0], [0, 0, 64], [300, 400, 0]) }]
    const { toAdd, skipped } = classifyDuplicates(incoming, existing)
    expect(toAdd).toHaveLength(1)
    expect(skipped).toHaveLength(0)
  })

  it('does not flag grenade as duplicate when destination position differs', () => {
    const existing = grenade('g1', [100, 200, 0], [0, 0, 64], [300, 400, 0])
    const incoming = [{ type: 'grenade' as const, nodes: grenade('g2', [100, 200, 0], [0, 0, 64], [300, 401, 0]) }]
    const { toAdd, skipped } = classifyDuplicates(incoming, existing)
    expect(toAdd).toHaveLength(1)
    expect(skipped).toHaveLength(0)
  })
})

describe('classifyDuplicates – position node', () => {
  it('flags position as duplicate when position and angles match', () => {
    const node = posNode('p1', [10, 20, 0], [0, 90, 0])
    const incoming = [{ type: 'position' as const, nodes: [node] }]
    const { toAdd, skipped } = classifyDuplicates(incoming, [node])
    expect(skipped).toHaveLength(1)
    expect(toAdd).toHaveLength(0)
  })

  it('does not flag position as duplicate when angles differ', () => {
    const existing = posNode('p1', [10, 20, 0], [0, 90, 0])
    const incoming = [{ type: 'position' as const, nodes: [posNode('p2', [10, 20, 0], [0, 91, 0])] }]
    const { toAdd, skipped } = classifyDuplicates(incoming, [existing])
    expect(toAdd).toHaveLength(1)
    expect(skipped).toHaveLength(0)
  })
})

describe('buildSelectedGroups', () => {
  it('returns grenade group for a selected key matching the main node index', () => {
    const nodes = grenade('g1', [0, 0, 0], [1, 1, 1], [2, 2, 2])
    const groups = buildNodeGroups(nodes)
    const result = buildSelectedGroups(new Set([0]), nodes, groups)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('grenade')
    expect(result[0].nodes).toHaveLength(3)
  })

  it('returns individual node for a position type', () => {
    const nodes: AnnotationNode[] = [posNode('p1', [0, 0, 0], [0, 0, 0])]
    const groups = buildNodeGroups(nodes)
    const result = buildSelectedGroups(new Set([0]), nodes, groups)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('position')
    expect(result[0].nodes).toHaveLength(1)
  })
})
```

- [ ] **Step 1.5: Run tests — expect them to fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './groupUtils'`

- [ ] **Step 1.6: Create src/annotation/groupUtils.ts**

```ts
import type { AnnotationNode, NodeType } from './types'

export interface NodeGroup {
  indices: number[]
  label: string
}

export interface SelectedGroup {
  type: NodeType
  nodes: AnnotationNode[]
}

export function nodeLabel(node: AnnotationNode): string {
  const title = node.Title?.Text ?? node.Desc?.Text
  if (title) return title.slice(0, 40) + (title.length > 40 ? '…' : '')
  if (node.Type === 'grenade' && node.GrenadeType) return `Grenade (${node.GrenadeType})`
  return `${node.Type}${node.SubType ? ` (${node.SubType})` : ''}`
}

export function buildNodeGroups(nodes: AnnotationNode[]) {
  const used = new Set<number>()
  const grenadeGroups: NodeGroup[] = []
  const lineGroups: NodeGroup[] = []

  for (let i = 0; i < nodes.length; i++) {
    if (used.has(i)) continue
    const node = nodes[i]
    if (node.Type === 'grenade' && (node.SubType === 'main' || !node.SubType) && node.Id) {
      const indices = [i, ...nodes.map((n, j) => (n.MasterNodeId === node.Id ? j : -1)).filter((j) => j >= 0)]
      indices.forEach((j) => used.add(j))
      grenadeGroups.push({ indices, label: nodeLabel(node) || `Grenade (${node.GrenadeType ?? 'smoke'})` })
    } else if (node.Type === 'line' && (node.SubType === 'main' || !node.SubType) && node.Id) {
      const indices = [i, ...nodes.map((n, j) => (n.MasterNodeId === node.Id ? j : -1)).filter((j) => j >= 0)]
      indices.forEach((j) => used.add(j))
      lineGroups.push({ indices, label: nodeLabel(node) || 'Line' })
    }
  }

  const positionIndices: number[] = []
  const textIndices: number[] = []
  const spotIndices: number[] = []
  for (let i = 0; i < nodes.length; i++) {
    if (used.has(i)) continue
    const { Type } = nodes[i]
    if (Type === 'position') positionIndices.push(i)
    else if (Type === 'text') textIndices.push(i)
    else if (Type === 'spot') spotIndices.push(i)
  }

  return { grenadeGroups, lineGroups, positionIndices, textIndices, spotIndices }
}

export function buildSelectedGroups(
  selectedKeys: Set<number>,
  nodes: AnnotationNode[],
  groups: ReturnType<typeof buildNodeGroups>
): SelectedGroup[] {
  const result: SelectedGroup[] = []
  for (const key of selectedKeys) {
    const grenadeGroup = groups.grenadeGroups.find((g) => g.indices[0] === key)
    if (grenadeGroup) {
      result.push({ type: 'grenade', nodes: grenadeGroup.indices.map((i) => nodes[i]) })
      continue
    }
    const lineGroup = groups.lineGroups.find((g) => g.indices[0] === key)
    if (lineGroup) {
      result.push({ type: 'line', nodes: lineGroup.indices.map((i) => nodes[i]) })
      continue
    }
    const node = nodes[key]
    if (node) result.push({ type: node.Type, nodes: [node] })
  }
  return result
}

function posEq(
  a?: [number, number, number] | null,
  b?: [number, number, number] | null
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

function groupMatchesExisting(
  group: SelectedGroup,
  existingGroups: ReturnType<typeof buildNodeGroups>,
  existingNodes: AnnotationNode[]
): boolean {
  if (group.type === 'grenade') {
    const main = group.nodes.find((n) => n.SubType === 'main' || !n.SubType)
    const aim = group.nodes.find((n) => n.SubType === 'aim_target')
    const dest = group.nodes.find((n) => n.SubType === 'destination')
    return existingGroups.grenadeGroups.some((eg) => {
      const eNodes = eg.indices.map((i) => existingNodes[i])
      const eMain = eNodes.find((n) => n.SubType === 'main' || !n.SubType)
      const eAim = eNodes.find((n) => n.SubType === 'aim_target')
      const eDest = eNodes.find((n) => n.SubType === 'destination')
      return (
        posEq(main?.Position, eMain?.Position) &&
        posEq(main?.Angles, eMain?.Angles) &&
        posEq(aim?.Position, eAim?.Position) &&
        posEq(aim?.Angles, eAim?.Angles) &&
        posEq(dest?.Position, eDest?.Position)
      )
    })
  }
  if (group.type === 'line') {
    const inWaypoints = group.nodes.map((n) => n.Position)
    return existingGroups.lineGroups.some((eg) => {
      const eNodes = eg.indices.map((i) => existingNodes[i])
      const eWaypoints = eNodes.map((n) => n.Position)
      if (inWaypoints.length !== eWaypoints.length) return false
      return inWaypoints.every((wp, i) => posEq(wp, eWaypoints[i]))
    })
  }
  const inNode = group.nodes[0]
  if (!inNode) return false
  const bucket =
    group.type === 'position'
      ? existingGroups.positionIndices
      : group.type === 'text'
        ? existingGroups.textIndices
        : existingGroups.spotIndices
  return bucket.some((i) => {
    const en = existingNodes[i]
    return posEq(inNode.Position, en.Position) && posEq(inNode.Angles, en.Angles)
  })
}

export function classifyDuplicates(
  incoming: SelectedGroup[],
  existingNodes: AnnotationNode[]
): { toAdd: SelectedGroup[]; skipped: SelectedGroup[] } {
  const existingGroups = buildNodeGroups(existingNodes)
  const toAdd: SelectedGroup[] = []
  const skipped: SelectedGroup[] = []
  for (const group of incoming) {
    if (groupMatchesExisting(group, existingGroups, existingNodes)) {
      skipped.push(group)
    } else {
      toAdd.push(group)
    }
  }
  return { toAdd, skipped }
}
```

- [ ] **Step 1.7: Run tests — expect them to pass**

```bash
npm test
```

Expected: all 7 tests PASS.

- [ ] **Step 1.8: Update GuideEditor.tsx imports — remove local definitions**

In `src/components/GuideEditor.tsx`:

Remove lines 41–44 (`interface NodeGroup { ... }`).

Remove lines 65–69 (function `nodeLabel`).

Remove lines 94–125 (function `buildNodeGroups`).

Add this import after the existing imports at the top of the file (after line 29, the `buildSetposCommand` import):

```ts
import { buildNodeGroups, nodeLabel, type NodeGroup } from '../annotation/groupUtils'
```

- [ ] **Step 1.9: Verify the app still compiles**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 1.10: Commit**

```bash
git add src/annotation/groupUtils.ts src/annotation/groupUtils.test.ts vitest.config.ts package.json package-lock.json src/components/GuideEditor.tsx
git commit -m "refactor: extract group utilities to groupUtils.ts, add vitest"
```

---

## Task 2: Add IPC handlers to electron/main/index.ts

**Files:**
- Modify: `electron/main/index.ts`

- [ ] **Step 2.1: Add `appendNodesToGuide` handler**

Append this block to `electron/main/index.ts`, after the `deleteGuide` handler (after line ~444):

```ts
ipcMain.handle(
  'appendNodesToGuide',
  async (
    _event,
    payload: { targetFilePath: string; nodes: AnnotationNode[] }
  ): Promise<{ error?: string; finalNodeCount?: number }> => {
    try {
      const { targetFilePath, nodes: newNodes } = payload
      if (!fs.existsSync(targetFilePath))
        return { error: `File not found: ${targetFilePath}` }

      const bakPath = targetFilePath + '.bak'
      fs.copyFileSync(targetFilePath, bakPath)

      let raw = fs.readFileSync(targetFilePath, 'utf-8')
      if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)
      const root = parseKv3Text(raw) as Kv3Object
      const nodesKey = extractNodesKey(root)
      const existingNodes = kv3ToNodes(root, nodesKey)

      const merged = [...existingNodes, ...newNodes]
      setNodesInRoot(root, merged, nodesKey)
      const out = serializeKv3Text(root)
      writeAnnotationFile(targetFilePath, out)

      try {
        const written = fs.readFileSync(targetFilePath, 'utf-8').replace(/^﻿/, '')
        parseKv3Text(written)
      } catch {
        fs.copyFileSync(bakPath, targetFilePath)
        return {
          error:
            'Copy failed: file could not be validated after write. The original file has been restored.',
        }
      }

      return { finalNodeCount: merged.length }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }
)
```

- [ ] **Step 2.2: Add `createGuideWithNodes` handler**

Append this block immediately after the `appendNodesToGuide` handler:

```ts
ipcMain.handle(
  'createGuideWithNodes',
  async (
    _event,
    payload: { filename: string; mapName: string; nodes: AnnotationNode[] }
  ): Promise<{ error?: string; loadName?: string; filePath?: string }> => {
    try {
      const rootPath = getAnnotationsRootPath()
      const safeName = toLocalGuideName(payload.filename)
      if (!safeName)
        return {
          error: 'Invalid guide name. Use letters, numbers, underscores or hyphens.',
        }
      const dirPath = path.join(rootPath, safeName)
      const filePath = path.join(dirPath, `${safeName}.txt`)
      if (fs.existsSync(filePath))
        return { error: `Guide "${safeName}" already exists.` }

      fs.mkdirSync(dirPath, { recursive: true })
      const root: Kv3Object = { MapName: payload.mapName, ScreenText: {}, Nodes: [] }
      setNodesInRoot(root, payload.nodes, 'Nodes')
      const out = serializeKv3Text(root)
      writeAnnotationFile(filePath, out)

      try {
        const written = fs.readFileSync(filePath, 'utf-8').replace(/^﻿/, '')
        parseKv3Text(written)
      } catch {
        try {
          fs.unlinkSync(filePath)
          fs.rmdirSync(dirPath)
        } catch {}
        return {
          error: 'Create failed: file could not be validated after write.',
        }
      }

      return { loadName: safeName, filePath }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }
)
```

- [ ] **Step 2.3: Verify the main process compiles**

```bash
npm run build
```

Expected: no TypeScript errors. The `AnnotationNode` type is already imported at the top of `electron/main/index.ts`.

- [ ] **Step 2.4: Commit**

```bash
git add electron/main/index.ts
git commit -m "feat: add appendNodesToGuide and createGuideWithNodes IPC handlers"
```

---

## Task 3: Update preload and type declarations

**Files:**
- Modify: `electron/preload/index.ts`
- Modify: `src/vite-env.d.ts`

- [ ] **Step 3.1: Add handlers to preload**

In `electron/preload/index.ts`, add two entries inside `contextBridge.exposeInMainWorld('electronAPI', { ... })`, after the `deleteGuide` line:

```ts
  appendNodesToGuide: (payload: { targetFilePath: string; nodes: unknown[] }) =>
    ipcRenderer.invoke('appendNodesToGuide', payload),
  createGuideWithNodes: (payload: { filename: string; mapName: string; nodes: unknown[] }) =>
    ipcRenderer.invoke('createGuideWithNodes', payload),
```

- [ ] **Step 3.2: Add types to vite-env.d.ts**

In `src/vite-env.d.ts`, add two entries to the `ElectronAPI` interface, after the `deleteGuide` line:

```ts
  appendNodesToGuide: (payload: {
    targetFilePath: string
    nodes: AnnotationNode[]
  }) => Promise<{ error?: string; finalNodeCount?: number }>
  createGuideWithNodes: (payload: {
    filename: string
    mapName: string
    nodes: AnnotationNode[]
  }) => Promise<{ error?: string; loadName?: string; filePath?: string }>
```

- [ ] **Step 3.3: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3.4: Commit**

```bash
git add electron/preload/index.ts src/vite-env.d.ts
git commit -m "feat: expose appendNodesToGuide and createGuideWithNodes in preload"
```

---

## Task 4: GuideEditor — selection state, eye icons, row layout

**Files:**
- Modify: `src/components/GuideEditor.tsx`

- [ ] **Step 4.1: Add eye icon components**

Add these two small components at the bottom of `src/components/GuideEditor.tsx`, just before the final closing (after the `Field` function, around line 1534):

```tsx
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
```

- [ ] **Step 4.2: Add selection state to GuideEditor**

In the `GuideEditor` component function, after the existing `useState` declarations (around line 154, after `const [showCreateModal, setShowCreateModal] = useState(false)`), add:

```ts
const [selectedKeys, setSelectedKeys] = useState<Set<number>>(new Set())
const [deleteConfirmPending, setDeleteConfirmPending] = useState(false)
const [showCopyModal, setShowCopyModal] = useState(false)
```

`handleSelectAllVisible` and `handleDeleteSelected` reference `visibleItems` and `groups` (both `useMemo` values), so they must be placed **after** those memos. Place them after the `setMsg` helper function (around line 385, before `handleSave`):

```ts
function handleSelectAllVisible() {
  const keys = new Set<number>()
  visibleItems.grenadeGroups.forEach((g) => keys.add(g.indices[0]))
  visibleItems.lineGroups.forEach((g) => keys.add(g.indices[0]))
  visibleItems.positionIndices.forEach((i) => keys.add(i))
  visibleItems.textIndices.forEach((i) => keys.add(i))
  visibleItems.spotIndices.forEach((i) => keys.add(i))
  setSelectedKeys(keys)
}
```

Note: `visibleItems` is computed with `useMemo` later in the component, so `handleSelectAllVisible` must be called only after render (it is — it's only called from a click handler, never during render). This is fine.

- [ ] **Step 4.3: Update renderGroupRow — selection checkbox + eye icon**

Replace the entire `renderGroupRow` function (lines ~562–616) with:

```tsx
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
```

- [ ] **Step 4.4: Update renderNodeRow — selection checkbox + eye icon**

Replace the entire `renderNodeRow` function (lines ~535–560) with:

```tsx
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
```

- [ ] **Step 4.5: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4.6: Commit**

```bash
git add src/components/GuideEditor.tsx
git commit -m "feat: add selection checkboxes and eye icon visibility toggles to annotation rows"
```

---

## Task 5: GuideEditor — bulk action bar and delete selected

**Files:**
- Modify: `src/components/GuideEditor.tsx`

- [ ] **Step 5.1: Add delete-confirm state**

After the `selectedKeys` state declaration added in Task 4 Step 4.2, add:

```ts
const [deleteConfirmPending, setDeleteConfirmPending] = useState(false)
```

- [ ] **Step 5.2: Add handleDeleteSelected helper**

After the `handleSelectAllVisible` function added in Task 4, add:

```ts
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
```

- [ ] **Step 5.3: Add the bulk action bar to the JSX**

In the render section, locate the filter controls `<div>` that ends with a closing `</div>` before `{viewMode === 'list' ? (`. Insert the action bar block **between** the filter controls closing tag and the `{viewMode === 'list' ?` line:

```tsx
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
```

Note: `setShowCopyModal` is used here but will be added in Task 7. The build will fail until then — that's fine; commit only after Task 7 or temporarily declare the state now.

To avoid a broken intermediate commit, also add these two state declarations now (alongside the `deleteConfirmPending` state from Step 5.1):

```ts
const [showCopyModal, setShowCopyModal] = useState(false)
```

- [ ] **Step 5.4: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5.5: Commit**

```bash
git add src/components/GuideEditor.tsx
git commit -m "feat: add bulk action bar with delete-selected and copy-to-file trigger"
```

---

## Task 6: Create CopyToFileModal component

**Files:**
- Create: `src/components/CopyToFileModal.tsx`

- [ ] **Step 6.1: Create the component**

Create `src/components/CopyToFileModal.tsx`:

```tsx
import { useState, useEffect } from 'react'
import type { AnnotationNode } from '../annotation/types'
import { classifyDuplicates, type SelectedGroup } from '../annotation/groupUtils'

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
  const [guides, setGuides] = useState<GuideOption[]>([])
  const [loadingGuides, setLoadingGuides] = useState(true)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [createMode, setCreateMode] = useState(false)
  const [newName, setNewName] = useState('')
  const [targetNodes, setTargetNodes] = useState<AnnotationNode[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Load all local guides sharing this map name (excluding current file)
  useEffect(() => {
    async function load() {
      setLoadingGuides(true)
      const list = await window.electronAPI.listGuides()
      const candidates = list.filter(
        (g) =>
          g.source === 'local' &&
          g.installed &&
          g.path !== currentFilePath &&
          g.mapName === currentMapName
      )
      const opts: GuideOption[] = []
      for (const g of candidates) {
        const result = await window.electronAPI.loadGuide(g.path)
        if ('error' in result) continue
        opts.push({ name: g.name, filePath: g.path, nodeCount: result.nodes.length })
      }
      setGuides(opts)
      if (opts.length === 0) setCreateMode(true)
      setLoadingGuides(false)
    }
    void load()
  }, [currentFilePath, currentMapName])

  // Load target file nodes when selection changes (for duplicate check)
  useEffect(() => {
    if (!selectedFilePath) { setTargetNodes(null); return }
    async function load() {
      const result = await window.electronAPI.loadGuide(selectedFilePath!)
      if (!('error' in result)) setTargetNodes(result.nodes)
    }
    void load()
  }, [selectedFilePath])

  // Pre-flight duplicate classification
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
      const result = await window.electronAPI.createGuideWithNodes({
        filename: newName.trim(),
        mapName: currentMapName,
        nodes: nodesToWrite,
      })
      if (result.error) { setError(result.error); setBusy(false); return }
      onSuccess(
        `Copied ${toAdd.length} annotation${toAdd.length !== 1 ? 's' : ''} to new file "${result.loadName}". Open it from the Guides screen.`
      )
    } else if (selectedFilePath) {
      const result = await window.electronAPI.appendNodesToGuide({
        targetFilePath: selectedFilePath,
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
    <div className="fixed inset-0 z-500 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-sm mx-4 flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60 shrink-0">
          <h2 className="text-base font-semibold text-zinc-100 m-0">
            Copy {selectedGroups.length} annotation{selectedGroups.length !== 1 ? 's' : ''} to…
          </h2>
          <button type="button" className="text-zinc-500 hover:text-zinc-200 text-lg leading-none" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 flex flex-col gap-4 overflow-y-auto">
          {loadingGuides ? (
            <p className="text-zinc-500 text-sm text-center py-2">Loading…</p>
          ) : (
            <>
              {/* Existing files section */}
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

              {/* Divider */}
              {guides.length > 0 && <div className="border-t border-zinc-700/60" />}

              {/* Create new section */}
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

              {/* Pre-flight summary */}
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

        {/* Footer */}
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
```

- [ ] **Step 6.2: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 6.3: Commit**

```bash
git add src/components/CopyToFileModal.tsx
git commit -m "feat: add CopyToFileModal component"
```

---

## Task 7: Wire CopyToFileModal into GuideEditor

**Files:**
- Modify: `src/components/GuideEditor.tsx`

- [ ] **Step 7.1: Add import**

At the top of `src/components/GuideEditor.tsx`, after the existing component imports, add:

```ts
import CopyToFileModal from './CopyToFileModal'
import { buildSelectedGroups, type SelectedGroup } from '../annotation/groupUtils'
```

- [ ] **Step 7.2: Add selectedGroups memo**

After the `groups` memo (`const groups = useMemo(...)`, around line 182), add:

```ts
const selectedGroups = useMemo<SelectedGroup[]>(
  () => buildSelectedGroups(selectedKeys, nodes, groups),
  [selectedKeys, nodes, groups]
)
```

- [ ] **Step 7.3: Add onSuccess handler**

After the `handleAbortAnnotation` function (around line 462), add:

```ts
function handleCopySuccess(message: string) {
  setShowCopyModal(false)
  setSelectedKeys(new Set())
  setMsg(message)
}
```

- [ ] **Step 7.4: Render the modal**

At the bottom of the GuideEditor JSX, after the `{showCreateModal && <AnnotationCreateModal ... />}` block, add:

```tsx
{showCopyModal && (
  <CopyToFileModal
    currentFilePath={filePath}
    currentMapName={mapName}
    selectedGroups={selectedGroups}
    onClose={() => setShowCopyModal(false)}
    onSuccess={handleCopySuccess}
  />
)}
```

- [ ] **Step 7.5: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 7.6: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 7.7: Commit**

```bash
git add src/components/GuideEditor.tsx
git commit -m "feat: wire CopyToFileModal into GuideEditor — annotation selection and cross-file copy complete"
```

---

## Manual Verification Checklist

After all tasks are complete, run the app (`npm run dev`) and verify:

- [ ] Annotation rows show a checkbox on the left and an eye icon on the right
- [ ] Clicking the eye icon toggles visibility (Enabled/VisiblePfx) without selecting the annotation or opening the editor
- [ ] Checking a grenade group row selects the whole group; unchecking deselects it
- [ ] The bulk action bar appears when any annotation is selected, disappears when all are deselected
- [ ] "Select all" selects everything visible after active filters; "Deselect all" clears all
- [ ] "Delete selected" shows inline confirmation; Confirm removes nodes from state (not yet saved); Cancel dismisses
- [ ] After deletion, clicking Save persists the change to disk
- [ ] "Copy to file…" opens the modal
- [ ] The modal lists only local guides with the same MapName (not the current file, not workshop files)
- [ ] Files with >250 nodes show the amber warning
- [ ] The pre-flight summary shows correct counts for toAdd and skipped
- [ ] Copying to an existing file appends nodes, saves the target file, and shows a success message in the status strip
- [ ] Creating a new file via the modal creates the folder + txt file and shows a success message
- [ ] Copying a grenade set that already exists in the target shows it as "skipped"
- [ ] If all selected annotations are duplicates, the Copy button is disabled and shows "All duplicates"
- [ ] If the target file fails post-write validation (hard to trigger manually — the backup/restore path is covered by the logic in the handler)
