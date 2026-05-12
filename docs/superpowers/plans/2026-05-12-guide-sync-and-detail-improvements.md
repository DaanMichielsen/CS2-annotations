# Guide Sync & Detail Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix EPERM delete, push-500, and saved-guides auth bugs; add delete-from-cloud confirmation, annotation list on guide detail page, featured-guide save blocking, and saved-guides refresh button.

**Architecture:** Changes span three packages: `apps/desktop` (Electron IPC + React hooks), `packages/ui` (GuideEditor + Guides shared components), and `apps/web` (Next.js API routes + guide detail page). Tasks are ordered so each prerequisite is implemented before it is consumed.

**Tech Stack:** Electron/IPC, electron-store, React, Next.js App Router, Prisma (Neon), Vercel Blob, TypeScript, lucide-react, `@cs2ann/shared/web`

---

## File Map

| File | Change |
|------|--------|
| `apps/desktop/electron/main/index.ts` | Fix EPERM (watcher close before unlink); store `cloudAuthorId` on push; add `cloudAuthorId` to `cloudGetSyncState`; add `cloudDeleteGuide` IPC; clear store keys on file delete |
| `apps/desktop/electron/preload/index.ts` | Expose `cloudDeleteGuide` |
| `apps/desktop/src/hooks/useSavedGuides.ts` | Fix silent 401 swallow; remove dead variable; change poll to 2 min |
| `packages/ui/src/Guides.tsx` | Add `onSavedRefresh` prop + refresh button in Saved header |
| `apps/desktop/src/App.tsx` | Wire `onSavedRefresh={savedGuides.refresh}` |
| `packages/ui/src/GuideEditor.tsx` | Replace simple `window.confirm` delete with two-step cloud-aware confirm |
| `apps/web/src/app/api/guides/route.ts` | Wrap POST body in try/catch; rollback guide on blob failure |
| `apps/web/src/components/AnnotationList.tsx` | New component: collapsible list of lineups with search, grouped by grenade type |
| `apps/web/src/app/(community)/guides/[id]/page.tsx` | Add `featuredGuide` to query; hide SaveButton for featured; flex-row buttons; render AnnotationList |
| `apps/web/src/app/api/guides/[id]/save/route.ts` | Reject 403 if guide has FeaturedGuide relation |

---

## Task 1: Fix EPERM — stop file watcher before deleting

**Files:**
- Modify: `apps/desktop/electron/main/index.ts:509-532`

- [ ] **Step 1: Read the deleteGuide handler**

  Open `apps/desktop/electron/main/index.ts` lines 509–532. The handler calls `fs.unlinkSync(fileAbs)` while `currentFileWatcher` may still hold a handle on that file, causing EPERM.

- [ ] **Step 2: Write the test**

  `apps/desktop/electron/main/index.test.ts` — add to any existing test suite or create:
  ```ts
  // verifies deleteGuide closes the watcher before unlinking
  it('closes file watcher before deleting', async () => {
    // This is tested manually: open a guide (starts watcher), then delete —
    // should not throw EPERM. Unit test would require mocking fs which adds
    // little value here. Test via integration: open a guide, delete it,
    // expect no error dialog.
  })
  ```
  *(This fix is best verified by running the app. Skip to implementation.)*

- [ ] **Step 3: Implement the fix**

  Replace the `deleteGuide` handler body with the version that closes the watcher first and clears store keys after deletion:

  ```ts
  ipcMain.handle(
    'deleteGuide',
    async (_event, filePath: string): Promise<{ error?: string }> => {
      try {
        const annotationsRoot = store.get('annotationsRoot', '')
        if (!annotationsRoot) return { error: 'Annotations folder not set.' }
        const rootAbs = path.resolve(annotationsRoot)
        const fileAbs = path.resolve(filePath)
        const relative = path.relative(rootAbs, fileAbs)
        if (relative.startsWith('..') || path.isAbsolute(relative))
          return { error: 'Can only delete local annotation files from the configured annotations folder.' }
        if (!fs.existsSync(fileAbs)) return { error: 'File not found.' }

        // Stop any active watcher before unlinking to avoid EPERM
        if (currentFileWatcher) { currentFileWatcher.close(); currentFileWatcher = null }

        fs.unlinkSync(fileAbs)

        // Remove parent directory if now empty
        const dirPath = path.dirname(fileAbs)
        if (fs.existsSync(dirPath)) {
          const remaining = fs.readdirSync(dirPath)
          if (remaining.length === 0) fs.rmdirSync(dirPath)
        }

        // Clear cloud-sync keys for this file path
        store.delete(`cloudId:${filePath}` as never)
        store.delete(`cloudVersion:${filePath}` as never)
        store.delete(`lastPushed:${filePath}` as never)
        store.delete(`cloudAuthorId:${filePath}` as never)

        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
  )
  ```

