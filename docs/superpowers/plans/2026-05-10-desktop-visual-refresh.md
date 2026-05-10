# Desktop Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Electron desktop app to match the web app's design language (violet brand, Rajdhani/IBM Plex fonts, map color system) and add per-guide cloud sync status to both the guide list and a redesigned Cloud Panel.

**Architecture:** `mapColors.ts` moves to `packages/shared` so both apps share it. A new `GuideSyncState` type (also in shared) drives status dots in `Guides.tsx` and grouped sections in `CloudPanel.tsx`. A `useCloudStatus` hook in `apps/desktop` fetches all guide statuses in one batch IPC call and feeds both components via `App.tsx` props.

**Tech Stack:** React 18, Tailwind v4, electron-vite, Electron IPC, `electron-store`, `@fontsource/*`, `lucide-react`.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Move | `packages/shared/src/mapColors.ts` | Map accent colors, icons, labels |
| Create | `packages/shared/src/cloudStatus.ts` | `CloudSyncStatus` + `GuideSyncState` types |
| Modify | `packages/shared/src/index.ts` | Export new modules |
| Modify | `apps/web/src/lib/mapColors.ts` | Re-export from `@cs2ann/shared` |
| Copy | `apps/desktop/public/map-icons/*.png` | Static map icons for Vite |
| Modify | `apps/desktop/package.json` | Add `@fontsource/*` packages |
| Modify | `packages/ui/package.json` | Add `lucide-react` |
| Modify | `apps/desktop/src/main.tsx` | Import fontsource CSS |
| Modify | `apps/desktop/src/index.css` | CSS vars, brand tokens, font-family |
| Modify | `packages/ui/src/TopNav.tsx` | Brand text (Rajdhani + violet), Settings icon |
| Modify | `packages/ui/src/Guides.tsx` | Map borders, status dots, map chips, icon button |
| Create | `apps/desktop/src/hooks/useCloudStatus.ts` | Batch cloud status fetcher |
| Rewrite | `apps/desktop/src/components/CloudPanel.tsx` | Grouped sync overview with push/pull |
| Modify | `apps/desktop/electron/main/index.ts` | `cloudGetAllSyncStates` IPC + `lastPushed` tracking |
| Modify | `apps/desktop/electron/preload/index.ts` | Expose `cloudGetAllSyncStates` |
| Modify | `apps/desktop/src/App.tsx` | Wire `useCloudStatus`, pass props, wider sidebar |

---

## Task 1: Move mapColors to shared, create CloudSyncState type, install packages

**Files:**
- Create: `packages/shared/src/mapColors.ts`
- Create: `packages/shared/src/cloudStatus.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/web/src/lib/mapColors.ts`
- Modify: `apps/desktop/package.json` (pnpm install)
- Modify: `packages/ui/package.json` (pnpm install)

- [ ] **Step 1: Create `packages/shared/src/mapColors.ts`**

```typescript
export interface MapColor {
  accent: string
  dim: string
  label: string
  icon?: string
  hero?: string
}

const MAP_COLORS: Record<string, MapColor> = {
  de_mirage:   { accent: '#d97706', dim: 'rgba(217,119,6,0.12)',   label: 'Mirage',   icon: '/map-icons/mirage.png',   hero: '/maps/mirage.png' },
  de_inferno:  { accent: '#ea580c', dim: 'rgba(234,88,12,0.12)',   label: 'Inferno',  icon: '/map-icons/inferno.png',  hero: '/maps/inferno.png' },
  de_dust2:    { accent: '#ca8a04', dim: 'rgba(202,138,4,0.12)',   label: 'Dust 2',   icon: '/map-icons/dust2.png',    hero: '/maps/dust2.jpg' },
  de_ancient:  { accent: '#0d9488', dim: 'rgba(13,148,136,0.12)', label: 'Ancient',  icon: '/map-icons/ancient.png',  hero: '/maps/ancient.png' },
  de_anubis:   { accent: '#7c3aed', dim: 'rgba(124,58,237,0.12)', label: 'Anubis',   icon: '/map-icons/anubis.png' },
  de_nuke:     { accent: '#16a34a', dim: 'rgba(22,163,74,0.12)',  label: 'Nuke',     icon: '/map-icons/nuke.png' },
  de_overpass: { accent: '#2563eb', dim: 'rgba(37,99,235,0.12)',  label: 'Overpass', icon: '/map-icons/overpass.png', hero: '/maps/overpass.png' },
  de_train:    { accent: '#64748b', dim: 'rgba(100,116,139,0.12)',label: 'Train',    icon: '/map-icons/train.png' },
  de_cache:    { accent: '#65a30d', dim: 'rgba(101,163,13,0.12)', label: 'Cache',    icon: '/map-icons/cache.png' },
  de_vertigo:  { accent: '#0891b2', dim: 'rgba(8,145,178,0.12)',  label: 'Vertigo',  icon: '/map-icons/vertigo.png' },
}

const DEFAULT: MapColor = { accent: '#52525b', dim: 'rgba(82,82,91,0.12)', label: '' }

export function getMapColor(map: string | null | undefined): MapColor {
  if (!map) return DEFAULT
  const c = MAP_COLORS[map.toLowerCase()]
  if (c) return c
  return { ...DEFAULT, label: map.replace(/^de_/, '').replace(/_/g, ' ') }
}

export function getMapLabel(map: string | null | undefined): string {
  if (!map) return 'Unknown map'
  return MAP_COLORS[map.toLowerCase()]?.label ?? map.replace(/^de_/, '').replace(/_/g, ' ')
}

export const KNOWN_MAPS = Object.keys(MAP_COLORS)

export const HERO_MAPS = Object.values(MAP_COLORS)
  .filter((m) => m.hero)
  .map((m) => ({ src: m.hero!, label: m.label }))
```

