# Onboarding & UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four independent UX improvements: workshop guide registry with install-state detection, persistent top nav with Settings modal, line annotation guardrails with a label field, and two small fixes.

**Architecture:** All changes are confined to the existing Electron + React codebase — no new dependencies. The main process (`electron/main/index.ts`) gains the registry and rewritten detection logic; a new thin React component (`TopNav.tsx`) replaces the old tab nav; `AnnotationCreateModal.tsx` and `GuideEditor.tsx` get line-specific state and metadata patching.

**Tech Stack:** Electron, React 18, TypeScript, Tailwind CSS v4, electron-vite. No test runner is configured — verification is done via `npm run build` (TypeScript compile) and manual visual inspection in the running app.

---

## File Map

| File | What changes |
|------|-------------|
| `electron/main/index.ts` | Add `FEATURED_GUIDES`, helper functions `fileIsAnnotation` + `readMapName`, rewrite `listGuides` handler, delete `folderContainsOnlyTxtFiles` |
| `electron/preload/index.ts` | Update `listGuides` return type comment |
| `src/vite-env.d.ts` | Update `ElectronAPI.listGuides` return type |
| `src/components/Guides.tsx` | Update `GuideItem` type; render Featured + Your guides sections with Subscribe buttons |
| `src/App.tsx` | Replace `page` state with `showSettings` bool; add `TopNav`; render Settings as centered modal |
| `src/components/TopNav.tsx` | **New** — thin bar with app name + ⚙ button |
| `src/components/AnnotationCreateModal.tsx` | Add `lineLabel` to `CreateMeta`; add `lineStarted`/`pointsPlaced` state; rewrite line section UI; remove both backdrop `onClick` dismiss handlers |
| `src/components/GuideEditor.tsx` | Remove "Reload in CS2" button; add `lineLabel` patch in metadata patch block |

---

## Task 1: Workshop Guide Registry & Detection