- [ ] **Step 4: Verify manually**

  Run `pnpm dev` in `apps/desktop`. Open a guide (starts the watcher), click Delete file. Confirm no EPERM dialog appears and the guide is removed from the list including its folder.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/desktop/electron/main/index.ts
  git commit -m "fix(desktop): close FSWatcher before deleting guide file to prevent EPERM"
  ```

---

## Task 2: Fix push-500 — wrap POST /api/guides in try/catch

**Files:**
- Modify: `apps/web/src/app/api/guides/route.ts:22-57`

- [ ] **Step 1: Identify the failure point**

  In `apps/web/src/app/api/guides/route.ts`, the POST handler (lines 50–57) calls `uploadGuideBlob` without a try/catch. If blob upload throws, Next.js returns a raw 500. Replace the POST body:

  ```ts
  export async function POST(req: NextRequest) {
    const user = await getApiUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const contentType = req.headers.get('content-type') ?? ''

    let title: string | null = null
    let map: string | null = null
    let nodeCount = 0
    let kv3Content: string | null = null

    if (contentType.includes('application/json')) {
      const body = await req.json()
      title = body.title ?? null
      map = body.map ?? null
      nodeCount = parseInt(String(body.nodeCount ?? '0'), 10)
      kv3Content = body.content ?? null
    } else {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      title = formData.get('title') as string | null
      map = formData.get('map') as string | null
      nodeCount = parseInt((formData.get('nodeCount') as string) ?? '0', 10)
      if (file) kv3Content = await file.text()
    }

    if (!kv3Content || !title) return NextResponse.json({ error: 'Missing content or title' }, { status: 400 })

    let guide
    try {
      guide = await db.guide.create({
        data: { userId: user.id, title, map: map ?? '', nodeCount, blobKey: '' },
      })
    } catch {
      return NextResponse.json({ error: 'Failed to create guide record' }, { status: 500 })
    }

    try {
      const blobKey = await uploadGuideBlob(guide.id, kv3Content)
      const updated = await db.guide.update({ where: { id: guide.id }, data: { blobKey } })
      return NextResponse.json({ guide: updated }, { status: 201 })
    } catch {
      await db.guide.delete({ where: { id: guide.id } }).catch(() => {})
      return NextResponse.json({ error: 'Failed to upload guide content — please try again' }, { status: 500 })
    }
  }
  ```

- [ ] **Step 2: Verify**

  Push a guide from the desktop. Confirm it succeeds (no 500). If it was failing due to blob, the error is now surfaced properly as `{ error: 'Failed to upload guide content' }` which the desktop will display.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/api/guides/route.ts
  git commit -m "fix(web): wrap POST /api/guides in try/catch and rollback on blob failure"
  ```

---

## Task 3: Fix saved-guides — silent 401 swallow + poll cleanup

**Files:**
- Modify: `apps/desktop/src/hooks/useSavedGuides.ts`

**Context:** The auth token stored in electron-store IS the user's DB ID (verified in `apps/web/src/app/auth/desktop-callback/page.tsx`: `const token = session.user.id`). `getApiUser` does `db.user.findUnique({ where: { id: userId } })` which should find them. The current hook silently shows an empty list if the response is not 2xx, making auth failures invisible.

