# Phase 2 — Shared UI Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple `GuideEditor`, `MapOverlay`, and all sub-components from Electron IPC so the same React components can render in a browser, while the desktop app continues to work identically.

**Architecture:** A `GuideAdapter` interface defined in `packages/shared/` abstracts all guide persistence operations. A `LocalAdapter` in `apps/desktop/` implements it by delegating to `window.electronAPI`. All components in `packages/ui/` receive the adapter (and optional platform callbacks) as props. `GuideEditor` and related components are moved from `apps/desktop/src/components/` to `packages/ui/src/`. The desktop app's root component passes a `LocalAdapter` instance down the component tree via React context. No business logic changes — only wiring.

**Tech Stack:** React 18, TypeScript, pnpm workspaces. Requires Phase 1 complete (monorepo in place).

---

## File Map

**Created:**
- `packages/shared/src/adapter.ts` — `GuideAdapter` interface + related types
- `packages/ui/src/GuideAdapterContext.tsx` — React context holding the adapter
- `packages/ui/src/index.ts` — barrel export
- `apps/desktop/src/adapters/LocalAdapter.ts` — Electron IPC implementation of `GuideAdapter`

**Moved into `packages/ui/src/`:**
- `apps/desktop/src/components/GuideEditor.tsx`
- `apps/desktop/src/components/MapOverlay.tsx`
- `apps/desktop/src/components/NodeMapView.tsx`
- `apps/desktop/src/components/AnnotationCreateModal.tsx`
- `apps/desktop/src/components/CopyToFileModal.tsx`
- `apps/desktop/src/components/Guides.tsx`
- `apps/desktop/src/components/Settings.tsx`
- `apps/desktop/src/components/TopNav.tsx`

**Modified:**
- `packages/shared/src/index.ts` — add `GuideAdapter` export
- `packages/ui/package.json` — add React peer deps and `@cs2ann/shared` dep
- `apps/desktop/src/App.tsx` — wrap app in `GuideAdapterContext.Provider` with `LocalAdapter`
- `apps/desktop/package.json` — add `@cs2ann/ui` workspace dep

---

## Task 1: Define the `GuideAdapter` interface

**Files:**
- Create: `packages/shared/src/adapter.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/adapter.ts`**

This interface covers every operation the UI components need. Platform-specific capabilities (CS2 commands, file watching) are optional so the browser adapter can omit them.

```ts
import type { AnnotationNode } from './annotation/types'

export interface GuideSummary {
  id: string          // file path for local, uuid for cloud
  name: string
  mapName?: string
  source: 'local' | 'workshop' | 'cloud'
  installed?: boolean
  workshopId?: string
}

export interface LoadedGuide {
  nodes: AnnotationNode[]
  nodesKey: string
  root: Record<string, unknown>
}

export interface SaveGuidePayload {
  id: string
  root: Record<string, unknown>
  nodes: AnnotationNode[]
  nodesKey: string
  createBackup?: boolean
}

export interface AppendNodesPayload {
  targetId: string
  nodes: AnnotationNode[]
}

export interface CreateGuidePayload {
  filename: string
  mapName?: string
  nodes?: AnnotationNode[]
  nodesKey?: string
  root?: Record<string, unknown>
}

export interface GuideAdapter {
  listGuides(): Promise<GuideSummary[]>
  createGuide(payload: CreateGuidePayload): Promise<{ error?: string; id?: string; loadName?: string }>
  loadGuide(id: string): Promise<LoadedGuide | { error: string }>
  saveGuide(payload: SaveGuidePayload): Promise<{ error?: string }>
  saveAsLocal(payload: { root: Record<string, unknown>; nodes: AnnotationNode[]; nodesKey: string; localName: string }): Promise<{ error?: string; id?: string; loadName?: string }>
  deleteGuide(id: string): Promise<{ error?: string }>
  appendNodes(payload: AppendNodesPayload): Promise<{ error?: string; finalNodeCount?: number }>

  // Optional — only Electron desktop provides these
  cs2?: {
    writeCommand(command: string): Promise<{ error?: string; cfgPath?: string }>
    sendConsoleCommand?(command: string): Promise<{ error?: string }>
    watchFile(filePath: string): void
    unwatchFile(): void
    onFileChanged(callback: (filePath: string) => void): () => void
  }

  // Optional — only desktop provides clipboard
  clipboard?: {
    write(text: string): Promise<{ error?: string }>
    showInFolder?(path: string): Promise<void>
  }
}
```