- [ ] **Step 2: Create `packages/shared/src/cloudStatus.ts`**

```typescript
export type CloudSyncStatus =
  | 'synced'
  | 'local_ahead'
  | 'cloud_ahead'
  | 'not_in_cloud'
  | 'loading'

export interface GuideSyncState {
  status: CloudSyncStatus
  cloudId?: string
  cloudVersion?: number
}
```

- [ ] **Step 3: Update `packages/shared/src/index.ts` to export new modules**

Add these two lines at the top of the existing exports:

```typescript
export * from './mapColors'
export * from './cloudStatus'
```

- [ ] **Step 4: Update `apps/web/src/lib/mapColors.ts` to re-export from shared**

Replace the entire file content with:

```typescript
export {
  type MapColor,
  getMapColor,
  getMapLabel,
  KNOWN_MAPS,
  HERO_MAPS,
} from '@cs2ann/shared'
```

- [ ] **Step 5: Copy map icons from web public to desktop public**

```bash
mkdir -p apps/desktop/public/map-icons
cp apps/web/public/map-icons/*.png apps/desktop/public/map-icons/
```

On Windows PowerShell:
```powershell
New-Item -ItemType Directory -Force -Path apps\desktop\public\map-icons
Copy-Item apps\web\public\map-icons\*.png apps\desktop\public\map-icons\
```

- [ ] **Step 6: Install font packages in desktop**

```bash
pnpm --filter @cs2ann/desktop add @fontsource/rajdhani @fontsource/ibm-plex-sans
```

- [ ] **Step 7: Install lucide-react in packages/ui**

```bash
pnpm --filter @cs2ann/ui add lucide-react
```

- [ ] **Step 8: Verify build still works**

```bash
pnpm --filter @cs2ann/desktop build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/mapColors.ts packages/shared/src/cloudStatus.ts packages/shared/src/index.ts apps/web/src/lib/mapColors.ts apps/desktop/public/map-icons packages/ui/package.json apps/desktop/package.json
git commit -m "feat: move mapColors to shared, add GuideSyncState type, install font + icon packages"
```

---

## Task 2: Fonts + CSS design tokens

**Files:**
- Modify: `apps/desktop/src/main.tsx`
- Modify: `apps/desktop/src/index.css`

- [ ] **Step 1: Add font imports to `apps/desktop/src/main.tsx`**

Read the current file then prepend these imports before the existing imports:

```typescript
import '@fontsource/rajdhani/400.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
```

- [ ] **Step 2: Replace `apps/desktop/src/index.css` with updated tokens**