**Files:**
- Modify: `electron/main/index.ts`
- Modify: `electron/preload/index.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `src/components/Guides.tsx`

- [ ] **Step 1: Add FEATURED_GUIDES registry and helper functions to `electron/main/index.ts`**

  Add these constants and helpers immediately before the `ipcMain.handle('listGuides', ...)` block (around line 197). The `folderContainsOnlyTxtFiles` function (lines 77–87) will be removed in Step 3.

  ```ts
  const KV3_HEADER_PREFIX = '<!-- kv3 encoding:text:version{'

  const FEATURED_GUIDES: { id: string; name: string }[] = [
    { id: '3387810001', name: 'inferno_essential' },
    { id: '3387870747', name: 'ancient_essential' },
    { id: '3388581972', name: 'anubis_essential' },
    { id: '3388611848', name: 'overpass_essential' },
    { id: '3388638091', name: 'nuke_essential' },
    { id: '3388681214', name: 'dust2_essential' },
    { id: '3388737112', name: 'mirage_essential' },
    { id: '3388761697', name: 'vertigo_essential' },
  ]

  function fileIsAnnotation(filePath: string): boolean {
    try {
      const fd = fs.openSync(filePath, 'r')
      const buf = Buffer.alloc(256)
      const bytesRead = fs.readSync(fd, buf, 0, 256, 0)
      fs.closeSync(fd)
      const firstLine = buf.slice(0, bytesRead).toString('utf-8').replace(/^﻿/, '').split('\n')[0]
      return firstLine.trimEnd().startsWith(KV3_HEADER_PREFIX)
    } catch { return false }
  }

  function readMapName(filePath: string): string | undefined {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8').replace(/^﻿/, '')
      const lines = raw.split('\n').slice(0, 10)
      for (const line of lines) {
        const m = line.match(/MapName\s*=\s*"([^"]*)"/)
        if (m) return m[1] || undefined
      }
    } catch {}
    return undefined
  }
  ```

- [ ] **Step 2: Rewrite the `listGuides` handler in `electron/main/index.ts`**

  Replace the entire `ipcMain.handle('listGuides', ...)` block (lines 199–237) with the following. This handler now returns the extended type with `mapName?`, `workshopId?`, and `installed`.

  ```ts
  type GuideItem = {
    name: string
    path: string
    source: GuideSource
    mapName?: string
    workshopId?: string
    installed: boolean
  }

  ipcMain.handle(
    'listGuides',
    async (): Promise<GuideItem[]> => {
      const guides: GuideItem[] = []

      // ── Local guides ──────────────────────────────────────────────────────
      const annotationsRoot = store.get('annotationsRoot', '')
      if (annotationsRoot && fs.existsSync(annotationsRoot)) {
        const entries = fs.readdirSync(annotationsRoot, { withFileTypes: true })
        for (const e of entries) {
          if (!e.isDirectory()) continue
          const txtPath = path.join(annotationsRoot, e.name, `${e.name}.txt`)
          if (!fs.existsSync(txtPath)) continue
          guides.push({
            name: e.name,
            path: txtPath,
            source: 'local',
            mapName: readMapName(txtPath),
            installed: true,
          })
        }
      }

      // ── Workshop guides ───────────────────────────────────────────────────
      const workshopPath = store.get('workshopContentPath', '')

      // Featured registry — show all, mark uninstalled ones
      for (const fg of FEATURED_GUIDES) {
        const folderPath = workshopPath ? path.join(workshopPath, fg.id) : ''
        if (!folderPath || !fs.existsSync(folderPath)) {
          guides.push({ name: fg.name, path: '', source: 'workshop', workshopId: fg.id, installed: false })
          continue
        }
        // Find the first .txt file in the folder that passes the KV3 header check
        let found = false
        try {
          const files = fs.readdirSync(folderPath, { withFileTypes: true })
          for (const f of files) {
            if (!f.isFile() || path.extname(f.name).toLowerCase() !== '.txt') continue
            const fullPath = path.join(folderPath, f.name)
            if (!fileIsAnnotation(fullPath)) continue
            guides.push({
              name: fg.name,
              path: fullPath,
              source: 'workshop',
              mapName: readMapName(fullPath),
              workshopId: fg.id,
              installed: true,
            })
            found = true
            break
          }
        } catch {}
        if (!found) {
          guides.push({ name: fg.name, path: '', source: 'workshop', workshopId: fg.id, installed: false })
        }
      }

      // Non-registry workshop items (user-downloaded guides not in FEATURED_GUIDES)
      if (workshopPath && fs.existsSync(workshopPath)) {
        const featuredIds = new Set(FEATURED_GUIDES.map((g) => g.id))
        const dirs = fs.readdirSync(workshopPath, { withFileTypes: true })
        for (const d of dirs) {
          if (!d.isDirectory() || featuredIds.has(d.name)) continue
          const folderPath = path.join(workshopPath, d.name)
          try {
            const files = fs.readdirSync(folderPath, { withFileTypes: true })
            for (const f of files) {
              if (!f.isFile() || path.extname(f.name).toLowerCase() !== '.txt') continue
              const fullPath = path.join(folderPath, f.name)
              if (!fileIsAnnotation(fullPath)) continue
              const baseName = path.basename(f.name, '.txt')
              guides.push({
                name: `${d.name} - ${baseName}`,
                path: fullPath,
                source: 'workshop',
                mapName: readMapName(fullPath),
                workshopId: d.name,
                installed: true,
              })
              break
            }
          } catch {}
        }
      }

      return guides
    }
  )
  ```

- [ ] **Step 3: Remove the now-unused `folderContainsOnlyTxtFiles` function from `electron/main/index.ts`**

  Delete lines 77–87 (the entire `folderContainsOnlyTxtFiles` function).

  Also delete the old `type GuideSource = 'local' | 'workshop'` line (line 197) since `GuideItem` now lives inside the handler block. Keep the type alias itself — move it to just before the `GuideItem` type inside the handler if needed, or keep at module scope. The cleanest approach: keep `type GuideSource = 'local' | 'workshop'` at module scope where it already is and just remove the duplicate inside the new handler block.

  The result: `folderContainsOnlyTxtFiles` is gone, the old `listGuides` block is replaced by the new one.

- [ ] **Step 4: Update return type in `src/vite-env.d.ts`**

  Replace:
  ```ts
  listGuides: () => Promise<{ name: string; path: string; source: GuideSource }[]>
  ```
  With:
  ```ts
  listGuides: () => Promise<{ name: string; path: string; source: GuideSource; mapName?: string; workshopId?: string; installed: boolean }[]>
  ```

- [ ] **Step 5: Update `GuideItem` type and list UI in `src/components/Guides.tsx`**

  **a) Update the `GuideItem` interface** (top of file, lines 6–9):

  ```ts
  interface GuideItem {
    name: string
    path: string
    source: GuideSource
    mapName?: string
    workshopId?: string
    installed: boolean
  }
  ```

  **b) Replace the guides list section** (lines 177–204 — the `{guides.length > 0 && (...)}` block) with the new two-section layout:

  ```tsx
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
  ```

  **c) Add the `FEATURED_IDS` constant** at the top of the `Guides` component (just before the `useState` calls):

  ```ts
  const FEATURED_IDS = new Set([
    '3387810001', '3387870747', '3388581972', '3388611848',
    '3388638091', '3388681214', '3388737112', '3388761697',
  ])
  ```

  **d) Remove the old empty-state guard** that was inside the `{guides.length > 0 && (...)}` block (now the sections handle their own empty states).

  The `!loading && !error && guides.length === 0` empty state paragraph (lines 170–175) can stay as-is — it fires when no guides exist at all (no workshop path + no local guides).

- [ ] **Step 6: Build to verify no TypeScript errors**

  Run: `npm run build`

  Expected: build succeeds with no TypeScript errors. If TypeScript complains about `GuideItem.installed` being possibly `undefined`, ensure the `installed: boolean` (not `installed?: boolean`) is in the return type.

- [ ] **Step 7: Commit**

  ```bash
  git add electron/main/index.ts electron/preload/index.ts src/vite-env.d.ts src/components/Guides.tsx
  git commit -m "feat: workshop guide registry with KV3 detection and featured section"
  ```

---

## Task 2: Persistent Top Nav & Settings Modal

**Files:**
- Create: `src/components/TopNav.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/TopNav.tsx`**

  ```tsx
  interface TopNavProps {
    onOpenSettings: () => void
  }

  export default function TopNav({ onOpenSettings }: TopNavProps) {
    return (
      <div className="flex items-center justify-between px-4 shrink-0 h-9 bg-zinc-900 border-b border-zinc-700/60">
        <span className="text-sm font-semibold text-zinc-300 tracking-wide">CS2 Annotations</span>
        <button
          type="button"
          className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors text-base leading-none"
          title="Settings"
          onClick={onOpenSettings}
        >
          ⚙
        </button>
      </div>
    )
  }
  ```

- [ ] **Step 2: Rewrite `src/App.tsx`**

  Replace the entire file contents:

  ```tsx
  import { useState } from 'react'
  import Settings from './components/Settings'
  import Guides from './components/Guides'
  import TopNav from './components/TopNav'

  export default function App() {
    const [showSettings, setShowSettings] = useState(false)

    return (
      <div className="h-full flex flex-col overflow-hidden">
        <TopNav onOpenSettings={() => setShowSettings(true)} />
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden p-4">
          <Guides />
        </main>

        {showSettings && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false) }}
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60 shrink-0">
                <h2 className="text-base font-semibold text-zinc-100 m-0">Settings</h2>
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
  ```

- [ ] **Step 3: Build to verify no TypeScript errors**

  Run: `npm run build`

  Expected: build succeeds.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/TopNav.tsx src/App.tsx
  git commit -m "feat: persistent top nav with settings as centered modal"
  ```