- [ ] **Step 2: Export from `packages/shared/src/index.ts`**

Add to the bottom of the existing barrel:

```ts
export type {
  GuideAdapter,
  GuideSummary,
  LoadedGuide,
  SaveGuidePayload,
  AppendNodesPayload,
  CreateGuidePayload
} from './adapter'
```

- [ ] **Step 3: Verify packages/shared builds cleanly**

```bash
pnpm --filter @cs2ann/shared test
```

Expected: tests pass, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/adapter.ts packages/shared/src/index.ts
git commit -m "feat: define GuideAdapter interface in packages/shared"
```

---

## Task 2: Create `GuideAdapterContext` in `packages/ui`

**Files:**
- Modify: `packages/ui/package.json`
- Create: `packages/ui/src/GuideAdapterContext.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Update `packages/ui/package.json` with React deps**

```json
{
  "name": "@cs2ann/ui",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "peerDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "dependencies": {
    "@cs2ann/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^18.2.45",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: Create `packages/ui/src/GuideAdapterContext.tsx`**

```tsx
import { createContext, useContext } from 'react'
import type { GuideAdapter } from '@cs2ann/shared'

const GuideAdapterContext = createContext<GuideAdapter | null>(null)

export function GuideAdapterProvider({
  adapter,
  children
}: {
  adapter: GuideAdapter
  children: React.ReactNode
}) {
  return (
    <GuideAdapterContext.Provider value={adapter}>
      {children}
    </GuideAdapterContext.Provider>
  )
}

export function useGuideAdapter(): GuideAdapter {
  const ctx = useContext(GuideAdapterContext)
  if (!ctx) throw new Error('useGuideAdapter must be used within GuideAdapterProvider')
  return ctx
}
```

- [ ] **Step 3: Update `packages/ui/src/index.ts`**

```ts
export { GuideAdapterProvider, useGuideAdapter } from './GuideAdapterContext'
```

- [ ] **Step 4: Re-install workspace deps**

```bash
pnpm install
```

- [ ] **Step 5: Commit**

```bash
git add packages/ui/
git commit -m "feat: add GuideAdapterContext to packages/ui"
```

---

## Task 3: Implement `LocalAdapter` in `apps/desktop`

**Files:**
- Create: `apps/desktop/src/adapters/LocalAdapter.ts`

- [ ] **Step 1: Write `apps/desktop/src/adapters/LocalAdapter.ts`**

This wraps every `window.electronAPI.*` call behind the `GuideAdapter` interface.

```ts
import type {
  GuideAdapter,
  GuideSummary,
  LoadedGuide,
  SaveGuidePayload,
  AppendNodesPayload,
  CreateGuidePayload
} from '@cs2ann/shared'