```css
@import "tailwindcss";

@theme {
  --font-display: 'Rajdhani', system-ui, sans-serif;
  --font-body: 'IBM Plex Sans', system-ui, sans-serif;
  --color-brand: #8b5cf6;
  --color-brand-hover: #7c3aed;
  --color-brand-dim: rgba(139, 92, 246, 0.12);
}

@layer base {
  *, *::before, *::after { box-sizing: border-box; }

  html, body {
    height: 100%;
    overflow: hidden;
  }

  body {
    margin: 0;
    background-color: #09090f;
    color: #e4e4e7;
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
  }

  #root {
    height: 100%;
    overflow: hidden;
  }

  input, select, button, textarea {
    font-family: inherit;
  }

  input[type='text'],
  input[type='number'],
  select {
    background-color: #09090b;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    color: #e4e4e7;
    padding: 0.4rem 0.6rem;
    font-size: 0.875rem;
    width: 100%;
    max-width: 400px;
  }

  input[type='text']:focus,
  input[type='number']:focus,
  select:focus {
    outline: none;
    border-color: #71717a;
  }
}
```

- [ ] **Step 3: Start dev server and verify fonts load**

```bash
pnpm --filter @cs2ann/desktop dev
```

Open the app. The text should render in IBM Plex Sans (body) instead of the system font. If fonts aren't loading, check the browser DevTools network tab for 404s on font files.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main.tsx apps/desktop/src/index.css
git commit -m "feat(desktop): add Rajdhani + IBM Plex Sans fonts and CSS brand tokens"
```

---

## Task 3: Restyle TopNav

**Files:**
- Modify: `packages/ui/src/TopNav.tsx`

- [ ] **Step 1: Replace `packages/ui/src/TopNav.tsx`**

```typescript
import type { ReactNode } from 'react'
import { Settings } from 'lucide-react'

interface TopNavProps {
  onOpenSettings: () => void
  authSlot?: ReactNode
  onToggleSidebar?: () => void
  sidebarOpen?: boolean
  syncDotColor?: string
  syncStatusText?: string
}

export default function TopNav({ onOpenSettings, authSlot, onToggleSidebar, sidebarOpen, syncDotColor, syncStatusText }: TopNavProps) {
  return (
    <div className="flex items-center justify-between px-4 shrink-0 h-10 bg-zinc-950 border-b border-zinc-800">
      <span
        className="text-base font-bold tracking-wide select-none"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        <span className="text-white">CS2</span>
        <span style={{ color: 'var(--color-brand)' }}> Annotations</span>
      </span>

      <div className="flex items-center gap-1">
        {authSlot && <div className="mr-2">{authSlot}</div>}
        {onToggleSidebar && (
          <div className="relative group">
            <button
              type="button"
              onClick={onToggleSidebar}
              className={`relative p-1.5 rounded transition-colors text-base leading-none ${
                sidebarOpen ? 'text-zinc-200 bg-zinc-700/80' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58q0-1.95 1.17-3.48 1.18-1.53 3.08-1.95.51-2.24 2.3-3.7Q9.34 4 11.5 4q2.55 0 4.28 1.73Q17.5 7.45 17.5 10q1.75.2 2.87 1.47Q21.5 12.75 21.5 14.5q0 1.87-1.31 3.18Q18.87 19 17 19H13v-6.15l1.6 1.55L16 13l-3.5-3.5L9 13l1.4 1.4 1.6-1.55V19H6.5Z"/>
              </svg>
              {syncDotColor && (
                <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-950 ${syncDotColor}`} />
              )}
            </button>
            <div className="absolute right-0 top-full mt-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {syncStatusText ? `Cloud: ${syncStatusText}` : sidebarOpen ? 'Hide cloud panel' : 'Show cloud panel'}
            </div>
          </div>
        )}
        <button
          type="button"
          className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
          title="Settings"
          onClick={onOpenSettings}
        >
          <Settings size={15} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in dev server**

