# Phase 4 — Cloud Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push and pull annotation guides between the Electron desktop app and the cloud (Vercel Blob + Neon Postgres), with optimistic version locking to prevent silent overwrites. Both Electron and the browser editor can edit guides.

**Architecture:** Raw KV3 files are stored in Vercel Blob; metadata (title, map, version, isPublic) lives in Neon via Prisma. All cloud API routes are in `apps/web/src/app/api/guides/`. The Electron app stores a `cloudVersion` per guide path in electron-store. On open, it checks if cloud version is newer and shows a banner. On push, the API returns 409 if the incoming version is stale. A `CloudAdapter` in `apps/web/` implements the `GuideAdapter` interface so the browser editor uses the same `packages/ui` components as the desktop app.

**Tech Stack:** Vercel Blob (`@vercel/blob`), Prisma, Next.js API routes, `packages/ui` GuideAdapter, electron-store. Requires Phase 3 complete (auth, Prisma, NextAuth).

---

## File Map

**Modified:**
- `apps/web/prisma/schema.prisma` — add `Guide` model

**Created in `apps/web/`:**
- `apps/web/src/app/api/guides/route.ts` — GET (list), POST (create)
- `apps/web/src/app/api/guides/[id]/route.ts` — GET (single), PUT (update), DELETE
- `apps/web/src/lib/blob.ts` — Vercel Blob helper
- `apps/web/src/adapters/CloudAdapter.ts` — `GuideAdapter` implementation for browser
- `apps/web/src/app/(app)/my-guides/page.tsx` — "My Guides" page
- `apps/web/src/app/(app)/guides/[id]/edit/page.tsx` — browser editor page

**Modified in `apps/desktop/`:**
- `apps/desktop/electron/main/index.ts` — add cloud sync IPC handlers
- `apps/desktop/electron/preload/index.ts` — expose cloud sync IPC
- `apps/desktop/src/vite-env.d.ts` — add cloud sync types
- `apps/desktop/src/components/CloudPanel.tsx` — new: cloud guides panel in sidebar

---

## Task 1: Add `Guide` model to Prisma schema

**Files:**
- Modify: `apps/web/prisma/schema.prisma`

- [ ] **Step 1: Add the `Guide` model to `apps/web/prisma/schema.prisma`**

Add after the `VerificationToken` model:

```prisma
model Guide {
  id          String   @id @default(cuid())
  userId      String
  title       String
  description String?
  map         String?
  tags        String[]
  blobKey     String          // Vercel Blob pathname (not full URL — generate signed URL on demand)
  version     Int      @default(1)
  isPublic    Boolean  @default(false)
  forkOf      String?
  nodeCount   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Also add the reverse relation to the `User` model:

```prisma
model User {
  // ... existing fields
  guides Guide[]
}
```

- [ ] **Step 2: Run migration**

```bash
cd apps/web
npx prisma migrate dev --name add-guides
```

Expected: migration applied, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add apps/web/prisma/
git commit -m "feat: add Guide model to Prisma schema"
```

---

## Task 2: Add Vercel Blob helper

**Files:**
- Create: `apps/web/src/lib/blob.ts`

- [ ] **Step 1: Install `@vercel/blob`**

```bash
pnpm --filter @cs2ann/web add @vercel/blob
```

- [ ] **Step 2: Add `BLOB_READ_WRITE_TOKEN` to `.env.local`**

Get the token from your Vercel project dashboard under Storage → Blob. Add:

```env
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

Also add it to Vercel environment variables via the dashboard.

- [ ] **Step 3: Create `apps/web/src/lib/blob.ts`**

```ts
import { put, del, head } from '@vercel/blob'

export async function uploadGuideBlob(guideId: string, kv3Content: string): Promise<string> {
  const blob = await put(`guides/${guideId}/guide.kv3`, kv3Content, {
    access: 'public',
    contentType: 'text/plain'
  })
  return blob.pathname
}