---

## Task 3: Line Annotation UX

**Files:**
- Modify: `src/components/AnnotationCreateModal.tsx`
- Modify: `src/components/GuideEditor.tsx`

- [ ] **Step 1: Add `lineLabel` to the `CreateMeta` interface in `AnnotationCreateModal.tsx`**

  Replace the `CreateMeta` interface (lines 19–26):

  ```ts
  export interface CreateMeta {
    kind: NodeKind
    color?: [number, number, number]
    /** Grenade: Desc.Text on the main stand node (shown below the name at your feet). */
    standingPosLabel?: string
    /** Grenade: Desc.Text on the aim_target node (shown at the crosshair). */
    aimText?: string
    /** Line: Title.Text on the master node (the node with no MasterNodeId). */
    lineLabel?: string
  }
  ```

- [ ] **Step 2: Add `lineStarted`, `pointsPlaced`, and `lineLabel` state inside the component**

  In the form state block (after the existing `useState` declarations, around line 78), add:

  ```ts
  const [lineStarted, setLineStarted]   = useState(false)
  const [pointsPlaced, setPointsPlaced] = useState(0)
  const [lineLabel, setLineLabel]       = useState('')
  ```

- [ ] **Step 3: Update `buildMeta()` to include `lineLabel`**

  Replace `buildMeta()` (lines 102–109):

  ```ts
  function buildMeta(): CreateMeta {
    return {
      kind,
      color,
      standingPosLabel: standingPosLabel.trim() || undefined,
      aimText: aimText.trim() || undefined,
      lineLabel: lineLabel.trim() || undefined,
    }
  }
  ```

