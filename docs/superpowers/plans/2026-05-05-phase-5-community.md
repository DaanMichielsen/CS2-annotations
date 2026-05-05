# Phase 5 — Community Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public community layer to the web platform — browse public guides, publish your own, fork others', rate, and comment. The Electron app gets a "Browse Community" shortcut that opens the web browser.

**Architecture:** Guides already have an `isPublic` boolean in the Prisma schema. This phase adds `GuideRating` and `GuideComment` models, publish/unpublish API routes, a browse page at `/guides`, a guide detail page at `/guides/[id]`, fork functionality, and rating/comment UI. All community pages are server-rendered Next.js App Router pages. Requires Phase 4 complete (guides in DB + Blob).

**Tech Stack:** Next.js 15 App Router (server components + server actions), Prisma, Tailwind CSS. No new infrastructure needed.

---

## File Map

**Modified:**
- `apps/web/prisma/schema.prisma` — add `GuideRating`, `GuideComment` models

**Created in `apps/web/`:**
- `apps/web/src/app/api/guides/[id]/publish/route.ts`
- `apps/web/src/app/api/guides/[id]/fork/route.ts`
- `apps/web/src/app/api/guides/[id]/rate/route.ts`
- `apps/web/src/app/api/guides/[id]/comments/route.ts`
- `apps/web/src/app/(community)/guides/page.tsx` — browse public guides
- `apps/web/src/app/(community)/guides/[id]/page.tsx` — guide detail
- `apps/web/src/app/(community)/layout.tsx` — community layout with nav
- `apps/web/src/components/GuideCard.tsx`
- `apps/web/src/components/CommentThread.tsx`
- `apps/web/src/components/RatingButtons.tsx`

**Modified in `apps/desktop/`:**
- `apps/desktop/electron/main/index.ts` — add `openCommunity` IPC handler
- `apps/desktop/electron/preload/index.ts` — expose `openCommunity`
- `apps/desktop/src/components/CloudPanel.tsx` — add "Browse Community" button

---

## Task 1: Add `GuideRating` and `GuideComment` to Prisma schema

**Files:**
- Modify: `apps/web/prisma/schema.prisma`

- [ ] **Step 1: Add new models to `apps/web/prisma/schema.prisma`**

Add after the `Guide` model:

```prisma
model GuideRating {
  id      String @id @default(cuid())
  userId  String
  guideId String
  value   Int    // +1 or -1

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  guide Guide @relation(fields: [guideId], references: [id], onDelete: Cascade)

  @@unique([userId, guideId])
}

model GuideComment {
  id        String   @id @default(cuid())
  userId    String
  guideId   String
  body      String
  createdAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  guide Guide @relation(fields: [guideId], references: [id], onDelete: Cascade)
}
```

Add reverse relations to `User` and `Guide`:

```prisma
// In User model, add:
ratings  GuideRating[]
comments GuideComment[]

// In Guide model, add:
ratings  GuideRating[]
comments GuideComment[]
```

- [ ] **Step 2: Run migration**

```bash
cd apps/web
npx prisma migrate dev --name add-community
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/prisma/
git commit -m "feat: add GuideRating and GuideComment models"
```

---

## Task 2: Publish / unpublish API route

**Files:**
- Create: `apps/web/src/app/api/guides/[id]/publish/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// PATCH /api/guides/[id]/publish — toggle isPublic
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guide = await db.guide.findUnique({ where: { id: params.id } })
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (guide.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { isPublic } = await req.json() as { isPublic: boolean }

  if (isPublic && !guide.title) {
    return NextResponse.json({ error: 'Guide must have a title before publishing' }, { status: 400 })
  }

  const updated = await db.guide.update({ where: { id: params.id }, data: { isPublic } })
  return NextResponse.json({ guide: updated })
}
```

- [ ] **Step 2: Add a Publish button to the "My Guides" page**

Open `apps/web/src/app/(app)/my-guides/page.tsx`. Add a publish toggle button next to each guide's Edit link:

```tsx
// Wrap page in client component or use a server action
'use server'
async function togglePublish(guideId: string, currentIsPublic: boolean) {
  'use server'
  await fetch(`${process.env.NEXTAUTH_URL}/api/guides/${guideId}/publish`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPublic: !currentIsPublic })
  })
}
```