export async function deleteGuideBlob(blobKey: string): Promise<void> {
  await del(blobKey)
}

export async function getGuideBlobUrl(blobKey: string): Promise<string> {
  const info = await head(blobKey)
  return info.url
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/blob.ts
git commit -m "feat: add Vercel Blob helper for guide KV3 file storage"
```

---

## Task 3: Build guide API routes

**Files:**
- Create: `apps/web/src/app/api/guides/route.ts`
- Create: `apps/web/src/app/api/guides/[id]/route.ts`

- [ ] **Step 1: Create `apps/web/src/app/api/guides/route.ts`** (list + create)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { uploadGuideBlob } from '@/lib/blob'

// GET /api/guides — list authenticated user's guides
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guides = await db.guide.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, map: true, version: true, isPublic: true, nodeCount: true, createdAt: true, updatedAt: true }
  })

  return NextResponse.json({ guides })
}

// POST /api/guides — create a new cloud guide
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const title = formData.get('title') as string
  const map = formData.get('map') as string | null
  const nodeCount = parseInt(formData.get('nodeCount') as string ?? '0', 10)

  if (!file || !title) return NextResponse.json({ error: 'Missing file or title' }, { status: 400 })

  const kv3Content = await file.text()

  const guide = await db.guide.create({
    data: { userId: session.user.id, title, map: map ?? '', nodeCount, blobKey: '' }
  })

  const blobKey = await uploadGuideBlob(guide.id, kv3Content)
  const updated = await db.guide.update({ where: { id: guide.id }, data: { blobKey } })

  return NextResponse.json({ guide: updated }, { status: 201 })
}
```

- [ ] **Step 2: Create `apps/web/src/app/api/guides/[id]/route.ts`** (get + update + delete)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { uploadGuideBlob, deleteGuideBlob, getGuideBlobUrl } from '@/lib/blob'

// GET /api/guides/[id] — return guide metadata + download URL
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guide = await db.guide.findUnique({ where: { id: params.id } })
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (guide.userId !== session.user.id && !guide.isPublic) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const downloadUrl = await getGuideBlobUrl(guide.blobKey)
  return NextResponse.json({ guide, downloadUrl })
}

// PUT /api/guides/[id] — update guide (with optimistic version check)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guide = await db.guide.findUnique({ where: { id: params.id } })
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (guide.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const clientVersion = parseInt(formData.get('version') as string ?? '0', 10)
  const title = formData.get('title') as string | null
  const nodeCount = parseInt(formData.get('nodeCount') as string ?? '0', 10)

  // Optimistic locking: reject if client's version is stale
  if (clientVersion !== guide.version) {
    return NextResponse.json(
      { error: 'Version conflict', cloudVersion: guide.version },
      { status: 409 }
    )
  }

  let blobKey = guide.blobKey
  if (file) {
    const kv3Content = await file.text()
    blobKey = await uploadGuideBlob(guide.id, kv3Content)
  }

  const updated = await db.guide.update({
    where: { id: params.id },
    data: {
      blobKey,
      version: guide.version + 1,
      ...(title ? { title } : {}),
      nodeCount
    }
  })

  return NextResponse.json({ guide: updated })
}