- [ ] **Step 4: Replace the line section UI in the Step 1 form**

  Find the `{/* ── Line ── */}` block (lines 377–419) and replace it entirely:

  ```tsx
  {/* ── Line ── */}
  {kind === 'line' && (
    <div className="flex flex-col gap-3">
      <p className={`${hintCls} m-0`}>
        Build a line point-by-point. Start, add points, then save. A line needs at least two points to be visible in CS2.
      </p>

      {/* Step indicators */}
      <div className="bg-zinc-800/60 rounded-lg px-3 py-2.5 flex flex-col gap-2">
        {/* Step 1 */}
        <div className="flex items-start gap-2">
          <span className={`text-sm mt-0.5 w-4 shrink-0 ${lineStarted ? 'text-green-400' : 'text-amber-400 animate-pulse'}`}>
            {lineStarted ? '✓' : '●'}
          </span>
          <div className="flex flex-col gap-1 flex-1">
            <span className={`text-xs ${lineStarted ? 'text-zinc-500' : 'text-zinc-200'}`}>
              Go to your start position → <strong>Start new line</strong>
            </span>
            <button
              type="button"
              className={`${btnPrimary} self-start`}
              disabled={busy || lineStarted}
              onClick={async () => {
                setBusy(true)
                await onSendCreate(`annotation_create line ${lineMount} new`)
                setLineStarted(true)
                setPointsPlaced(1)
                setBusy(false)
              }}
            >
              {lineStarted ? '✓ Started' : '▶ Start new line (F8)'}
            </button>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-2">
          <span className={`text-sm mt-0.5 w-4 shrink-0 ${!lineStarted ? 'text-zinc-600' : pointsPlaced >= 2 ? 'text-zinc-500' : 'text-amber-400 animate-pulse'}`}>
            {pointsPlaced >= 2 ? '✓' : '●'}
          </span>
          <div className="flex flex-col gap-1 flex-1">
            <span className={`text-xs ${!lineStarted ? 'text-zinc-600' : 'text-zinc-200'}`}>
              Move to next waypoint → <strong>Add point</strong>. Repeat for each waypoint.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={btnSecondary}
                disabled={busy || !lineStarted}
                onClick={async () => {
                  setBusy(true)
                  await onSendCreate(`annotation_create line ${lineMount}`)
                  setPointsPlaced((n) => n + 1)
                  setBusy(false)
                }}
              >
                + Add point (F8)
              </button>
              {pointsPlaced >= 2 && (
                <span className="text-[0.65rem] text-zinc-500">{pointsPlaced} points</span>
              )}
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex items-start gap-2">
          <span className={`text-sm mt-0.5 w-4 shrink-0 ${pointsPlaced >= 2 ? 'text-amber-400 animate-pulse' : 'text-zinc-600'}`}>●</span>
          <span className={`text-xs mt-0.5 ${pointsPlaced >= 2 ? 'text-zinc-200' : 'text-zinc-600'}`}>
            Click <strong>Save annotation</strong> when all points are placed.
          </span>
        </div>
      </div>

      {/* Mount */}
      <div>
        <label className={labelCls}>Mount</label>
        <div className="flex gap-3">
          {(['float', 'surface'] as MountMode[]).map((m) => (
            <label key={m} className="flex items-center gap-1.5 cursor-pointer text-sm text-zinc-300">
              <input type="radio" className="accent-zinc-500 cursor-pointer" checked={lineMount === m} onChange={() => setLineMount(m)} />
              {m === 'float' ? 'Float (at my position)' : 'Surface (look at target)'}
            </label>
          ))}
        </div>
      </div>

      {/* Line label */}
      <div>
        <label className={labelCls}>Line label <span className={hintCls}>(optional, auto-applied on save)</span></label>
        <input
          type="text"
          className={inputCls}
          placeholder='e.g. "Catwalk to A site"'
          value={lineLabel}
          onChange={(e) => setLineLabel(e.target.value)}
        />
      </div>

      {/* Save / Abort */}
      <div className="relative group">
        <button
          type="button"
          className={`${btnPrimary} w-full`}
          disabled={busy || pointsPlaced < 2}
          onClick={async () => { setBusy(true); await onSaveCreate(buildMeta()); setBusy(false); onClose() }}
        >
          {busy ? 'Sending…' : '✓ Save annotation (F8)'}
        </button>
        {pointsPlaced < 2 && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-zinc-700 text-zinc-200 text-[0.65rem] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Add at least one point first
          </span>
        )}
      </div>
      <button type="button" className={`${btnDanger} w-full`} disabled={busy} onClick={handleAbort}>
        {busy ? '…' : '✕ Abort & discard (F8)'}
      </button>
    </div>
  )}
  ```

