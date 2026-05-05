# Phase 6 — Media Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow guide authors to attach screenshots and video clips to individual annotation nodes, displayed on guide detail pages — similar to how csnades.com documents lineups.

**Architecture:** Media files (images and videos) are stored in Vercel Blob under `/media/{guideId}/{nodeId}/`. Metadata (guideId, nodeId, type, blobUrl) is stored in a `GuideMedia` Prisma model. The browser editor gets a per-node media panel with drag-drop upload. The guide detail page shows media inline with each node. The Electron app shows a read-only media view for synced guides. Requires Phase 5 complete.

**Tech Stack:** Vercel Blob, Prisma, Next.js API routes + server actions, React drag-drop (HTML5 native). No new infrastructure needed.

---

## File Map

**Modified:**
- `apps/web/prisma/schema.prisma` — add `GuideMedia` model

**Created in `apps/web/`:**
- `apps/web/src/app/api/guides/[id]/media/route.ts` — GET list, POST upload
- `apps/web/src/app/api/guides/[id]/media/[mediaId]/route.ts` — DELETE
- `apps/web/src/components/NodeMediaPanel.tsx` — upload + display per node
- `apps/web/src/components/MediaGallery.tsx` — read-only media display on detail page

**Modified in `apps/web/`:**
- `apps/web/src/app/(community)/guides/[id]/page.tsx` — add media gallery per node
- `apps/web/src/app/(app)/guides/[id]/edit/page.tsx` — add NodeMediaPanel per node

---

## Task 1: Add `GuideMedia` model to Prisma schema

**Files:**
- Modify: `apps/web/prisma/schema.prisma`

- [ ] **Step 1: Add `GuideMedia` model**

```prisma
model GuideMedia {
  id        String   @id @default(cuid())
  guideId   String
  nodeId    String
  type      String   // "screenshot" | "video"
  blobKey   String
  blobUrl   String
  createdAt DateTime @default(now())

  guide Guide @relation(fields: [guideId], references: [id], onDelete: Cascade)
}
```

Add reverse relation to `Guide`:

```prisma
// In Guide model, add:
media GuideMedia[]
```

- [ ] **Step 2: Run migration**

```bash
cd apps/web
npx prisma migrate dev --name add-guide-media
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/prisma/
git commit -m "feat: add GuideMedia model to Prisma schema"
```

---

## Task 2: Media upload and list API routes

**Files:**
- Create: `apps/web/src/app/api/guides/[id]/media/route.ts`
- Create: `apps/web/src/app/api/guides/[id]/media/[mediaId]/route.ts`

- [ ] **Step 1: Create `apps/web/src/app/api/guides/[id]/media/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { put } from '@vercel/blob'

// GET /api/guides/[id]/media — list media for a guide, grouped by nodeId
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const media = await db.guideMedia.findMany({
    where: { guideId: params.id },
    orderBy: { createdAt: 'asc' }
  })

  const grouped = media.reduce<Record<string, typeof media>>((acc, m) => {
    if (!acc[m.nodeId]) acc[m.nodeId] = []
    acc[m.nodeId].push(m)
    return acc
  }, {})

  return NextResponse.json({ media: grouped })
}

// POST /api/guides/[id]/media — upload a media file for a specific node
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guide = await db.guide.findUnique({ where: { id: params.id } })
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (guide.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const nodeId = formData.get('nodeId') as string

  if (!file || !nodeId) return NextResponse.json({ error: 'Missing file or nodeId' }, { status: 400 })

  const type = file.type.startsWith('video/') ? 'video' : 'screenshot'
  const ext = file.name.split('.').pop() ?? (type === 'video' ? 'mp4' : 'png')
  const blobPath = `media/${params.id}/${nodeId}/${Date.now()}.${ext}`

  const blob = await put(blobPath, file, { access: 'public' })

  const media = await db.guideMedia.create({
    data: {
      guideId: params.id,
      nodeId,
      type,
      blobKey: blob.pathname,
      blobUrl: blob.url
    }
  })

  return NextResponse.json({ media }, { status: 201 })
}
```

- [ ] **Step 2: Create `apps/web/src/app/api/guides/[id]/media/[mediaId]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { del } from '@vercel/blob'

// DELETE /api/guides/[id]/media/[mediaId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; mediaId: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guide = await db.guide.findUnique({ where: { id: params.id } })
  if (!guide || guide.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const media = await db.guideMedia.findUnique({ where: { id: params.mediaId } })
  if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await del(media.blobKey)
  await db.guideMedia.delete({ where: { id: params.mediaId } })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/guides/
git commit -m "feat: add media upload, list, and delete API routes"
```

---

## Task 3: Per-node media upload panel (browser editor)

**Files:**
- Create: `apps/web/src/components/NodeMediaPanel.tsx`

- [ ] **Step 1: Create `apps/web/src/components/NodeMediaPanel.tsx`**