The TopNav should show "CS2" in white and "Annotations" in violet, both in Rajdhani bold. The gear is now a crisp Lucide icon.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/TopNav.tsx
git commit -m "feat(ui): restyle TopNav with Rajdhani brand text and violet accent"
```

---

## Task 4: Cloud status IPC — batch sync states + lastPushed tracking

**Files:**
- Modify: `apps/desktop/electron/main/index.ts`
- Modify: `apps/desktop/electron/preload/index.ts`

- [ ] **Step 1: Add `lastPushed` timestamp to `cloudPushGuide` handler in `apps/desktop/electron/main/index.ts`**

In the `createGuide` inner function (around line 708), after `store.set(\`cloudVersion:${payload.filePath}\`, guide.version)`, add:
```typescript
store.set(`lastPushed:${payload.filePath}`, Date.now())
```

In the PUT branch (around line 736), after `store.set(\`cloudVersion:${payload.filePath}\`, guide.version)`, add:
```typescript
store.set(`lastPushed:${payload.filePath}`, Date.now())
```

- [ ] **Step 2: Add `cloudGetAllSyncStates` handler to `apps/desktop/electron/main/index.ts`**

Add this block after the existing `cloudGetSyncState` handler (around line 780):

```typescript
ipcMain.handle('cloudGetAllSyncStates', async (_event, filePaths: string[]) => {
  const token = store.get('authToken', null) as string | null
  if (!token) return { states: {} }
  try {
    const res = await fetch(`${WEB_API}/guides`, { headers: cloudHeaders() })
    if (!res.ok) return { states: {} }
    const { guides } = await res.json() as { guides: Array<{ id: string; version: number }> }
    const cloudById = new Map(guides.map((g: { id: string; version: number }) => [g.id, g]))
    const states: Record<string, { status: string; cloudId?: string; cloudVersion?: number }> = {}
    for (const filePath of filePaths) {
      const cloudId = store.get(`cloudId:${filePath}`, null) as string | null
      const localVersion = store.get(`cloudVersion:${filePath}`, 0) as number
      const lastPushed = store.get(`lastPushed:${filePath}`, 0) as number
      if (!cloudId) {
        states[filePath] = { status: 'not_in_cloud' }
        continue
      }
      const cloudGuide = cloudById.get(cloudId)
      if (!cloudGuide) {
        states[filePath] = { status: 'not_in_cloud' }
        continue
      }
      if (cloudGuide.version > localVersion) {
        states[filePath] = { status: 'cloud_ahead', cloudId, cloudVersion: cloudGuide.version }
        continue
      }
      try {
        const stat = fs.statSync(filePath)
        const status = (lastPushed > 0 && stat.mtimeMs > lastPushed) ? 'local_ahead' : 'synced'
        states[filePath] = { status, cloudId, cloudVersion: cloudGuide.version }
      } catch {
        states[filePath] = { status: 'synced', cloudId, cloudVersion: cloudGuide.version }
      }
    }
    return { states }
  } catch (err) {
    return { states: {}, error: err instanceof Error ? err.message : String(err) }
  }
})
```

- [ ] **Step 3: Expose `cloudGetAllSyncStates` in `apps/desktop/electron/preload/index.ts`**

Add this line after the existing `cloudGetSyncState` line (around line 58):

```typescript
cloudGetAllSyncStates: (filePaths: string[]) => ipcRenderer.invoke('cloudGetAllSyncStates', filePaths),
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm --filter @cs2ann/desktop build
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/electron/main/index.ts apps/desktop/electron/preload/index.ts
git commit -m "feat(desktop): add cloudGetAllSyncStates IPC and lastPushed timestamp tracking"
```

---

## Task 5: useCloudStatus hook

**Files:**
- Create: `apps/desktop/src/hooks/useCloudStatus.ts`

- [ ] **Step 1: Create `apps/desktop/src/hooks/useCloudStatus.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { GuideSummary } from '@cs2ann/shared'
import type { GuideSyncState } from '@cs2ann/shared'

export interface CloudStatusResult {
  guides: GuideSummary[]
  statuses: Record<string, GuideSyncState>
  loading: boolean
  refresh: () => void
}

export function useCloudStatus(): CloudStatusResult {
  const [guides, setGuides] = useState<GuideSummary[]>([])
  const [statuses, setStatuses] = useState<Record<string, GuideSyncState>>({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const authState = await window.electronAPI.getAuthState()
    if (!authState?.token) {
      setStatuses({})
      return
    }

    setLoading(true)
    try {
      const list = await window.electronAPI.listGuides()
      const allGuides = list as GuideSummary[]
      setGuides(allGuides)

      const localGuides = allGuides.filter((g) => g.source === 'local')
      const filePaths = localGuides.map((g) => g.id)

      if (filePaths.length === 0) {
        setStatuses({})
        return
      }

      const result = await window.electronAPI.cloudGetAllSyncStates(filePaths)
      const raw = (result as { states: Record<string, { status: string; cloudId?: string; cloudVersion?: number }> }).states

      const resolved: Record<string, GuideSyncState> = {}
      for (const [filePath, state] of Object.entries(raw)) {
        resolved[filePath] = {
          status: state.status as GuideSyncState['status'],
          cloudId: state.cloudId,
          cloudVersion: state.cloudVersion,
        }
      }
      setStatuses(resolved)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const unsub = window.electronAPI.onAuthStateChanged(() => void refresh())
    return unsub
  }, [refresh])

  return { guides, statuses, loading, refresh }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter @cs2ann/desktop build
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/hooks/useCloudStatus.ts
git commit -m "feat(desktop): add useCloudStatus hook for batch guide sync state"
```

---

## Task 6: Update Guides.tsx — map colors, status dots, icon button

**Files:**
- Modify: `packages/ui/src/Guides.tsx`

- [ ] **Step 1: Replace `packages/ui/src/Guides.tsx`**

```typescript
import { useState, useEffect } from 'react'
import { FolderInput } from 'lucide-react'
import type { AnnotationNode } from '@cs2ann/shared'
import { getMapColor } from '@cs2ann/shared'
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

export default function Guides({ onGuideChange, cloudStatuses = {} }: GuidesProps = {}) {
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

  function loadGuideCommand(name: string, e: React.MouseEvent) {
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

  const featured = guides.filter((g) => g.source === 'workshop' && g.workshopId && FEATURED_IDS.has(g.workshopId))
  const yours = guides.filter((g) => !(g.source === 'workshop' && g.workshopId && FEATURED_IDS.has(g.workshopId)))

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
            className="px-4 py-2 rounded text-white text-sm cursor-pointer disabled:opacity-60 transition-colors"
            style={{ backgroundColor: 'var(--color-brand)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-brand-hover)')}
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
        <ul className="list-none m-0 p-0 space-y-1">
          {featured.map((g) => {
            const { accent, dim } = getMapColor(g.mapName)
            return (
              <li key={g.workshopId}>
                {g.installed ? (
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 min-w-0 px-3 py-2.5 text-left bg-zinc-800/60 hover:bg-zinc-800 rounded text-zinc-200 cursor-pointer text-[0.9rem] transition-colors border-l-[3px]"
                    style={{ borderLeftColor: accent, backgroundColor: dim }}
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
      {yours.length > 0 && (
        <div className="mt-4">
          <p
            className="m-0 mb-2 text-[0.7rem] text-zinc-500 uppercase tracking-wider font-semibold"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Your guides
          </p>
          <ul className="list-none m-0 p-0 space-y-1">
            {yours.map((g) => {
              const { accent, dim } = getMapColor(g.mapName)
              const syncState = g.source === 'local' ? cloudStatuses[g.path] : undefined
              return (
                <li key={g.path} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="flex-1 flex items-center gap-2.5 min-w-0 px-3 py-2.5 text-left rounded text-zinc-200 cursor-pointer text-[0.9rem] transition-colors border-l-[3px]"
                    style={{ borderLeftColor: accent, backgroundColor: dim }}
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
```

- [ ] **Step 2: Verify in dev server**

Open the app. The guide list should show:
- Colored left border on each row matching the map (inferno = orange, overpass = blue, etc.)
- A map chip on the right (icon + label like "INFERNO")
- A small status dot left of the guide name (zinc/gray until cloud status loads)
- The load button is now an icon-only button (folder with arrow in)

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/Guides.tsx
git commit -m "feat(ui): add map-colored rows, status dots, map chips, and icon load button to Guides"
```

---

## Task 7: Rewrite CloudPanel as grouped sync overview

**Files:**
- Rewrite: `apps/desktop/src/components/CloudPanel.tsx`

- [ ] **Step 1: Replace `apps/desktop/src/components/CloudPanel.tsx`**

```typescript
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
      <div className="p-4 flex flex-col gap-2">
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

  function GuideRow({ guide, action }: { guide: GuideSummary; action: React.ReactNode }) {
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

  return (
    <div className="flex flex-col gap-1 py-2">
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
            <GuideRow key={g.id} guide={g} action={null} />
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
```

- [ ] **Step 2: Verify in dev server**

Sign in to the app. The right panel should show guides grouped by sync status. BEHIND and NOT PUSHED sections have per-guide Pull/Push buttons. SYNCED section is collapsed by default with a toggle.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/CloudPanel.tsx
git commit -m "feat(desktop): rewrite CloudPanel as grouped cloud sync overview"
```

---

## Task 8: Wire App.tsx — useCloudStatus + wider sidebar

**Files:**
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Replace `apps/desktop/src/App.tsx`**

```typescript
import { useState } from 'react'
import { GuideAdapterProvider, Guides, Settings, TopNav } from '@cs2ann/ui'
import { createLocalAdapter } from './adapters/LocalAdapter'
import AuthButton from './components/AuthButton'
import CloudPanel from './components/CloudPanel'
import { useCloudStatus } from './hooks/useCloudStatus'

const adapter = createLocalAdapter()

function AppInner() {
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [syncDotColor, setSyncDotColor] = useState('')
  const [syncStatusText, setSyncStatusText] = useState('')

  const cloudStatus = useCloudStatus()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <TopNav
        onOpenSettings={() => setShowSettings(true)}
        authSlot={<AuthButton />}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        syncDotColor={syncDotColor}
        syncStatusText={syncStatusText}
      />
      <main className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-4">
          <Guides
            cloudStatuses={cloudStatus.statuses}
          />
        </div>

        {sidebarOpen && (
          <div className="w-72 shrink-0 border-l border-zinc-800 flex flex-col overflow-y-auto">
            <CloudPanel
              guides={cloudStatus.guides}
              statuses={cloudStatus.statuses}
              loading={cloudStatus.loading}
              onRefresh={cloudStatus.refresh}
              onStatusChange={(color, text) => { setSyncDotColor(color); setSyncStatusText(text) }}
            />
            <div className="mt-auto p-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => void window.electronAPI.openCommunity()}
                className="w-full text-xs px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors text-left"
              >
                Browse community →
              </button>
            </div>
          </div>
        )}
      </main>

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false) }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60 shrink-0">
              <h2
                className="text-base font-bold text-zinc-100 m-0"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Settings
              </h2>
              <button
                type="button"
                className="text-zinc-500 hover:text-zinc-200 text-lg leading-none"
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-4 overflow-y-auto">
              <Settings />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <GuideAdapterProvider adapter={adapter}>
      <AppInner />
    </GuideAdapterProvider>
  )
}
```

Note: `useCloudStatus` uses `window.electronAPI` which requires being inside the renderer. It does not use `useGuideAdapter`, so it's safe to call outside of `GuideAdapterProvider`. However, `AppInner` is inside the provider for `Guides` to work correctly. The hook is placed inside `AppInner` which renders inside the provider — this is correct.

- [ ] **Step 2: Verify the full flow in dev server**

1. Open the app — guide list should show colored rows with map chips and status dots
2. The right panel should show cloud sync groups (or sign-in prompt if not authenticated)
3. The TopNav sync dot should reflect overall sync status
4. Sign in — the cloud status should load and dots update
5. Click the refresh button in the cloud panel — status re-fetches

- [ ] **Step 3: Verify build**

```bash
pnpm --filter @cs2ann/desktop build
```

Expected: Builds successfully with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/App.tsx
git commit -m "feat(desktop): wire useCloudStatus into App, pass cloudStatuses to Guides and CloudPanel"
```

---

## Self-Review Notes

### Spec coverage check
- ✅ Fonts (Rajdhani + IBM Plex Sans) — Task 2
- ✅ Violet brand color — Task 2 (CSS var) + Task 6 (New guide button)
- ✅ TopNav brand restyle — Task 3
- ✅ Guide list map border + dim background — Task 6
- ✅ Status dot left of title — Task 6 (`StatusDot` component)
- ✅ Map icon + label chip — Task 6 (`MapChip` component)
- ✅ Icon-only load button with tooltip — Task 6 (`FolderInput` + `title`)
- ✅ Featured guides map styling (no status dot) — Task 6
- ✅ Cloud status per guide (synced/behind/local_ahead/not_in_cloud) — Tasks 4 + 5
- ✅ CloudPanel grouped sections — Task 7
- ✅ Per-guide push/pull — Task 7
- ✅ Push all / Pull all — Task 7
- ✅ Synced section collapsed by default — Task 7
- ✅ mapColors moved to shared — Task 1
- ✅ Map icons copied to desktop — Task 1

### Known limitation
"local_ahead" detection relies on comparing file `mtime` against the last push timestamp (`lastPushed:${filePath}` in electron-store). For guides pushed before this feature is deployed, `lastPushed` will be 0, causing them to show as `synced` rather than `local_ahead` until their next push. This resolves naturally after the first push with the new code.