- [ ] **Step 5: Remove both backdrop `onClick` dismiss handlers in `AnnotationCreateModal.tsx`**

  There are two backdrop `<div>` elements — one in Step 1 (line ~276) and one in Step 2 (line ~192). Both have:
  ```tsx
  onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
  ```

  Remove the `onClick` prop from both. The `✕` button remains as the only dismiss path.

  After the edit, both outer divs should look like:
  ```tsx
  <div className="fixed inset-0 z-500 flex items-center justify-center bg-black/60">
  ```

- [ ] **Step 6: Apply `lineLabel` in the metadata patch block in `GuideEditor.tsx`**

  Find the metadata patch block in the file watcher effect (around lines 326–364). Inside the `const u = { ...n }` / `// Color on the main/stand node` section, add a new patch after the existing `aimText` patch:

  Current ending of the patch section (around line 343–345):
  ```ts
          // Aim instruction on the aim_target node
          if (meta.aimText && n.SubType === 'aim_target') {
            u.Desc = { ...u.Desc, Text: meta.aimText }
          }
  ```

  Add immediately after:
  ```ts
          // Line label on the master node (the one with no MasterNodeId)
          if (meta.lineLabel && !n.MasterNodeId) {
            u.Title = { ...u.Title, Text: meta.lineLabel }
          }
  ```

- [ ] **Step 7: Build to verify no TypeScript errors**

  Run: `npm run build`

  Expected: build succeeds with no errors. If TypeScript complains about `meta.lineLabel` not existing on `CreateMeta`, verify Step 1 was applied.

- [ ] **Step 8: Commit**

  ```bash
  git add src/components/AnnotationCreateModal.tsx src/components/GuideEditor.tsx
  git commit -m "feat: line annotation UX with step indicators, point guard, and line label"
  ```

---

## Task 4: Small Fixes

**Files:**
- Modify: `src/components/GuideEditor.tsx`

- [ ] **Step 1: Remove the "Reload in CS2" button from `GuideEditor.tsx`**

  Find the toolbar block that renders both "Load in CS2" and "Reload in CS2" (lines 683–701):

  ```tsx
  {!isWorkshop && (
    <>
      <button
        type="button"
        className={btnSecondary}
        disabled={runCommandStatus === 'running'}
        onClick={() => handleRunInCS2(`annotation_load ${guideName}`)}
      >
        Load in CS2
      </button>
      <button
        type="button"
        className={btnSecondary}
        disabled={runCommandStatus === 'running'}
        onClick={() => handleRunInCS2(`annotation_load ${guideName}`)}
      >
        Reload in CS2
      </button>
    </>
  )}
  ```

  Replace with (remove the "Reload in CS2" button, keep "Load in CS2"):

  ```tsx
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
  ```

- [ ] **Step 2: Build to verify no TypeScript errors**

  Run: `npm run build`

  Expected: build succeeds.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/GuideEditor.tsx
  git commit -m "fix: remove redundant Reload in CS2 button from guide editor toolbar"
  ```

---

## Manual Verification Checklist

After all tasks are committed, run the app (`npm run dev`) and verify:

**Task 1 — Workshop registry:**
- [ ] Guides list shows "Featured map guides" header with all 8 entries
- [ ] Installed featured guides open normally; uninstalled ones are greyed with "Subscribe" button
- [ ] Clicking "Subscribe" launches the Steam workshop page in a browser
- [ ] Non-featured workshop guides appear under "Your guides"
- [ ] Removing a workshop folder and relaunching correctly marks the guide as uninstalled

**Task 2 — TopNav + Settings modal:**
- [ ] Thin top bar visible on all screens (guides list, guide editor)
- [ ] ⚙ button opens Settings as a centered modal
- [ ] Backdrop click closes Settings modal
- [ ] ✕ button closes Settings modal
- [ ] Settings fields work normally inside the modal

**Task 3 — Line annotation UX:**
- [ ] Opening the modal and selecting "Line" shows step indicators
- [ ] "Start new line" is enabled; after clicking it becomes disabled with a ✓
- [ ] "Add point" is disabled until "Start new line" has been clicked
- [ ] "Save annotation" is disabled until at least 2 points have been placed; hovering shows tooltip
- [ ] After 2+ points, "Save annotation" enables and works
- [ ] "Line label" input is shown; value appears as `Title.Text` on the master node after save

**Task 4 — Small fixes:**
- [ ] "Reload in CS2" button is gone from the guide editor toolbar
- [ ] Click outside the annotation creation modal (backdrop) no longer closes it