// DELETE /api/guides/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guide = await db.guide.findUnique({ where: { id: params.id } })
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (guide.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await deleteGuideBlob(guide.blobKey)
  await db.guide.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/guides/
git commit -m "feat: add guide CRUD API routes with optimistic version locking"
```

---

## Task 4: Implement `CloudAdapter` for browser editor

**Files:**
- Create: `apps/web/src/adapters/CloudAdapter.ts`

- [ ] **Step 1: Create `apps/web/src/adapters/CloudAdapter.ts`**

```ts
import type {
  GuideAdapter,
  GuideSummary,
  LoadedGuide,
  SaveGuidePayload,
  AppendNodesPayload,
  CreateGuidePayload
} from '@cs2ann/shared'
import { serializeKv3Text, parseKv3Text, kv3ToNodes, extractNodesKey, setNodesInRoot } from '@cs2ann/shared'

// In-memory version cache: guideId → last known cloud version
// Populated by loadGuide; used by saveGuide to send the correct version for optimistic locking
const versionCache = new Map<string, number>()

export function createCloudAdapter(): GuideAdapter {
  return {
    async listGuides(): Promise<GuideSummary[]> {
      const res = await fetch('/api/guides')
      if (!res.ok) throw new Error('Failed to list guides')
      const { guides } = await res.json()
      return guides.map((g: { id: string; title: string; map?: string }) => ({
        id: g.id,
        name: g.title,
        mapName: g.map,
        source: 'cloud' as const
      }))
    },

    async createGuide(payload: CreateGuidePayload) {
      const kv3 = payload.nodes && payload.root && payload.nodesKey
        ? serializeKv3Text(setNodesInRoot(payload.root, payload.nodesKey, payload.nodes))
        : ''
      const form = new FormData()
      form.set('title', payload.filename)
      form.set('map', payload.mapName ?? '')
      form.set('nodeCount', String(payload.nodes?.length ?? 0))
      form.set('file', new Blob([kv3], { type: 'text/plain' }), 'guide.kv3')

      const res = await fetch('/api/guides', { method: 'POST', body: form })
      if (!res.ok) return { error: 'Failed to create guide' }
      const { guide } = await res.json()
      return { id: guide.id }
    },

    async loadGuide(id: string): Promise<LoadedGuide | { error: string }> {
      const res = await fetch(`/api/guides/${id}`)
      if (!res.ok) return { error: 'Failed to load guide' }
      const { guide, downloadUrl } = await res.json()
      // Cache the cloud version so saveGuide can pass it for optimistic locking
      versionCache.set(id, guide.version)
      const kv3Res = await fetch(downloadUrl)
      const kv3Text = await kv3Res.text()
      const root = parseKv3Text(kv3Text)
      const nodesKey = extractNodesKey(root)
      const nodes = kv3ToNodes(root, nodesKey)
      return { nodes, nodesKey, root }
    },

    async saveGuide(payload: SaveGuidePayload) {
      const kv3 = serializeKv3Text(setNodesInRoot(payload.root, payload.nodesKey, payload.nodes))
      const currentVersion = versionCache.get(payload.id) ?? 1
      const form = new FormData()
      form.set('version', String(currentVersion))
      form.set('nodeCount', String(payload.nodes.length))
      form.set('file', new Blob([kv3], { type: 'text/plain' }), 'guide.kv3')

      const res = await fetch(`/api/guides/${payload.id}`, { method: 'PUT', body: form })
      if (res.status === 409) {
        const { cloudVersion } = await res.json()
        return { error: `VERSION_CONFLICT:${cloudVersion}` }
      }
      if (!res.ok) return { error: 'Failed to save guide' }
      const { guide } = await res.json()
      versionCache.set(payload.id, guide.version)
      return {}
    },

    async saveAsLocal() {
      return { error: 'saveAsLocal not supported in browser' }
    },

    async deleteGuide(id: string) {
      const res = await fetch(`/api/guides/${id}`, { method: 'DELETE' })
      if (!res.ok) return { error: 'Failed to delete' }
      return {}
    },

    async appendNodes(_payload: AppendNodesPayload) {
      // In the browser: load target guide, append nodes, save
      return { error: 'Not yet implemented' }
    }
    // No cs2 or clipboard — browser doesn't support those
  }
}
```

Note: `saveGuide` encodes a `VERSION_CONFLICT:<version>` error string so the UI layer can detect conflicts and show the appropriate dialog.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/adapters/
git commit -m "feat: implement CloudAdapter for browser guide editing"
```

---

## Task 5: Add "My Guides" page and browser editor

**Files:**
- Create: `apps/web/src/app/(app)/my-guides/page.tsx`
- Create: `apps/web/src/app/(app)/guides/[id]/edit/page.tsx`
- Create: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Create the app layout with CloudAdapter provider**

```tsx
// apps/web/src/app/(app)/layout.tsx
'use client'

import { GuideAdapterProvider } from '@cs2ann/ui'
import { createCloudAdapter } from '@/adapters/CloudAdapter'

const adapter = createCloudAdapter()

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <GuideAdapterProvider adapter={adapter}>{children}</GuideAdapterProvider>
}
```

- [ ] **Step 2: Create "My Guides" page**

```tsx
// apps/web/src/app/(app)/my-guides/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import Link from 'next/link'

export default async function MyGuidesPage() {
  const session = await auth()
  if (!session) redirect('/api/auth/signin')

  const guides = await db.guide.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' }
  })

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">My Guides</h1>
      {guides.length === 0 && <p className="text-gray-400">No guides yet. Push one from the desktop app.</p>}
      <div className="grid gap-4">
        {guides.map(guide => (
          <div key={guide.id} className="border border-gray-700 rounded p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{guide.title}</p>
              <p className="text-sm text-gray-400">{guide.map ?? 'Unknown map'} · {guide.nodeCount} nodes · v{guide.version}</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/guides/${guide.id}/edit`} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded">
                Edit
              </Link>
              <form action={async () => {
                'use server'
                await fetch(`${process.env.NEXTAUTH_URL}/api/guides/${guide.id}`, { method: 'DELETE' })
              }}>
                <button type="submit" className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white text-sm rounded">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Create browser editor page**