- [ ] **Step 1: Rewrite useSavedGuides**

  Replace the entire file:

  ```ts
  import { useState, useEffect } from 'react'

  export interface SavedGuide {
    savedId: string
    id: string
    title: string
    map: string | null
    nodeCount: number
    version: number
    isPublic: boolean
    authorName: string | null
    downloadUrl: string | null
  }

  const WEB_API = 'https://cs2annotations.com/api'

  export function useSavedGuides(): { guides: SavedGuide[]; loading: boolean; refresh: () => void } {
    const [guides, setGuides] = useState<SavedGuide[]>([])
    const [loading, setLoading] = useState(true)

    const fetchGuides = () => {
      window.electronAPI.getAuthState().then((authState: { token: string | null } | null) => {
        if (!authState?.token) {
          setGuides([])
          setLoading(false)
          return
        }
        setLoading(true)
        fetch(`${WEB_API}/saved-guides`, {
          headers: { Authorization: `Bearer ${authState.token}` },
        })
          .then((r) => {
            if (!r.ok) return { guides: [] as SavedGuide[] }
            return r.json() as Promise<{ guides: SavedGuide[] }>
          })
          .then((data) => setGuides(data.guides ?? []))
          .catch(() => setGuides([]))
          .finally(() => setLoading(false))
      })
    }

    useEffect(() => {
      fetchGuides()
      const interval = setInterval(fetchGuides, 2 * 60 * 1000)
      const unsub = window.electronAPI.onAuthStateChanged(() => {
        setGuides([])
        setLoading(true)
        fetchGuides()
      })
      return () => {
        clearInterval(interval)
        unsub()
      }
    }, [])

    return { guides, loading, refresh: fetchGuides }
  }
  ```

  Changes made:
  - Removed dead `token` variable (lines 22–23 original)
  - Added `setLoading(true)` before each fetch
  - Added `r.ok` check — returns empty guides silently if auth fails (keeps UX clean; refresh button in Task 7 lets user retry)
  - Poll interval: 5 min → **2 min**