Add to each guide row:
```tsx
<form action={togglePublish.bind(null, guide.id, guide.isPublic)}>
  <button type="submit" className={`px-3 py-1 text-xs rounded ${guide.isPublic ? 'bg-gray-600' : 'bg-green-700 text-white'}`}>
    {guide.isPublic ? 'Unpublish' : 'Publish'}
  </button>
</form>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/guides/
git commit -m "feat: add publish/unpublish API route and toggle button"
```

---

## Task 3: Fork API route

**Files:**
- Create: `apps/web/src/app/api/guides/[id]/fork/route.ts`

- [ ] **Step 1: Create the fork route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { uploadGuideBlob, getGuideBlobUrl } from '@/lib/blob'

// POST /api/guides/[id]/fork
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const source = await db.guide.findUnique({ where: { id: params.id } })
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!source.isPublic && source.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Download original KV3 file
  const blobUrl = await getGuideBlobUrl(source.blobKey)
  const fileRes = await fetch(blobUrl)
  const kv3Content = await fileRes.text()

  // Create the fork record
  const forked = await db.guide.create({
    data: {
      userId: session.user.id,
      title: `${source.title} (fork)`,
      description: source.description,
      map: source.map,
      tags: source.tags,
      nodeCount: source.nodeCount,
      forkOf: source.id,
      blobKey: ''
    }
  })

  const blobKey = await uploadGuideBlob(forked.id, kv3Content)
  const updated = await db.guide.update({ where: { id: forked.id }, data: { blobKey } })

  return NextResponse.json({ guide: updated }, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/guides/
git commit -m "feat: add guide fork API route"
```

---

## Task 4: Rating and comment API routes

**Files:**
- Create: `apps/web/src/app/api/guides/[id]/rate/route.ts`
- Create: `apps/web/src/app/api/guides/[id]/comments/route.ts`

- [ ] **Step 1: Create rating route**

```ts
// apps/web/src/app/api/guides/[id]/rate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/guides/[id]/rate { value: 1 | -1 }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { value } = await req.json() as { value: 1 | -1 }
  if (value !== 1 && value !== -1) return NextResponse.json({ error: 'Invalid value' }, { status: 400 })

  await db.guideRating.upsert({
    where: { userId_guideId: { userId: session.user.id, guideId: params.id } },
    update: { value },
    create: { userId: session.user.id, guideId: params.id, value }
  })

  const ratings = await db.guideRating.groupBy({
    by: ['guideId'],
    where: { guideId: params.id },
    _sum: { value: true }
  })

  return NextResponse.json({ score: ratings[0]?._sum.value ?? 0 })
}
```

- [ ] **Step 2: Create comments route**

```ts
// apps/web/src/app/api/guides/[id]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/guides/[id]/comments
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const comments = await db.guideComment.findMany({
    where: { guideId: params.id },
    include: { user: { select: { username: true, avatar: true } } },
    orderBy: { createdAt: 'asc' }
  })
  return NextResponse.json({ comments })
}

// POST /api/guides/[id]/comments { body: string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { body } = await req.json() as { body: string }
  if (!body?.trim()) return NextResponse.json({ error: 'Empty comment' }, { status: 400 })

  const comment = await db.guideComment.create({
    data: { userId: session.user.id, guideId: params.id, body: body.trim() },
    include: { user: { select: { username: true, avatar: true } } }
  })
  return NextResponse.json({ comment }, { status: 201 })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/guides/
git commit -m "feat: add rating and comment API routes"
```

---

## Task 5: Browse page (`/guides`)

**Files:**
- Create: `apps/web/src/app/(community)/layout.tsx`
- Create: `apps/web/src/app/(community)/guides/page.tsx`
- Create: `apps/web/src/components/GuideCard.tsx`

- [ ] **Step 1: Create community layout**

```tsx
// apps/web/src/app/(community)/layout.tsx
import Link from 'next/link'
import { auth } from '@/lib/auth'

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <Link href="/guides" className="font-bold text-lg">CS2 Annotations</Link>
        <Link href="/guides" className="text-sm text-gray-400 hover:text-white">Browse</Link>
        {session && <Link href="/my-guides" className="text-sm text-gray-400 hover:text-white">My Guides</Link>}
        {session
          ? <Link href="/profile" className="ml-auto text-sm text-gray-400 hover:text-white">{session.user.name}</Link>
          : <Link href="/api/auth/signin" className="ml-auto text-sm bg-blue-600 px-3 py-1 rounded">Sign in</Link>
        }
      </nav>
      <main>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create `apps/web/src/components/GuideCard.tsx`**