export function createLocalAdapter(): GuideAdapter {
  return {
    async listGuides(): Promise<GuideSummary[]> {
      const raw = await window.electronAPI.listGuides()
      return raw.map(g => ({
        id: g.path,
        name: g.name,
        mapName: g.mapName,
        source: g.source,
        installed: g.installed,
        workshopId: g.workshopId
      }))
    },

    async createGuide(payload: CreateGuidePayload) {
      if (payload.nodes && payload.nodesKey && payload.root) {
        const result = await window.electronAPI.createGuideWithNodes({
          filename: payload.filename,
          mapName: payload.mapName ?? '',
          nodes: payload.nodes
        })
        return { error: result.error, id: result.filePath, loadName: result.loadName }
      }
      const result = await window.electronAPI.createGuide(payload.filename, payload.mapName)
      return { error: result.error, loadName: result.loadName }
    },

    async loadGuide(id: string): Promise<LoadedGuide | { error: string }> {
      return window.electronAPI.loadGuide(id)
    },

    async saveGuide(payload: SaveGuidePayload) {
      return window.electronAPI.saveGuide({
        filePath: payload.id,
        root: payload.root,
        nodes: payload.nodes,
        nodesKey: payload.nodesKey,
        createBackup: payload.createBackup
      })
    },

    async saveAsLocal(payload) {
      const result = await window.electronAPI.saveAsLocalGuide(payload)
      return { error: result.error, id: result.path, loadName: result.loadName }
    },

    async deleteGuide(id: string) {
      return window.electronAPI.deleteGuide(id)
    },

    async appendNodes(payload: AppendNodesPayload) {
      return window.electronAPI.appendNodesToGuide({
        targetFilePath: payload.targetId,
        nodes: payload.nodes
      })
    },

    cs2: {
      async writeCommand(command: string) {
        return window.electronAPI.writeCS2Cfg(command)
      },
      async sendConsoleCommand(command: string) {
        return window.electronAPI.sendCS2ConsoleCommand(command)
      },
      watchFile(filePath: string) {
        window.electronAPI.watchGuideFile(filePath)
      },
      unwatchFile() {
        window.electronAPI.unwatchGuideFile()
      },
      onFileChanged(callback: (filePath: string) => void) {
        return window.electronAPI.onGuideFileChanged(callback)
      }
    },

    clipboard: {
      async write(text: string) {
        return window.electronAPI.copyToClipboard(text)
      },
      async showInFolder(path: string) {
        return window.electronAPI.showItemInFolder(path)
      }
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter @cs2ann/desktop build
```

Expected: no errors. Fix any type mismatches between the `ElectronAPI` type in `vite-env.d.ts` and the adapter.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/adapters/
git commit -m "feat: implement LocalAdapter wrapping Electron IPC"
```

---

## Task 4: Move components to `packages/ui/` and replace direct IPC calls

**Files:**
- Move: all `apps/desktop/src/components/*.tsx` → `packages/ui/src/`
- Modify: each moved component — replace `window.electronAPI.*` with `useGuideAdapter()`

- [ ] **Step 1: Move all component files**

```bash
mv apps/desktop/src/components/GuideEditor.tsx packages/ui/src/
mv apps/desktop/src/components/MapOverlay.tsx packages/ui/src/
mv apps/desktop/src/components/NodeMapView.tsx packages/ui/src/
mv apps/desktop/src/components/AnnotationCreateModal.tsx packages/ui/src/
mv apps/desktop/src/components/CopyToFileModal.tsx packages/ui/src/
mv apps/desktop/src/components/Guides.tsx packages/ui/src/
mv apps/desktop/src/components/Settings.tsx packages/ui/src/
mv apps/desktop/src/components/TopNav.tsx packages/ui/src/
```

- [ ] **Step 2: Update cross-component imports inside the moved files**

After moving, any `import ... from './MapOverlay'` or `'./GuideEditor'` etc. inside the components remain correct (same directory). Any `import ... from '../annotation/...'` must become `import ... from '@cs2ann/shared'`. Run:

```bash
grep -rn "from '\.\./annotation\|from '\.\./kv3" packages/ui/src/
```

Replace each match with the `@cs2ann/shared` equivalent.

- [ ] **Step 3: Replace all `window.electronAPI.*` calls in the moved components**

Run:

```bash
grep -rn "window\.electronAPI\." packages/ui/src/
```

For each file that calls `window.electronAPI`:

1. Add `import { useGuideAdapter } from './GuideAdapterContext'` at the top
2. Inside the component function, add `const adapter = useGuideAdapter()`
3. Replace each call:

| Old | New |
| --- | --- |
| `window.electronAPI.listGuides()` | `adapter.listGuides()` |
| `window.electronAPI.loadGuide(path)` | `adapter.loadGuide(path)` |
| `window.electronAPI.saveGuide(payload)` | `adapter.saveGuide({...payload, id: payload.filePath})` |
| `window.electronAPI.createGuide(name, map)` | `adapter.createGuide({filename: name, mapName: map})` |
| `window.electronAPI.deleteGuide(path)` | `adapter.deleteGuide(path)` |
| `window.electronAPI.appendNodesToGuide(p)` | `adapter.appendNodes({targetId: p.targetFilePath, nodes: p.nodes})` |
| `window.electronAPI.writeCS2Cfg(cmd)` | `adapter.cs2?.writeCommand(cmd)` |
| `window.electronAPI.sendCS2ConsoleCommand(cmd)` | `adapter.cs2?.sendConsoleCommand?.(cmd)` |
| `window.electronAPI.watchGuideFile(path)` | `adapter.cs2?.watchFile(path)` |
| `window.electronAPI.unwatchGuideFile()` | `adapter.cs2?.unwatchFile()` |
| `window.electronAPI.onGuideFileChanged(cb)` | `adapter.cs2?.onFileChanged(cb)` |
| `window.electronAPI.copyToClipboard(text)` | `adapter.clipboard?.write(text)` |
| `window.electronAPI.showItemInFolder(path)` | `adapter.clipboard?.showInFolder?.(path)` |
| `window.electronAPI.saveAsLocalGuide(p)` | `adapter.saveAsLocal(p)` |

Note: `cs2` and `clipboard` are optional on `GuideAdapter`. In components, guard with optional chaining (`adapter.cs2?.writeCommand(...)`) — these features simply become no-ops in the browser.

- [ ] **Step 4: Update `packages/ui/src/index.ts` to export all components**

```ts
export { GuideAdapterProvider, useGuideAdapter } from './GuideAdapterContext'
export { default as GuideEditor } from './GuideEditor'
export { default as MapOverlay } from './MapOverlay'
export { default as Guides } from './Guides'
export { default as Settings } from './Settings'
export { default as TopNav } from './TopNav'
export { default as NodeMapView } from './NodeMapView'
export { default as AnnotationCreateModal } from './AnnotationCreateModal'
export { default as CopyToFileModal } from './CopyToFileModal'
```

Adjust export style (`default` vs named) to match what each component actually uses.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/ apps/desktop/src/components/
git commit -m "refactor: move all UI components to packages/ui, replace electronAPI with adapter"
```

---

## Task 5: Wire `LocalAdapter` into the desktop app root

**Files:**
- Modify: `apps/desktop/src/App.tsx` (or `apps/desktop/src/main.tsx`)
- Modify: `apps/desktop/package.json` — add `@cs2ann/ui` dep

- [ ] **Step 1: Add `@cs2ann/ui` to `apps/desktop/package.json`**

```json
"dependencies": {
  "@cs2ann/shared": "workspace:*",
  "@cs2ann/ui": "workspace:*",
  ...
}
```

Run `pnpm install` to link it.

- [ ] **Step 2: Update `apps/desktop/src/App.tsx` (or `main.tsx`) to wrap in `GuideAdapterProvider`**

Find the root component (likely `App.tsx` or `main.tsx`). Add:

```tsx
import { createLocalAdapter } from './adapters/LocalAdapter'
import { GuideAdapterProvider } from '@cs2ann/ui'

const adapter = createLocalAdapter()

export default function App() {
  return (
    <GuideAdapterProvider adapter={adapter}>
      {/* existing app tree — Guides, TopNav, etc. */}
    </GuideAdapterProvider>
  )
}
```

- [ ] **Step 3: Update component imports in App.tsx to come from `@cs2ann/ui`**

```tsx
import { Guides, TopNav, Settings } from '@cs2ann/ui'
```

Remove any remaining imports from the old `./components/` path.

- [ ] **Step 4: Run dev and verify the desktop app is fully functional**

```bash
pnpm dev
```

Test every feature:
- Guide list loads
- Open a guide → nodes appear
- Edit a node → save works
- CS2 load/save commands work
- Copy-to-file works
- Map overlay renders

- [ ] **Step 5: Run the full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Build to verify no TypeScript errors**

```bash
pnpm --filter @cs2ann/desktop build
```

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/ apps/desktop/package.json
git commit -m "feat: wire LocalAdapter into desktop app root via GuideAdapterProvider"
```

---

## Task 6: Verify `packages/ui` is browser-safe

- [ ] **Step 1: Grep for any remaining `window.electronAPI` references in `packages/ui/`**

```bash
grep -rn "window\.electronAPI\|ipcRenderer\|electron" packages/ui/src/
```

Expected: zero results. If any remain, replace them using the same pattern from Task 4 Step 3.

- [ ] **Step 2: Grep for any Node.js-only imports**

```bash
grep -rn "from 'fs'\|from 'path'\|from 'electron'" packages/ui/src/
```

Expected: zero results.

- [ ] **Step 3: Commit final cleanup**

```bash
git add packages/ui/
git commit -m "chore: verify packages/ui contains no electron or node dependencies"
```