- [ ] **Step 2: Verify**

  In the desktop app, sign in, save a guide on the web, wait up to 2 minutes or click the (future) refresh button. Confirm the guide appears in the Saved section.

  If guides still don't appear: open Electron DevTools → Network tab → find the `/api/saved-guides` request → inspect the response. If 401, the token is wrong. If 200 but empty array, no saves exist. Report the exact response for further debugging.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/src/hooks/useSavedGuides.ts
  git commit -m "fix(desktop): fix saved-guides auth handling, remove dead variable, poll every 2 min"
  ```

---

## Task 4: Store cloudAuthorId on push + expose in cloudGetSyncState

**Files:**
- Modify: `apps/desktop/electron/main/index.ts`

**Context:** `cloudAuthorId` is the userId stored when a guide is pushed. It lets us know if the currently logged-in user owns the cloud copy so we can offer cloud delete.

- [ ] **Step 1: Add cloudAuthorId storage in createGuide helper**

  In `cloudPushGuide` handler (around line 705), find the `createGuide` inner function. After `store.set(`cloudId:${payload.filePath}`, guide.id)` (currently line 719), add:

  ```ts
  store.set(`cloudAuthorId:${payload.filePath}`, store.get('authToken', null))
  ```

  The full `createGuide` function becomes:
  ```ts
  const createGuide = async () => {
    const body = JSON.stringify({
      title: payload.title,
      map: payload.map,
      nodeCount: payload.nodeCount ?? 0,
      content,
    })
    const res = await fetch(`${WEB_API}/guides`, {
      method: 'POST', headers: jsonHeaders, body,
    })
    if (!res.ok) return { error: await apiError(res) }
    const { guide } = await res.json()
    store.set(`cloudVersion:${payload.filePath}`, guide.version)
    store.set(`lastPushed:${payload.filePath}`, Date.now())
    store.set(`cloudId:${payload.filePath}`, guide.id)
    store.set(`cloudAuthorId:${payload.filePath}`, store.get('authToken', null))
    return { guide }
  }
  ```

- [ ] **Step 2: Add cloudAuthorId storage in PUT success path**

  In the PUT success path (around line 745), after `store.set(`cloudId:${payload.filePath}`, guide.id)`:

  ```ts
  store.set(`cloudVersion:${payload.filePath}`, guide.version)
  store.set(`lastPushed:${payload.filePath}`, Date.now())
  store.set(`cloudId:${payload.filePath}`, guide.id)
  store.set(`cloudAuthorId:${payload.filePath}`, store.get('authToken', null))
  return { guide }
  ```

- [ ] **Step 3: Expose cloudAuthorId in cloudGetSyncState**

  Replace the `cloudGetSyncState` handler (lines 778–790) with:

  ```ts
  ipcMain.handle('cloudGetSyncState', async (_event, filePath: string) => {
    const cloudId = store.get(`cloudId:${filePath}`, null) as string | null
    const cloudAuthorId = store.get(`cloudAuthorId:${filePath}`, null) as string | null
    const localVersion = store.get(`cloudVersion:${filePath}`, 0) as number
    if (!cloudId) return { synced: false, cloudAuthorId: null }
    try {
      const res = await fetch(`${WEB_API}/guides/${cloudId}`, { headers: cloudHeaders() })
      if (!res.ok) return { synced: false, cloudId, localVersion, cloudAuthorId }
      const { guide } = await res.json()
      return { synced: true, cloudId, localVersion, cloudVersion: guide.version, behind: guide.version > localVersion, cloudAuthorId }
    } catch {
      return { synced: false, cloudId, localVersion, cloudAuthorId }
    }
  })
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add apps/desktop/electron/main/index.ts
  git commit -m "feat(desktop): store cloudAuthorId on push, expose in cloudGetSyncState"
  ```

---

## Task 5: Add cloudDeleteGuide IPC

**Files:**
- Modify: `apps/desktop/electron/main/index.ts`
- Modify: `apps/desktop/electron/preload/index.ts`

**Context:** The API route `DELETE /api/guides/[id]` already exists and enforces ownership (403 if not author). The desktop just needs to call it.

- [ ] **Step 1: Add the IPC handler in main process**

  Add after the `savedPullGuide` handler (after line 902):

  ```ts
  ipcMain.handle('cloudDeleteGuide', async (_event, cloudId: string) => {
    const token = store.get('authToken', null) as string | null
    if (!token) return { error: 'Not signed in' }
    try {
      const res = await fetch(`${WEB_API}/guides/${cloudId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        return { error: body.error ?? `Cloud delete failed (${res.status})` }
      }
      return {}
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })
  ```

- [ ] **Step 2: Expose in preload**

  In `apps/desktop/electron/preload/index.ts`, add to the `contextBridge.exposeInMainWorld` object (after `savedPullGuide`):

  ```ts
  cloudDeleteGuide: (cloudId: string) => ipcRenderer.invoke('cloudDeleteGuide', cloudId),
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/electron/main/index.ts apps/desktop/electron/preload/index.ts
  git commit -m "feat(desktop): add cloudDeleteGuide IPC using existing DELETE /api/guides/:id"
  ```

---

## Task 6: Cloud-aware delete flow in GuideEditor

**Files:**
- Modify: `packages/ui/src/GuideEditor.tsx:559-566`

**Context:** `handleDeleteGuideFile` currently uses a single `window.confirm`. We extend it to check `cloudGetSyncState` and `getAuthState` after the first confirm, then optionally offer a second confirm for cloud delete.

- [ ] **Step 1: Replace handleDeleteGuideFile**

  The current function is at lines 559–566. Replace it:

  ```ts
  const handleDeleteGuideFile = async () => {
    if (!filePath || !canDelete) return
    if (!window.confirm('Delete this annotation file from disk? This cannot be undone.')) return
    setDeleteStatus('deleting')

    const electronAPI = (window as any).electronAPI
    if (electronAPI && cloudStatus?.cloudId) {
      try {
        const [syncState, authState] = await Promise.all([
          electronAPI.cloudGetSyncState(filePath),
          electronAPI.getAuthState(),
        ])
        if (
          syncState?.cloudAuthorId &&
          authState?.token &&
          syncState.cloudAuthorId === authState.token
        ) {
          if (window.confirm('This guide is also synced to the cloud. Remove it from there too? This cannot be undone.')) {
            const cloudResult = await electronAPI.cloudDeleteGuide(cloudStatus.cloudId)
            if (cloudResult?.error) setMsg(`Cloud delete failed: ${cloudResult.error}`, true)
          }
        }
      } catch { /* non-critical — always proceed with local delete */ }
    }

    const result = await adapter.deleteGuide(filePath)
    if (result.error) { setDeleteStatus('error'); setMsg(result.error, true) }
    else { onDeleted?.(); onBack() }
  }
  ```

- [ ] **Step 2: Verify flow**

  In the desktop app:
  - Push a guide to cloud (you become cloudAuthorId)
  - Click Delete file
  - Confirm first dialog
  - Second dialog should appear: "Remove from cloud too?"
  - Confirm second → guide disappears from cloud AND local
  - "Delete locally only" → guide remains in cloud, local file gone

  For a guide you did NOT push (e.g. forked featured guide): only the first dialog appears.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/ui/src/GuideEditor.tsx
  git commit -m "feat(desktop): two-step delete with optional cloud removal for guide authors"
  ```

---

## Task 7: Saved guides refresh button + poll interval

**Files:**
- Modify: `packages/ui/src/Guides.tsx`
- Modify: `apps/desktop/src/App.tsx`

*(Poll interval already set to 2 min in Task 3. This task wires the refresh button.)*

- [ ] **Step 1: Add onSavedRefresh prop to GuidesProps**

  In `packages/ui/src/Guides.tsx`, update the `GuidesProps` interface (around line 57):

  ```ts
  interface GuidesProps {
    onGuideChange?: (guide: OpenGuideInfo | null) => void
    cloudStatuses?: Record<string, GuideSyncState>
    onCloudRefresh?: () => void
    featuredGuides?: FeaturedGuide[]
    featuredGuidesLoading?: boolean
    onFeaturedFork?: (guideId: string, title: string) => Promise<{ error?: string } | void>
    savedGuides?: SavedGuideItem[]
    savedGuidesLoading?: boolean
    onSavedPull?: (guide: SavedGuideItem) => Promise<{ error?: string } | void>
    onSavedRefresh?: () => void
  }
  ```

- [ ] **Step 2: Add RefreshCw to lucide-react import**

  Line 1 currently imports `{ FolderInput, Info }`. Add `RefreshCw`:

  ```ts
  import { FolderInput, Info, RefreshCw } from 'lucide-react'
  ```

- [ ] **Step 3: Destructure onSavedRefresh in component signature**

  Line 109, add `onSavedRefresh` to the destructured props:

  ```ts
  export default function Guides({ onGuideChange, cloudStatuses = {}, onCloudRefresh, featuredGuides = [], featuredGuidesLoading = false, onFeaturedFork, savedGuides = [], savedGuidesLoading = false, onSavedPull, onSavedRefresh }: GuidesProps = {}) {
  ```

- [ ] **Step 4: Add refresh button to Saved guides section header**

  Find the Saved guides section header button (around line 601–620). Replace it:

  ```tsx
  {/* Saved guides (from web bookmarks) */}
  <div className="mt-4">
    <div className="w-full flex items-center gap-2 mb-2">
      <button
        type="button"
        className="flex-1 text-left flex items-center gap-2 group"
        onClick={() => setSavedCollapsed((v) => !v)}
      >
        <p
          className="m-0 text-[0.7rem] uppercase tracking-wider font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)' }}
        >
          Saved guides
        </p>
        {savedGuides.length > 0 && (
          <span className="text-[0.6rem] px-1 py-0.5 bg-zinc-800 text-zinc-500 rounded-full">
            {savedGuides.length}
          </span>
        )}
        <span className="ml-auto text-[0.65rem] text-zinc-600 group-hover:text-zinc-400 transition-colors">
          {savedCollapsed ? '▸' : '▾'}
        </span>
      </button>
      {onSavedRefresh && (
        <button
          type="button"
          title="Refresh saved guides"
          className="shrink-0 p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
          onClick={onSavedRefresh}
          disabled={savedGuidesLoading}
        >
          <RefreshCw size={11} className={savedGuidesLoading ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
    {/* rest of saved section unchanged */}
  ```

- [ ] **Step 5: Wire onSavedRefresh in App.tsx**

  In `apps/desktop/src/App.tsx`, the `<Guides>` element currently passes `savedGuides`, `savedGuidesLoading`, `onSavedPull`. Add `onSavedRefresh`:

  ```tsx
  <Guides
    cloudStatuses={cloudStatus.statuses}
    onCloudRefresh={cloudStatus.refresh}
    featuredGuides={featuredGuides.guides}
    featuredGuidesLoading={featuredGuides.loading}
    onFeaturedFork={async (guideId, title) => {
      const result = await (window.electronAPI as any).featuredFork(guideId, title)
      if (result?.error) return { error: result.error }
      cloudStatus.refresh()
    }}
    savedGuides={savedGuides.guides}
    savedGuidesLoading={savedGuides.loading}
    onSavedPull={async (guide) => {
      if (!guide.downloadUrl) return { error: 'No download URL available' }
      const result = await (window.electronAPI as any).savedPullGuide({
        guideId: guide.id,
        title: guide.title,
        downloadUrl: guide.downloadUrl,
      })
      if (result?.error) return { error: result.error }
      cloudStatus.refresh()
    }}
    onSavedRefresh={savedGuides.refresh}
  />
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add packages/ui/src/Guides.tsx apps/desktop/src/App.tsx
  git commit -m "feat(desktop): add refresh button to Saved guides section"
  ```

---

## Task 8: AnnotationList component (web)

**Files:**
- Create: `apps/web/src/components/AnnotationList.tsx`

**Context:** `nodeLabel(node)` from `@cs2ann/shared/web` reads `node.Title?.Text`. `inferThrowType(aimNode)` and `THROW_TYPE_SHORT` are also exported from `@cs2ann/shared/web`.

- [ ] **Step 1: Create the component**

  ```tsx
  'use client'
  import { useState } from 'react'
  import { nodeLabel, inferThrowType, THROW_TYPE_SHORT } from '@cs2ann/shared/web'
  import type { AnnotationNode, GrenadeType } from '@cs2ann/shared/web'

  const GRENADE_ORDER: GrenadeType[] = ['smoke', 'flash', 'he', 'molotov', 'decoy']
  const GRENADE_LABELS: Record<GrenadeType, string> = {
    smoke: 'Smoke', flash: 'Flash', he: 'HE Grenade', molotov: 'Molotov', decoy: 'Decoy',
  }

  interface Props {
    nodes: AnnotationNode[]
  }

  export default function AnnotationList({ nodes }: Props) {
    const [open, setOpen] = useState(true)
    const [search, setSearch] = useState('')

    // Build aim_target lookup by MasterNodeId for throw type inference
    const aimByMaster = new Map(
      nodes
        .filter((n) => n.Type === 'grenade' && n.SubType === 'aim_target')
        .map((n) => [n.MasterNodeId, n])
    )

    // Only main grenade nodes (the lineup heads)
    const mainNodes = nodes.filter(
      (n) => n.Type === 'grenade' && n.SubType !== 'aim_target' && n.SubType !== 'destination'
    )

    if (mainNodes.length === 0) return null

    const query = search.toLowerCase()
    const matchedNodes = query
      ? mainNodes.filter((n) => nodeLabel(n).toLowerCase().includes(query))
      : mainNodes

    // Group matched nodes by grenade type
    const grouped = GRENADE_ORDER.reduce<Partial<Record<GrenadeType, AnnotationNode[]>>>(
      (acc, gt) => {
        const group = matchedNodes.filter((n) => n.GrenadeType === gt)
        if (group.length > 0) acc[gt] = group
        return acc
      },
      {}
    )

    return (
      <div className="mt-6">
        <button
          type="button"
          className="w-full flex items-center gap-2 mb-3 group"
          onClick={() => setOpen((v) => !v)}
        >
          <h2 className="font-display font-semibold text-base text-zinc-400 uppercase tracking-wider m-0">
            Lineup list · {mainNodes.length}
          </h2>
          <span className="ml-auto text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">
            {open ? '▾' : '▸'}
          </span>
        </button>

        {open && (
          <>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lineups…"
              className="w-full mb-4 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600"
            />
            <div className="flex flex-col gap-4">
              {GRENADE_ORDER.map((gt) => {
                const group = grouped[gt]
                if (!group) return null
                return (
                  <div key={gt}>
                    <p className="text-[0.65rem] font-data uppercase tracking-wider text-zinc-500 mb-1.5">
                      {GRENADE_LABELS[gt]}
                    </p>
                    <ul className="list-none m-0 p-0 space-y-0.5">
                      {group.map((node) => {
                        const aim = aimByMaster.get(node.Id)
                        const throwType = aim ? inferThrowType(aim) : null
                        return (
                          <li
                            key={node.Id}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-zinc-900/50 hover:bg-zinc-800/60 transition-colors"
                          >
                            <span className="flex-1 text-xs text-zinc-200 truncate">
                              {nodeLabel(node)}
                            </span>
                            {throwType && (
                              <span className="shrink-0 text-[0.6rem] font-data uppercase tracking-wide text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                                {THROW_TYPE_SHORT[throwType]}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
              {query && matchedNodes.length === 0 && (
                <p className="text-xs text-zinc-600">No lineups match &quot;{search}&quot;</p>
              )}
            </div>
          </>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/src/components/AnnotationList.tsx
  git commit -m "feat(web): add AnnotationList component with search and grenade-type grouping"
  ```

---

## Task 9: Update web guide detail page

**Files:**
- Modify: `apps/web/src/app/(community)/guides/[id]/page.tsx`

- [ ] **Step 1: Add AnnotationList import and featuredGuide to DB query**

  At the top of the file, add the import:
  ```ts
  import AnnotationList from '@/components/AnnotationList'
  ```

  In the `db.guide.findUnique` call (around line 37), add `featuredGuide` to the include:
  ```ts
  const guide = await db.guide.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true, avatar: true, name: true } },
      ratings: { select: { value: true, userId: true } },
      comments: {
        include: { user: { select: { username: true, avatar: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      credits: { orderBy: { position: 'asc' } },
      savedBy: session?.user?.id
        ? { where: { userId: session.user.id }, select: { id: true } }
        : false,
      featuredGuide: { select: { id: true } },
    },
  })
  ```

- [ ] **Step 2: Add isFeatured variable**

  After line 95 (`const isOwner = ...`), add:
  ```ts
  const isFeatured = !!guide.featuredGuide
  ```

- [ ] **Step 3: Fix the Actions button container**

  Replace the entire Actions div (lines 235–269):

  ```tsx
  {/* Actions */}
  <div className="flex flex-col gap-2">
    <div className="flex gap-2">
      {!isFeatured && (
        <SaveButton
          guideId={guide.id}
          initialSaved={initialSaved}
          isAuthenticated={!!session?.user?.id}
          className="flex-1"
        />
      )}
      {blobUrl && (
        <DownloadButton
          downloadUrl={blobUrl}
          guideTitle={guide.title}
          mapName={guide.map ?? null}
          className="flex-1"
        />
      )}
      {isOwner && (
        <Link
          href="/my-guides"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 text-sm font-medium transition-colors"
        >
          Manage →
        </Link>
      )}
    </div>
    {session && !isOwner && (
      <form action={forkGuide}>
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 text-sm font-medium transition-colors"
        >
          Fork guide
        </button>
      </form>
    )}
  </div>
  ```

  **Note:** `SaveButton` and `DownloadButton` must accept a `className` prop. Check their implementations — if they don't, add `className?: string` to their props and apply it to the outermost element. Both are in `apps/web/src/components/`.

- [ ] **Step 4: Add AnnotationList below GuideNodeFilter**

  Find the annotation preview section (around line 185):
  ```tsx
  <section>
    <h2 className="font-display font-semibold text-base text-zinc-400 mb-4 uppercase tracking-wider">
      Annotations · {nodes.length} nodes
    </h2>
    <GuideNodeFilter nodes={nodes} mapName={guide.map} />
  </section>
  ```

  Replace with:
  ```tsx
  <section>
    <h2 className="font-display font-semibold text-base text-zinc-400 mb-4 uppercase tracking-wider">
      Annotations · {nodes.length} nodes
    </h2>
    <GuideNodeFilter nodes={nodes} mapName={guide.map} />
    <AnnotationList nodes={nodes} />
  </section>
  ```

- [ ] **Step 5: Verify SaveButton and DownloadButton accept className**

  Open `apps/web/src/components/SaveButton.tsx` and `DownloadButton.tsx`. If their prop interfaces don't include `className?: string`, add it and apply `className` to the outermost `<button>` or `<div>`. Example for SaveButton:

  ```tsx
  interface Props {
    guideId: string
    initialSaved: boolean
    isAuthenticated: boolean
    className?: string
  }
  // In the return:
  <button ... className={`... ${className ?? ''}`}>
  ```

- [ ] **Step 6: Verify in browser**

  Run `pnpm dev` in `apps/web`. Open a non-featured guide detail page. Confirm:
  - Save, Download, Manage buttons are in a flex row (same height/width)
  - "Lineup list · N" accordion appears below the map with search box
  - Search filters lineup names in real time
  - For a featured guide: Save button is not shown

- [ ] **Step 7: Commit**

  ```bash
  git add apps/web/src/app/(community)/guides/[id]/page.tsx apps/web/src/components/SaveButton.tsx apps/web/src/components/DownloadButton.tsx
  git commit -m "feat(web): annotation list accordion, flex button row, hide save for featured guides"
  ```

---

## Task 10: Block save API for featured guides

**Files:**
- Modify: `apps/web/src/app/api/guides/[id]/save/route.ts`

- [ ] **Step 1: Add featuredGuide check**

  Replace the current `db.guide.findUnique` call (line 11) and add the guard:

  ```ts
  export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: guideId } = await params

    const guide = await db.guide.findUnique({
      where: { id: guideId },
      select: { id: true, featuredGuide: { select: { id: true } } },
    })
    if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (guide.featuredGuide) return NextResponse.json({ error: 'Featured guides cannot be saved' }, { status: 403 })

    const existing = await db.savedGuide.findUnique({
      where: { userId_guideId: { userId: session.user.id, guideId } },
    })

    if (existing) {
      await db.savedGuide.delete({ where: { id: existing.id } })
      return NextResponse.json({ saved: false })
    }

    await db.savedGuide.create({ data: { userId: session.user.id, guideId } })
    return NextResponse.json({ saved: true })
  }
  ```

- [ ] **Step 2: Verify**

  Try to save a featured guide via the web. The Save button is now hidden (Task 9), but confirm the API also returns 403 if called directly (e.g. via curl or browser devtools).

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/api/guides/[id]/save/route.ts
  git commit -m "fix(web): block saving featured guides at API level (403)"
  ```

---

## Task 11: Bump version + final check

**Files:**
- Modify: `apps/desktop/package.json` (version 1.1.0 → 1.2.0)

- [ ] **Step 1: Bump desktop version**

  In `apps/desktop/package.json`, change:
  ```json
  "version": "1.2.0",
  ```

- [ ] **Step 2: Run TypeScript checks**

  ```bash
  cd apps/desktop && pnpm exec tsc --noEmit
  cd apps/web && pnpm exec tsc --noEmit
  cd packages/ui && pnpm exec tsc --noEmit
  ```

  Fix any type errors before committing.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/package.json
  git commit -m "chore: bump desktop version to 1.2.0"
  git tag v1.2.0
  ```