```tsx
// apps/web/src/app/(app)/guides/[id]/edit/page.tsx
'use client'

import { GuideEditor } from '@cs2ann/ui'

export default function EditGuidePage({ params }: { params: { id: string } }) {
  return <GuideEditor guideId={params.id} />
}
```

Note: `GuideEditor` must accept a `guideId` prop and call `adapter.loadGuide(guideId)` internally on mount. If `GuideEditor` currently expects a full `nodes` array as a prop, you may need to add an effect that loads from the adapter. Check the current `GuideEditor` component's props and add the load-on-mount behaviour if needed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/
git commit -m "feat: add My Guides page and browser editor route"
```

---

## Task 6: Add cloud push/pull to the Electron app

**Files:**
- Modify: `apps/desktop/electron/main/index.ts` — cloud sync IPC handlers
- Modify: `apps/desktop/electron/preload/index.ts` — expose sync IPC
- Modify: `apps/desktop/src/vite-env.d.ts` — sync types
- Create: `apps/desktop/src/components/CloudPanel.tsx`

- [ ] **Step 1: Add sync IPC handlers in `apps/desktop/electron/main/index.ts`**

```ts
const WEB_API = 'https://cs2ann.vercel.app/api'

function getAuthHeaders(): Record<string, string> {
  const token = store.get('authToken', null) as string | null
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

ipcMain.handle('cloudListGuides', async () => {
  const res = await fetch(`${WEB_API}/guides`, { headers: getAuthHeaders() })
  if (!res.ok) return { error: 'Not authenticated or request failed' }
  return res.json()
})

ipcMain.handle('cloudPushGuide', async (_event, payload: {
  filePath: string
  title: string
  map: string
  cloudId?: string
  cloudVersion?: number
}) => {
  const content = fs.readFileSync(payload.filePath, 'utf-8')
  const form = new FormData()
  form.set('title', payload.title)
  form.set('map', payload.map)
  form.set('nodeCount', '0') // approximate; update after load
  form.set('file', new Blob([content], { type: 'text/plain' }), 'guide.kv3')

  if (payload.cloudId) {
    form.set('version', String(payload.cloudVersion ?? 1))
    const res = await fetch(`${WEB_API}/guides/${payload.cloudId}`, {
      method: 'PUT', headers: getAuthHeaders(), body: form
    })
    if (res.status === 409) {
      const data = await res.json()
      return { conflict: true, cloudVersion: data.cloudVersion }
    }
    if (!res.ok) return { error: 'Push failed' }
    const { guide } = await res.json()
    store.set(`cloudVersion:${payload.filePath}`, guide.version)
    store.set(`cloudId:${payload.filePath}`, guide.id)
    return { guide }
  } else {
    const res = await fetch(`${WEB_API}/guides`, {
      method: 'POST', headers: getAuthHeaders(), body: form
    })
    if (!res.ok) return { error: 'Push failed' }
    const { guide } = await res.json()
    store.set(`cloudVersion:${payload.filePath}`, guide.version)
    store.set(`cloudId:${payload.filePath}`, guide.id)
    return { guide }
  }
})

ipcMain.handle('cloudPullGuide', async (_event, payload: { cloudId: string; filePath: string }) => {
  const res = await fetch(`${WEB_API}/guides/${payload.cloudId}`, { headers: getAuthHeaders() })
  if (!res.ok) return { error: 'Pull failed' }
  const { guide, downloadUrl } = await res.json()

  const kv3Res = await fetch(downloadUrl)
  const kv3Content = await kv3Res.text()

  // Backup existing local file before overwrite
  if (fs.existsSync(payload.filePath)) {
    fs.copyFileSync(payload.filePath, payload.filePath + '.bak')
  }
  fs.writeFileSync(payload.filePath, kv3Content, 'utf-8')

  store.set(`cloudVersion:${payload.filePath}`, guide.version)
  return { ok: true }
})

ipcMain.handle('cloudGetSyncState', async (_event, filePath: string) => {
  const cloudId = store.get(`cloudId:${filePath}`, null) as string | null
  const localVersion = store.get(`cloudVersion:${filePath}`, 0) as number
  if (!cloudId) return { synced: false }

  const res = await fetch(`${WEB_API}/guides/${cloudId}`, { headers: getAuthHeaders() })
  if (!res.ok) return { synced: false, cloudId, localVersion }
  const { guide } = await res.json()
  return { synced: true, cloudId, localVersion, cloudVersion: guide.version, behind: guide.version > localVersion }
})
```

- [ ] **Step 2: Expose in preload**

Add to `contextBridge.exposeInMainWorld('electronAPI', { ... })`:

```ts
cloudListGuides: () => ipcRenderer.invoke('cloudListGuides'),
cloudPushGuide: (payload: { filePath: string; title: string; map: string; cloudId?: string; cloudVersion?: number }) =>
  ipcRenderer.invoke('cloudPushGuide', payload),
cloudPullGuide: (payload: { cloudId: string; filePath: string }) =>
  ipcRenderer.invoke('cloudPullGuide', payload),
cloudGetSyncState: (filePath: string) =>
  ipcRenderer.invoke('cloudGetSyncState', filePath)
```

- [ ] **Step 3: Add types to `apps/desktop/src/vite-env.d.ts`**

```ts
cloudListGuides: () => Promise<{ guides?: Array<{ id: string; title: string; map: string; version: number }>; error?: string }>
cloudPushGuide: (payload: { filePath: string; title: string; map: string; cloudId?: string; cloudVersion?: number }) =>
  Promise<{ guide?: { id: string; version: number }; conflict?: boolean; cloudVersion?: number; error?: string }>
cloudPullGuide: (payload: { cloudId: string; filePath: string }) => Promise<{ ok?: boolean; error?: string }>
cloudGetSyncState: (filePath: string) => Promise<{ synced: boolean; cloudId?: string; localVersion?: number; cloudVersion?: number; behind?: boolean }>
```

- [ ] **Step 4: Create `apps/desktop/src/components/CloudPanel.tsx`**

```tsx
import { useState, useEffect } from 'react'

interface CloudGuide {
  id: string
  title: string
  map: string
  version: number
}

interface Props {
  selectedFilePath: string | null
  selectedTitle: string
  selectedMap: string
}

export default function CloudPanel({ selectedFilePath, selectedTitle, selectedMap }: Props) {
  const [guides, setGuides] = useState<CloudGuide[]>([])
  const [syncState, setSyncState] = useState<{ synced: boolean; behind?: boolean; cloudId?: string; cloudVersion?: number; localVersion?: number } | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    window.electronAPI.cloudListGuides().then(r => { if (r.guides) setGuides(r.guides) })
  }, [])

  useEffect(() => {
    if (!selectedFilePath) return
    window.electronAPI.cloudGetSyncState(selectedFilePath).then(setSyncState)
  }, [selectedFilePath])

  async function push() {
    if (!selectedFilePath) return
    setStatus('Pushing...')
    const result = await window.electronAPI.cloudPushGuide({
      filePath: selectedFilePath,
      title: selectedTitle,
      map: selectedMap,
      cloudId: syncState?.cloudId,
      cloudVersion: syncState?.localVersion
    })
    if (result.conflict) {
      const choice = window.confirm(
        `Cloud has a newer version (v${result.cloudVersion}). Your local changes will overwrite it.\n\nOK = Keep mine (overwrite cloud)\nCancel = Pull cloud version instead`
      )
      if (choice) {
        // Force push: resend with cloud version to match
        await window.electronAPI.cloudPushGuide({
          filePath: selectedFilePath,
          title: selectedTitle,
          map: selectedMap,
          cloudId: syncState?.cloudId,
          cloudVersion: result.cloudVersion
        })
      } else {
        await pull()
        return
      }
    }
    if (result.error) { setStatus(`Error: ${result.error}`); return }
    setStatus('Pushed!')
    window.electronAPI.cloudGetSyncState(selectedFilePath).then(setSyncState)
  }

  async function pull() {
    if (!selectedFilePath || !syncState?.cloudId) return
    setStatus('Pulling...')
    const result = await window.electronAPI.cloudPullGuide({
      cloudId: syncState.cloudId,
      filePath: selectedFilePath
    })
    if (result.error) { setStatus(`Error: ${result.error}`); return }
    setStatus('Pulled! Reload the guide to see changes.')
    window.electronAPI.cloudGetSyncState(selectedFilePath).then(setSyncState)
  }

  return (
    <div className="p-3 border-t border-gray-700">
      <h3 className="text-sm font-semibold mb-2">Cloud Sync</h3>

      {syncState?.behind && (
        <div className="mb-2 p-2 bg-yellow-900 rounded text-xs text-yellow-200">
          Cloud has changes (v{syncState.cloudVersion} vs local v{syncState.localVersion})
          <button onClick={pull} className="ml-2 underline">Pull</button>
        </div>
      )}

      {selectedFilePath && (
        <div className="flex gap-2 mb-3">
          <button onClick={push} className="px-3 py-1 text-xs bg-green-700 hover:bg-green-600 text-white rounded">
            Push to Cloud
          </button>
          {syncState?.synced && (
            <button onClick={pull} className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded">
              Pull from Cloud
            </button>
          )}
        </div>
      )}

      {status && <p className="text-xs text-gray-400 mb-2">{status}</p>}

      <p className="text-xs text-gray-500 mb-1">Your cloud guides:</p>
      <div className="space-y-1">
        {guides.map(g => (
          <div key={g.id} className="text-xs text-gray-300 truncate">{g.title} ({g.map})</div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add `CloudPanel` to the desktop app sidebar**

Open `apps/desktop/src/App.tsx`. Import and place `CloudPanel` below the guide list, passing the currently selected guide's `filePath`, `title`, and `mapName`.

- [ ] **Step 6: Run dev and test the full push/pull flow**

```bash
pnpm dev
```

1. Sign in with Steam (Phase 3 feature)
2. Open a local guide
3. Click "Push to Cloud" → verify the guide appears in `my-guides` on the web app
4. Edit the guide in the browser editor → save
5. Back in Electron → "Cloud has changes" banner appears
6. Click "Pull" → local file updates, `.bak` backup created

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/
git commit -m "feat: add cloud push/pull with version conflict dialog to Electron app"
```