```tsx
import Link from 'next/link'

interface GuideCardProps {
  id: string
  title: string
  map?: string | null
  nodeCount: number
  score: number
  authorName?: string | null
  authorAvatar?: string | null
}

export default function GuideCard({ id, title, map, nodeCount, score, authorName, authorAvatar }: GuideCardProps) {
  return (
    <Link href={`/guides/${id}`} className="block border border-gray-700 rounded-lg p-4 hover:border-gray-500 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-semibold text-white">{title}</h2>
        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{map ?? 'Unknown map'}</span>
      </div>
      <p className="text-sm text-gray-400">{nodeCount} annotations</p>
      <div className="flex items-center gap-3 mt-3">
        {authorAvatar && <img src={authorAvatar} alt="author" className="w-5 h-5 rounded-full" />}
        <span className="text-xs text-gray-500">{authorName}</span>
        <span className="ml-auto text-xs text-yellow-400">▲ {score}</span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Create `apps/web/src/app/(community)/guides/page.tsx`**

```tsx
import { db } from '@/lib/db'
import GuideCard from '@/components/GuideCard'

export default async function BrowsePage({
  searchParams
}: {
  searchParams: { map?: string; sort?: string; page?: string }
}) {
  const page = parseInt(searchParams.page ?? '1', 10)
  const perPage = 24

  const guides = await db.guide.findMany({
    where: {
      isPublic: true,
      ...(searchParams.map ? { map: searchParams.map } : {})
    },
    include: {
      user: { select: { username: true, avatar: true } },
      ratings: { select: { value: true } }
    },
    orderBy: searchParams.sort === 'newest' ? { createdAt: 'desc' } : { updatedAt: 'desc' },
    skip: (page - 1) * perPage,
    take: perPage
  })

  const withScores = guides.map(g => ({
    ...g,
    score: g.ratings.reduce((acc, r) => acc + r.value, 0)
  }))

  const maps = ['de_mirage', 'de_inferno', 'de_dust2', 'de_ancient', 'de_anubis', 'de_nuke', 'de_overpass', 'de_train', 'de_cache']

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex gap-3 mb-6 flex-wrap">
        <a href="/guides" className="text-sm px-3 py-1 rounded bg-gray-800 hover:bg-gray-700">All maps</a>
        {maps.map(m => (
          <a key={m} href={`/guides?map=${m}`} className={`text-sm px-3 py-1 rounded ${searchParams.map === m ? 'bg-blue-700' : 'bg-gray-800 hover:bg-gray-700'}`}>
            {m.replace('de_', '')}
          </a>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {withScores.map(g => (
          <GuideCard
            key={g.id}
            id={g.id}
            title={g.title}
            map={g.map}
            nodeCount={g.nodeCount}
            score={g.score}
            authorName={g.user.username}
            authorAvatar={g.user.avatar}
          />
        ))}
      </div>
      {withScores.length === 0 && <p className="text-gray-400 text-center py-12">No public guides yet.</p>}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(community)/ apps/web/src/components/
git commit -m "feat: add public guides browse page with map filter"
```

---

## Task 6: Guide detail page with fork, rating, and comments

**Files:**
- Create: `apps/web/src/app/(community)/guides/[id]/page.tsx`
- Create: `apps/web/src/components/RatingButtons.tsx`
- Create: `apps/web/src/components/CommentThread.tsx`

- [ ] **Step 1: Create `apps/web/src/components/RatingButtons.tsx`**

```tsx
'use client'

import { useState } from 'react'

export default function RatingButtons({ guideId, initialScore }: { guideId: string; initialScore: number }) {
  const [score, setScore] = useState(initialScore)

  async function vote(value: 1 | -1) {
    const res = await fetch(`/api/guides/${guideId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    })
    if (res.ok) {
      const data = await res.json()
      setScore(data.score)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => vote(1)} className="px-2 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded">▲</button>
      <span className="text-sm font-semibold">{score}</span>
      <button onClick={() => vote(-1)} className="px-2 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded">▼</button>
    </div>
  )
}
```

- [ ] **Step 2: Create `apps/web/src/components/CommentThread.tsx`**

```tsx
'use client'

import { useState } from 'react'

interface Comment {
  id: string
  body: string
  createdAt: string
  user: { username: string | null; avatar: string | null }
}

export default function CommentThread({ guideId, initialComments }: { guideId: string; initialComments: Comment[] }) {
  const [comments, setComments] = useState(initialComments)
  const [body, setBody] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    const res = await fetch(`/api/guides/${guideId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    })
    if (res.ok) {
      const { comment } = await res.json()
      setComments(c => [...c, comment])
      setBody('')
    }
  }

  return (
    <div>
      <h3 className="font-semibold mb-3">Comments ({comments.length})</h3>
      <div className="space-y-3 mb-4">
        {comments.map(c => (
          <div key={c.id} className="flex gap-3">
            {c.user.avatar && <img src={c.user.avatar} alt="avatar" className="w-7 h-7 rounded-full flex-shrink-0" />}
            <div>
              <p className="text-xs text-gray-400 mb-1">{c.user.username}</p>
              <p className="text-sm">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
        />
        <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded">Post</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Create `apps/web/src/app/(community)/guides/[id]/page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import RatingButtons from '@/components/RatingButtons'
import CommentThread from '@/components/CommentThread'
import Link from 'next/link'

export default async function GuideDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()

  const guide = await db.guide.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { username: true, avatar: true } },
      ratings: { select: { value: true } },
      comments: {
        include: { user: { select: { username: true, avatar: true } } },
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!guide) notFound()
  if (!guide.isPublic && guide.userId !== session?.user?.id) notFound()

  const score = guide.ratings.reduce((acc, r) => acc + r.value, 0)

  async function forkGuide() {
    'use server'
    if (!session) redirect('/api/auth/signin')
    await fetch(`${process.env.NEXTAUTH_URL}/api/guides/${params.id}/fork`, { method: 'POST' })
    redirect('/my-guides')
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">{guide.title}</h1>
          <p className="text-gray-400 text-sm">{guide.map} · {guide.nodeCount} annotations</p>
          <div className="flex items-center gap-2 mt-2">
            {guide.user.avatar && <img src={guide.user.avatar} alt="author" className="w-6 h-6 rounded-full" />}
            <span className="text-sm text-gray-400">{guide.user.username}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RatingButtons guideId={guide.id} initialScore={score} />
          {session && guide.userId !== session.user.id && (
            <form action={forkGuide}>
              <button type="submit" className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded">
                Fork guide
              </button>
            </form>
          )}
          {session && guide.userId === session.user.id && (
            <Link href={`/guides/${guide.id}/edit`} className="px-3 py-1.5 text-sm bg-blue-700 hover:bg-blue-600 rounded">
              Edit
            </Link>
          )}
        </div>
      </div>

      {guide.description && <p className="text-gray-300 mb-6">{guide.description}</p>}

      <div className="border-t border-gray-700 pt-6">
        <CommentThread guideId={guide.id} initialComments={guide.comments as Parameters<typeof CommentThread>[0]['initialComments']} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(community)/guides/ apps/web/src/components/
git commit -m "feat: add guide detail page with fork, rating, and comment thread"
```

---

## Task 7: Add "Browse Community" button to Electron app

**Files:**
- Modify: `apps/desktop/electron/main/index.ts`
- Modify: `apps/desktop/electron/preload/index.ts`
- Modify: `apps/desktop/src/components/CloudPanel.tsx`

- [ ] **Step 1: Add `openCommunity` IPC handler in main process**

```ts
ipcMain.handle('openCommunity', () => {
  shell.openExternal('https://cs2ann.vercel.app/guides')
})
```

- [ ] **Step 2: Expose in preload**

```ts
openCommunity: () => ipcRenderer.invoke('openCommunity')
```

- [ ] **Step 3: Add type to `vite-env.d.ts`**

```ts
openCommunity: () => Promise<void>
```

- [ ] **Step 4: Add button to `apps/desktop/src/components/CloudPanel.tsx`**

At the bottom of the panel:

```tsx
<button
  onClick={() => window.electronAPI.openCommunity()}
  className="w-full mt-2 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
>
  Browse Community
</button>
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/
git commit -m "feat: add Browse Community button to Electron cloud panel"
```