```tsx
'use client'

import { useState, useRef } from 'react'

interface MediaItem {
  id: string
  type: string
  blobUrl: string
}

interface Props {
  guideId: string
  nodeId: string
  initialMedia?: MediaItem[]
}

export default function NodeMediaPanel({ guideId, nodeId, initialMedia = [] }: Props) {
  const [media, setMedia] = useState<MediaItem[]>(initialMedia)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setUploading(true)
    const form = new FormData()
    form.set('file', file)
    form.set('nodeId', nodeId)

    const res = await fetch(`/api/guides/${guideId}/media`, { method: 'POST', body: form })
    if (res.ok) {
      const { media: newMedia } = await res.json()
      setMedia(m => [...m, newMedia])
    }
    setUploading(false)
  }

  async function remove(mediaId: string) {
    const res = await fetch(`/api/guides/${guideId}/media/${mediaId}`, { method: 'DELETE' })
    if (res.ok) setMedia(m => m.filter(i => i.id !== mediaId))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <div className="mt-2 border border-dashed border-gray-600 rounded p-3">
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="cursor-pointer text-xs text-gray-400 text-center py-2 hover:text-gray-300"
      >
        {uploading ? 'Uploading...' : 'Drop screenshot or video here, or click to upload'}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }}
      />
      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {media.map(m => (
            <div key={m.id} className="relative group">
              {m.type === 'video'
                ? <video src={m.blobUrl} controls className="w-full rounded" />
                : <img src={m.blobUrl} alt="screenshot" className="w-full rounded object-cover" />
              }
              <button
                onClick={() => remove(m.id)}
                className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Integrate `NodeMediaPanel` into the browser editor**

Open `apps/web/src/app/(app)/guides/[id]/edit/page.tsx`. After loading the guide, fetch its media:

```tsx
const mediaRes = await fetch(`/api/guides/${params.id}/media`)
const { media: groupedMedia } = mediaRes.ok ? await mediaRes.json() : { media: {} }
```

Pass `NodeMediaPanel` to `GuideEditor` as a prop that renders per node. Add a `nodeMediaSlot` prop to `GuideEditor` in `packages/ui/`:

In `packages/ui/src/GuideEditor.tsx`, find the per-node row render and add:

```tsx
{nodeMediaSlot?.(node.id)}
```

Where `nodeMediaSlot` is an optional prop: `nodeMediaSlot?: (nodeId: string) => React.ReactNode`.

Pass it from the edit page:

```tsx
<GuideEditor
  guideId={params.id}
  nodeMediaSlot={(nodeId) => (
    <NodeMediaPanel
      guideId={params.id}
      nodeId={nodeId}
      initialMedia={groupedMedia[nodeId] ?? []}
    />
  )}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/NodeMediaPanel.tsx apps/web/src/app/
git commit -m "feat: add per-node media upload panel to browser editor"
```

---

## Task 4: Show media on guide detail page

**Files:**
- Create: `apps/web/src/components/MediaGallery.tsx`
- Modify: `apps/web/src/app/(community)/guides/[id]/page.tsx`

- [ ] **Step 1: Create `apps/web/src/components/MediaGallery.tsx`**

```tsx
interface MediaItem {
  id: string
  type: string
  blobUrl: string
}

export default function MediaGallery({ items }: { items: MediaItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {items.map(m => (
        m.type === 'video'
          ? <video key={m.id} src={m.blobUrl} controls className="w-full rounded" />
          : <img key={m.id} src={m.blobUrl} alt="lineup screenshot" className="w-full rounded object-cover" />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Fetch and display media on the guide detail page**

In `apps/web/src/app/(community)/guides/[id]/page.tsx`, add a fetch for media after loading the guide:

```ts
const allMedia = await db.guideMedia.findMany({ where: { guideId: params.id }, orderBy: { createdAt: 'asc' } })
const mediaByNode = allMedia.reduce<Record<string, typeof allMedia>>((acc, m) => {
  if (!acc[m.nodeId]) acc[m.nodeId] = []
  acc[m.nodeId].push(m)
  return acc
}, {})
```

Below the guide description and above the comments section, add a node list with media:

```tsx
{Object.entries(mediaByNode).map(([nodeId, items]) => (
  <div key={nodeId} className="mb-4">
    <p className="text-xs text-gray-500 mb-1">Node: {nodeId}</p>
    <MediaGallery items={items} />
  </div>
))}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/MediaGallery.tsx apps/web/src/app/(community)/
git commit -m "feat: show media attachments on guide detail page"
```

---

## Task 5: Read-only media view in Electron app

The Electron app can display cloud media for guides that have been synced (have a `cloudId`). This is a read-only view — uploads happen in the browser only.

**Files:**
- Modify: `apps/desktop/src/components/CloudPanel.tsx`

- [ ] **Step 1: Add a media viewer section to `CloudPanel.tsx`**

When a guide has a `cloudId`, add a "View media on web" link that opens the guide detail page in the browser:

```tsx
{syncState?.cloudId && (
  <button
    onClick={() => window.electronAPI.openCommunity().then(() =>
      shell.openExternal(`https://cs2ann.vercel.app/guides/${syncState.cloudId}`)
    )}
    className="text-xs text-blue-400 hover:text-blue-300 underline mt-1"
  >
    View guide page (media, comments)
  </button>
)}
```

Since `shell` is not available in the renderer, use the existing `openCommunity` IPC or add a new `openGuideDetail` IPC handler:

In `apps/desktop/electron/main/index.ts`:

```ts
ipcMain.handle('openGuideDetail', (_event, guideId: string) => {
  shell.openExternal(`https://cs2ann.vercel.app/guides/${guideId}`)
})
```

In preload:
```ts
openGuideDetail: (guideId: string) => ipcRenderer.invoke('openGuideDetail', guideId)
```

In `vite-env.d.ts`:
```ts
openGuideDetail: (guideId: string) => Promise<void>
```

In `CloudPanel.tsx`:
```tsx
{syncState?.cloudId && (
  <button
    onClick={() => window.electronAPI.openGuideDetail(syncState.cloudId!)}
    className="text-xs text-blue-400 hover:text-blue-300 underline mt-1 block"
  >
    View media & comments on web
  </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/
git commit -m "feat: add link to guide detail page (media/comments) from Electron cloud panel"
```
