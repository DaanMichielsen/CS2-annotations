# Featured Guides, Admin Panel & Credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded workshop-based featured guides with database-driven featured guides managed through a new admin panel, with a role system, credits, and desktop fork support.

**Architecture:** Prisma models (UserRole, FeaturedGuide, GuideCredit) drive the data layer; a Next.js route group `(admin)` hosts the admin panel protected by middleware; the desktop fetches featured guides from a public API and can fork any uninstalled guide as a local file.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), NextAuth v5 + PrismaAdapter, @dnd-kit/core + @dnd-kit/sortable, Electron IPC, electron-store, Tailwind CSS v4, React Server Actions.

---

## File Map

**New files:**

- `apps/web/prisma/schema.prisma` — add UserRole, FeaturedGuide, GuideCredit models
- `apps/web/src/types/next-auth.d.ts` — add `roles` to Session type
- `apps/web/src/lib/auth.ts` — extend session callback to load roles
- `apps/web/src/middleware.ts` — protect /admin/* routes
- `apps/web/src/lib/roles.ts` — hasRole / requireRole helpers
- `apps/web/src/app/(admin)/layout.tsx` — admin shell (header + tab bar)
- `apps/web/src/app/(admin)/admin/AdminTabs.tsx` — client tab bar
- `apps/web/src/app/(admin)/admin/page.tsx` — redirect to /admin/featured
- `apps/web/src/app/(admin)/admin/featured/actions.ts` — server actions
- `apps/web/src/app/(admin)/admin/featured/GuideBrowserModal.tsx` — guide picker modal
- `apps/web/src/app/(admin)/admin/featured/FeaturedGuideCard.tsx` — card with credits editor
- `apps/web/src/app/(admin)/admin/featured/FeaturedPageClient.tsx` — DnD list client component
- `apps/web/src/app/(admin)/admin/featured/page.tsx` — server component with DB fetch
- `apps/web/src/app/(admin)/admin/users/actions.ts` — grantRole / revokeRole / searchUsers
- `apps/web/src/app/(admin)/admin/users/UserManagementClient.tsx` — client search + role UI
- `apps/web/src/app/(admin)/admin/users/page.tsx` — server component
- `apps/web/src/components/CreditChip.tsx` — credit chip with icon inference
- `apps/web/src/app/api/featured-guides/route.ts` — GET /api/featured-guides
- `apps/web/src/app/api/featured-guides/[id]/blob/route.ts` — GET blob redirect
- `apps/desktop/src/hooks/useFeaturedGuides.ts` — fetches the API on start

**Modified files:**

- `apps/web/src/app/(community)/guides/[id]/page.tsx` — include credits in query + render CreditChip
- `apps/web/src/app/(community)/profile/edit/page.tsx` — pass isAdmin prop
- `apps/web/src/app/(community)/profile/edit/EditProfileForm.tsx` — admin link when isAdmin
- `packages/ui/src/Guides.tsx` — replace FEATURED_IDS with featuredGuides prop + Fork button
- `apps/desktop/src/App.tsx` — pass featuredGuides + onFeaturedFork
- `apps/desktop/electron/preload/index.ts` — expose featuredFork IPC
- `apps/desktop/electron/main/index.ts` — implement featuredFork IPC handler

---

## Task 1: Database Schema

**Files:**

- Modify: `apps/web/prisma/schema.prisma`

- [ ] **Step 1: Add UserRole, FeaturedGuide, GuideCredit models to the schema**

  In `apps/web/prisma/schema.prisma`, append these models after the existing `CronState` model and add the two new relations to `User` and `Guide`:

  ```prisma
  model UserRole {
    id          String   @id @default(cuid())
    userId      String
    role        String
    grantedAt   DateTime @default(now())
    grantedById String?

    user      User  @relation("UserRoles",   fields: [userId],      references: [id], onDelete: Cascade)
    grantedBy User? @relation("GrantedRoles", fields: [grantedById], references: [id], onDelete: SetNull)

    @@unique([userId, role])
    @@index([userId])
  }

  model FeaturedGuide {
    id       String   @id @default(cuid())
    guideId  String   @unique
    position Int
    addedAt  DateTime @default(now())

    guide Guide @relation(fields: [guideId], references: [id], onDelete: Cascade)

    @@index([position])
  }

  model GuideCredit {
    id       String  @id @default(cuid())
    guideId  String
    handle   String
    label    String?
    position Int

    guide Guide @relation(fields: [guideId], references: [id], onDelete: Cascade)

    @@index([guideId])
  }
  ```

  On the `User` model add these two lines inside the model (after the existing `followers` relation):

  ```prisma
  roles        UserRole[] @relation("UserRoles")
  rolesGranted UserRole[] @relation("GrantedRoles")
  ```

  On the `Guide` model add these two lines (after the existing `grenadeEntries` relation):

  ```prisma
  featuredGuide FeaturedGuide?
  credits       GuideCredit[]
  ```

- [ ] **Step 2: Run the migration**

  ```bash
  cd apps/web
  npx prisma migrate dev --name featured-guides-admin
  ```

  Expected: migration file created and applied, no errors.

- [ ] **Step 3: Regenerate the Prisma client**

  ```bash
  npx prisma generate
  ```

  Expected: `Generated Prisma Client` output.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/prisma/schema.prisma apps/web/prisma/migrations/
  git commit -m "feat(db): add UserRole, FeaturedGuide, GuideCredit models"
  ```

---

## Task 2: Auth Session Extension + NextAuth Types

**Files:**

- Modify: `apps/web/src/lib/auth.ts`
- Modify: `apps/web/src/types/next-auth.d.ts`

- [ ] **Step 1: Augment the NextAuth Session type**

  Replace the entire contents of `apps/web/src/types/next-auth.d.ts`:

  ```typescript
  import type { DefaultSession } from 'next-auth'

  declare module 'next-auth' {
    interface Session {
      user: {
        id: string
        steamId: string
        roles: string[]
      } & DefaultSession['user']
    }
  }
  ```

- [ ] **Step 2: Extend the session callback to load roles**

  In `apps/web/src/lib/auth.ts`, replace the `session` callback (lines 92–101) with:

  ```typescript
  async session({ session, user }) {
    if (session.user) {
      session.user.id = user.id
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        include: { roles: true },
      })
      session.user.steamId = dbUser?.steamId ?? ''
      session.user.image   = dbUser?.avatar   ?? session.user.image
      session.user.name    = dbUser?.username  ?? session.user.name
      session.user.roles   = dbUser?.roles.map((r) => r.role) ?? []
    }
    return session
  },
  ```

- [ ] **Step 3: Type-check**

  ```bash
  cd apps/web
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/lib/auth.ts apps/web/src/types/next-auth.d.ts
  git commit -m "feat(auth): extend session with roles array"
  ```

---

## Task 3: Middleware + Role Helpers

**Files:**

- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/lib/roles.ts`

- [ ] **Step 1: Create the role helpers**

  Create `apps/web/src/lib/roles.ts`:

  ```typescript
  import type { Session } from 'next-auth'
  import { redirect } from 'next/navigation'

  export function hasRole(session: Session | null, role: string): boolean {
    return session?.user?.roles?.includes(role) ?? false
  }

  export function requireRole(session: Session | null, role: string): void {
    if (!hasRole(session, role)) redirect('/')
  }
  ```

- [ ] **Step 2: Create the middleware**

  Create `apps/web/src/middleware.ts`:

  ```typescript
  import { auth } from '@/lib/auth'
  import { NextResponse } from 'next/server'

  export default auth((req) => {
    if (!req.auth?.user?.roles?.includes('admin')) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  })

  export const config = {
    matcher: ['/admin/:path*'],
  }
  ```

- [ ] **Step 3: Type-check**

  ```bash
  cd apps/web
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/middleware.ts apps/web/src/lib/roles.ts
  git commit -m "feat(auth): add admin middleware and role helpers"
  ```

---

## Task 4: Admin Panel Shell + Profile Admin Link

**Files:**

- Create: `apps/web/src/app/(admin)/layout.tsx`
- Create: `apps/web/src/app/(admin)/admin/AdminTabs.tsx`
- Create: `apps/web/src/app/(admin)/admin/page.tsx`
- Modify: `apps/web/src/app/(community)/profile/edit/page.tsx`
- Modify: `apps/web/src/app/(community)/profile/edit/EditProfileForm.tsx`

- [ ] **Step 1: Install @dnd-kit packages** (needed by later tasks, install now)

  ```bash
  cd apps/web
  pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
  ```

  Expected: packages installed, `package.json` updated.

- [ ] **Step 2: Create the admin tab bar client component**

  Create `apps/web/src/app/(admin)/admin/AdminTabs.tsx`:

  ```typescript
  'use client'

  import Link from 'next/link'
  import { usePathname } from 'next/navigation'

  const tabs = [
    { href: '/admin/featured', label: 'Featured Guides' },
    { href: '/admin/users',    label: 'Users' },
  ]

  export default function AdminTabs() {
    const pathname = usePathname()
    return (
      <nav className="border-b border-zinc-800 bg-zinc-950 px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  active
                    ? 'border-violet-500 text-violet-300'
                    : 'border-transparent text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }
  ```

- [ ] **Step 3: Create the admin layout**

  Create `apps/web/src/app/(admin)/layout.tsx`:

  ```typescript
  import { auth } from '@/lib/auth'
  import { requireRole } from '@/lib/roles'
  import Image from 'next/image'
  import AdminTabs from './admin/AdminTabs'

  export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await auth()
    requireRole(session, 'admin')

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 bg-zinc-950 px-6 h-14 flex items-center justify-between">
          <span className="font-display font-bold text-white text-lg">
            CS2 <span className="text-violet-400">Annotations</span>
            <span className="text-zinc-600 text-sm font-normal ml-3">Admin</span>
          </span>
          <div className="flex items-center gap-3">
            {session?.user?.image && (
              <Image
                src={session.user.image}
                alt="avatar"
                width={28}
                height={28}
                className="rounded-full ring-1 ring-zinc-700"
                unoptimized
              />
            )}
            <span className="text-sm text-zinc-400">{session?.user?.name}</span>
          </div>
        </header>
        <AdminTabs />
        <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
      </div>
    )
  }
  ```

- [ ] **Step 4: Create the /admin redirect page**

  Create `apps/web/src/app/(admin)/admin/page.tsx`:

  ```typescript
  import { redirect } from 'next/navigation'

  export default function AdminPage() {
    redirect('/admin/featured')
  }
  ```

- [ ] **Step 5: Add isAdmin prop to EditProfilePage**

  Replace the entire contents of `apps/web/src/app/(community)/profile/edit/page.tsx`:

  ```typescript
  import { auth } from '@/lib/auth'
  import { redirect } from 'next/navigation'
  import EditProfileForm from './EditProfileForm'

  export default async function EditProfilePage() {
    const session = await auth()
    if (!session?.user?.id) redirect('/auth/signin')
    const isAdmin = session.user.roles?.includes('admin') ?? false
    return <EditProfileForm isAdmin={isAdmin} />
  }
  ```

- [ ] **Step 6: Add the Admin panel link to EditProfileForm**

  In `apps/web/src/app/(community)/profile/edit/EditProfileForm.tsx`:

  Change the function signature from:

  ```typescript
  export default function EditProfileForm() {
  ```

  to:

  ```typescript
  export default function EditProfileForm({ isAdmin }: { isAdmin?: boolean }) {
  ```

  Then add the admin link at the bottom of the Actions section, after the Cancel button and `saved` span. Find this block (around line 141–150):

  ```typescript
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          {saved && (
            <span className="text-xs font-data text-emerald-400">✓ Saved</span>
          )}
        </div>
  ```

  Add `import Link from 'next/link'` to the top of the file (after the existing imports), then replace the actions div with:

  ```typescript
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          {saved && (
            <span className="text-xs font-data text-emerald-400">✓ Saved</span>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className="ml-auto text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              Admin panel →
            </Link>
          )}
        </div>
  ```

- [ ] **Step 7: Type-check**

  ```bash
  cd apps/web
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 8: Commit**

  ```bash
  git add apps/web/src/app/\(admin\)/ apps/web/src/app/\(community\)/profile/edit/ apps/web/package.json apps/web/pnpm-lock.yaml
  git commit -m "feat(admin): add admin panel shell, tabs, layout, and profile entry point"
  ```

---

## Task 5: Featured Guide Server Actions

**Files:**

- Create: `apps/web/src/app/(admin)/admin/featured/actions.ts`

- [ ] **Step 1: Create the server actions file**

  Create `apps/web/src/app/(admin)/admin/featured/actions.ts`:

  ```typescript
  'use server'

  import { auth } from '@/lib/auth'
  import { requireRole } from '@/lib/roles'
  import { db } from '@/lib/db'
  import { revalidatePath } from 'next/cache'

  export async function addFeaturedGuide(guideId: string) {
    const session = await auth()
    requireRole(session, 'admin')

    const agg = await db.featuredGuide.aggregate({ _max: { position: true } })
    const position = (agg._max.position ?? 0) + 1
    await db.featuredGuide.create({ data: { guideId, position } })
    revalidatePath('/admin/featured')
  }

  export async function removeFeaturedGuide(guideId: string) {
    const session = await auth()
    requireRole(session, 'admin')

    await db.featuredGuide.delete({ where: { guideId } })
    const remaining = await db.featuredGuide.findMany({ orderBy: { position: 'asc' } })
    await db.$transaction(
      remaining.map((fg, i) =>
        db.featuredGuide.update({ where: { id: fg.id }, data: { position: i + 1 } })
      )
    )
    revalidatePath('/admin/featured')
  }

  export async function reorderFeaturedGuides(orderedIds: string[]) {
    const session = await auth()
    requireRole(session, 'admin')

    await db.$transaction(
      orderedIds.map((id, i) =>
        db.featuredGuide.update({ where: { id }, data: { position: i + 1 } })
      )
    )
    revalidatePath('/admin/featured')
  }

  export async function updateGuideCredits(
    guideId: string,
    credits: Array<{ handle: string; label?: string }>
  ) {
    const session = await auth()
    requireRole(session, 'admin')

    await db.$transaction([
      db.guideCredit.deleteMany({ where: { guideId } }),
      ...credits
        .filter((c) => c.handle.trim())
        .map((c, i) =>
          db.guideCredit.create({
            data: { guideId, handle: c.handle.trim(), label: c.label?.trim() || null, position: i + 1 },
          })
        ),
    ])
    revalidatePath('/admin/featured')
  }

  export async function searchPublicGuides(q: string, map: string | null, page: number) {
    const session = await auth()
    requireRole(session, 'admin')

    const PAGE_SIZE = 24
    const where = {
      isPublic: true,
      ...(map ? { map } : {}),
      ...(q.trim() ? { title: { contains: q.trim(), mode: 'insensitive' as const } } : {}),
    }

    const [guides, total] = await Promise.all([
      db.guide.findMany({
        where,
        include: {
          user: { select: { username: true, name: true } },
          featuredGuide: { select: { id: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.guide.count({ where }),
    ])

    return { guides, totalPages: Math.ceil(total / PAGE_SIZE) }
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  cd apps/web
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/\(admin\)/admin/featured/actions.ts
  git commit -m "feat(admin): add featured guide server actions"
  ```

---

## Task 6: Guide Browser Modal

**Files:**

- Create: `apps/web/src/app/(admin)/admin/featured/GuideBrowserModal.tsx`

- [ ] **Step 1: Create the guide browser modal**

  Create `apps/web/src/app/(admin)/admin/featured/GuideBrowserModal.tsx`:

  ```typescript
  'use client'

  import { useState, useEffect, useTransition } from 'react'
  import { useRouter } from 'next/navigation'
  import Image from 'next/image'
  import { searchPublicGuides, addFeaturedGuide } from './actions'
  import { getMapColor, getMapLabel, KNOWN_MAPS } from '@/lib/mapColors'

  interface Guide {
    id: string
    title: string
    map: string | null
    nodeCount: number
    user: { username: string | null; name: string | null }
    featuredGuide: { id: string } | null
  }

  interface Props {
    featuredGuideIds: Set<string>
    onClose: () => void
  }

  export default function GuideBrowserModal({ featuredGuideIds, onClose }: Props) {
    const router = useRouter()
    const [q, setQ] = useState('')
    const [map, setMap] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [guides, setGuides] = useState<Guide[]>([])
    const [totalPages, setTotalPages] = useState(1)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
      startTransition(async () => {
        const result = await searchPublicGuides(q, map, page)
        setGuides(result.guides as Guide[])
        setTotalPages(result.totalPages)
      })
    }, [q, map, page])

    function handleAdd(guideId: string) {
      startTransition(async () => {
        await addFeaturedGuide(guideId)
        router.refresh()
        onClose()
      })
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col mx-4">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
            <h2 className="font-display font-bold text-lg text-white">Add featured guide</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-200 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 border-b border-zinc-800 shrink-0 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setMap(null); setPage(1) }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  !map ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All maps
              </button>
              {KNOWN_MAPS.map((m) => {
                const { accent } = getMapColor(m)
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMap(map === m ? null : m); setPage(1) }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      map === m ? 'text-white border-transparent font-semibold' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                    style={map === m ? { backgroundColor: accent, borderColor: accent } : undefined}
                  >
                    {getMapLabel(m)}
                  </button>
                )
              })}
            </div>
            <input
              type="text"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search guides…"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Guide grid */}
          <div className="overflow-y-auto flex-1 px-6 py-4">
            {isPending && (
              <p className="text-zinc-500 text-sm text-center py-8">Loading…</p>
            )}
            {!isPending && guides.length === 0 && (
              <p className="text-zinc-600 text-sm text-center py-8">No guides found.</p>
            )}
            {!isPending && guides.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {guides.map((g) => {
                  const alreadyFeatured = featuredGuideIds.has(g.id)
                  const { accent, dim } = getMapColor(g.map)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      disabled={alreadyFeatured || isPending}
                      onClick={() => handleAdd(g.id)}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        alreadyFeatured
                          ? 'border-zinc-700/50 bg-zinc-800/30 opacity-50 cursor-not-allowed'
                          : 'border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/60 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="text-[0.6rem] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                          style={{ color: accent, backgroundColor: dim }}
                        >
                          {g.map ? getMapLabel(g.map) : '—'}
                        </span>
                        {alreadyFeatured && (
                          <span className="text-[0.6rem] text-violet-400">Featured</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-zinc-100 leading-snug mb-1 line-clamp-2">
                        {g.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {g.user.username ?? g.user.name} · {g.nodeCount} nodes
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-zinc-800 shrink-0">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              <span className="text-sm text-zinc-500">{page} / {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  cd apps/web
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/\(admin\)/admin/featured/GuideBrowserModal.tsx
  git commit -m "feat(admin): add guide browser modal for featured guide selection"
  ```

---

## Task 7: Featured Guide Card with Credits Editor

**Files:**

- Create: `apps/web/src/app/(admin)/admin/featured/FeaturedGuideCard.tsx`

- [ ] **Step 1: Create the featured guide card**

  Create `apps/web/src/app/(admin)/admin/featured/FeaturedGuideCard.tsx`:

  ```typescript
  'use client'

  import { useState, useTransition } from 'react'
  import { useSortable } from '@dnd-kit/sortable'
  import { CSS } from '@dnd-kit/utilities'
  import { GripVertical, X } from 'lucide-react'
  import { getMapColor, getMapLabel } from '@/lib/mapColors'
  import { removeFeaturedGuide, updateGuideCredits } from './actions'

  interface Credit {
    id: string
    handle: string
    label: string | null
    position: number
  }

  export interface FeaturedItem {
    id: string
    guideId: string
    position: number
    guide: {
      id: string
      title: string
      map: string | null
      nodeCount: number
      user: { username: string | null; name: string | null }
      credits: Credit[]
    }
  }

  export default function FeaturedGuideCard({ item }: { item: FeaturedItem }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
      useSortable({ id: item.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.4 : 1,
    }

    const [creditsOpen, setCreditsOpen] = useState(false)
    const [credits, setCredits] = useState(
      item.guide.credits.map((c) => ({ handle: c.handle, label: c.label ?? '' }))
    )
    const [isPending, startTransition] = useTransition()

    const { accent, dim } = getMapColor(item.guide.map)

    function handleSaveCredits() {
      startTransition(async () => {
        await updateGuideCredits(
          item.guideId,
          credits.map((c) => ({ handle: c.handle, label: c.label || undefined }))
        )
        setCreditsOpen(false)
      })
    }

    function handleRemove() {
      startTransition(async () => {
        await removeFeaturedGuide(item.guideId)
      })
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-zinc-900 border border-zinc-800 rounded-lg"
      >
        {/* Main row */}
        <div className="flex items-center gap-3 px-3 py-3">
          {/* Drag handle */}
          <button
            type="button"
            className="shrink-0 text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={18} />
          </button>

          {/* Colour accent bar */}
          <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: accent }} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span
                className="text-[0.6rem] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                style={{ color: accent, backgroundColor: dim }}
              >
                {getMapLabel(item.guide.map)}
              </span>
              {credits.map((c, i) => (
                <span
                  key={i}
                  className="text-[0.6rem] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700"
                >
                  {c.label || c.handle}
                </span>
              ))}
            </div>
            <p className="text-sm font-semibold text-zinc-100 leading-snug truncate">
              {item.guide.title}
            </p>
            <p className="text-xs text-zinc-500">
              {item.guide.user.username ?? item.guide.user.name}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCreditsOpen((v) => !v)}
              className="text-xs px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded transition-colors"
            >
              Credits {creditsOpen ? '↑' : '↓'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleRemove}
              className="text-zinc-600 hover:text-red-400 transition-colors p-1.5 disabled:opacity-40"
              title="Remove from featured"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Credits section */}
        {creditsOpen && (
          <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
            <p className="text-xs text-zinc-500 mb-3">
              Credits are shown below the guide name in the desktop app and on the guide detail page.
            </p>
            <div className="space-y-2">
              {credits.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={c.handle}
                    onChange={(e) =>
                      setCredits((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x))
                      )
                    }
                    placeholder="@handle or URL (e.g. twitch.tv/username)"
                    className="flex-1 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                  />
                  <input
                    type="text"
                    value={c.label}
                    onChange={(e) =>
                      setCredits((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                      )
                    }
                    placeholder="Display name (optional)"
                    className="w-40 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={() => setCredits((prev) => prev.filter((_, j) => j !== i))}
                    className="text-zinc-600 hover:text-red-400 p-1 transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCredits((prev) => [...prev, { handle: '', label: '' }])}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                + Add credit
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveCredits}
                className="text-xs px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded transition-colors disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Save credits'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  cd apps/web
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/\(admin\)/admin/featured/FeaturedGuideCard.tsx
  git commit -m "feat(admin): add featured guide card with credits editor"
  ```

---

## Task 8: Admin Featured Page Assembly

**Files:**

- Create: `apps/web/src/app/(admin)/admin/featured/FeaturedPageClient.tsx`
- Create: `apps/web/src/app/(admin)/admin/featured/page.tsx`

- [ ] **Step 1: Create the DnD client component**

  Create `apps/web/src/app/(admin)/admin/featured/FeaturedPageClient.tsx`:

  ```typescript
  'use client'

  import { useState, useEffect } from 'react'
  import { useRouter } from 'next/navigation'
  import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
  } from '@dnd-kit/core'
  import type { DragEndEvent } from '@dnd-kit/core'
  import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    arrayMove,
  } from '@dnd-kit/sortable'
  import FeaturedGuideCard from './FeaturedGuideCard'
  import type { FeaturedItem } from './FeaturedGuideCard'
  import GuideBrowserModal from './GuideBrowserModal'
  import { reorderFeaturedGuides } from './actions'

  export default function FeaturedPageClient({ initialItems }: { initialItems: FeaturedItem[] }) {
    const router = useRouter()
    const [items, setItems] = useState(initialItems)
    const [showBrowser, setShowBrowser] = useState(false)

    // Sync local state when server re-renders (after add/remove)
    useEffect(() => {
      setItems(initialItems)
    }, [initialItems])

    const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    function handleDragEnd(event: DragEndEvent) {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      const reordered = arrayMove(items, oldIndex, newIndex)
      setItems(reordered)
      void reorderFeaturedGuides(reordered.map((i) => i.id))
    }

    const featuredGuideIds = new Set(items.map((i) => i.guideId))

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display font-bold text-2xl text-white">Featured Guides</h1>
          <button
            type="button"
            onClick={() => setShowBrowser(true)}
            className="px-4 py-2 bg-violet-700 hover:bg-violet-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + Add featured guide
          </button>
        </div>

        {items.length === 0 && (
          <p className="text-zinc-500 text-sm">
            No featured guides yet. Click "Add featured guide" to get started.
          </p>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((item) => (
                <FeaturedGuideCard key={item.id} item={item} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {showBrowser && (
          <GuideBrowserModal
            featuredGuideIds={featuredGuideIds}
            onClose={() => {
              setShowBrowser(false)
              router.refresh()
            }}
          />
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Create the page server component**

  Create `apps/web/src/app/(admin)/admin/featured/page.tsx`:

  ```typescript
  import { auth } from '@/lib/auth'
  import { requireRole } from '@/lib/roles'
  import { db } from '@/lib/db'
  import FeaturedPageClient from './FeaturedPageClient'

  export default async function AdminFeaturedPage() {
    const session = await auth()
    requireRole(session, 'admin')

    const featured = await db.featuredGuide.findMany({
      orderBy: { position: 'asc' },
      include: {
        guide: {
          include: {
            user: { select: { username: true, name: true } },
            credits: { orderBy: { position: 'asc' } },
          },
        },
      },
    })

    return <FeaturedPageClient initialItems={featured} />
  }
  ```

- [ ] **Step 3: Type-check**

  ```bash
  cd apps/web
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Manual verification**

  Grant yourself an admin role directly in the database:

  ```sql
  INSERT INTO "UserRole" (id, "userId", role, "grantedAt")
  VALUES (gen_random_uuid(), '<your-user-id>', 'admin', NOW());
  ```

  (Or use Prisma Studio: `npx prisma studio` → UserRole → Add record)

  Start the dev server: `cd apps/web && pnpm dev`

  Navigate to `/profile/edit` — confirm "Admin panel →" link appears.
  Click it — confirm you land on `/admin/featured`.
  Confirm the header shows your name/avatar.
  Confirm both tabs (Featured Guides, Users) are visible.
  Click "Add featured guide" — confirm the modal opens with map filters and search.
  Select a public guide — confirm it appears in the featured list.
  Drag a card — confirm it reorders.
  Open Credits on a card, add a credit, save — confirm it persists on refresh.
  Click Remove (×) — confirm the guide disappears from the list.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/app/\(admin\)/admin/featured/
  git commit -m "feat(admin): add featured guides management page with DnD and credits"
  ```

---

## Task 9: User Role Management

**Files:**

- Create: `apps/web/src/app/(admin)/admin/users/actions.ts`
- Create: `apps/web/src/app/(admin)/admin/users/UserManagementClient.tsx`
- Create: `apps/web/src/app/(admin)/admin/users/page.tsx`

- [ ] **Step 1: Create user role server actions**

  Create `apps/web/src/app/(admin)/admin/users/actions.ts`:

  ```typescript
  'use server'

  import { auth } from '@/lib/auth'
  import { requireRole } from '@/lib/roles'
  import { db } from '@/lib/db'
  import { revalidatePath } from 'next/cache'

  export async function searchUsers(q: string) {
    const session = await auth()
    requireRole(session, 'admin')

    return db.user.findMany({
      where: q.trim()
        ? {
            OR: [
              { username: { contains: q.trim(), mode: 'insensitive' } },
              { steamId: { contains: q.trim() } },
            ],
          }
        : {},
      include: { roles: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  }

  export async function grantRole(userId: string, role: string) {
    const session = await auth()
    requireRole(session, 'admin')

    await db.userRole.create({
      data: { userId, role, grantedById: session!.user.id },
    })
    revalidatePath('/admin/users')
  }

  export async function revokeRole(userId: string, role: string) {
    const session = await auth()
    requireRole(session, 'admin')

    // Prevent self-revocation of admin
    if (userId === session!.user.id && role === 'admin') return

    await db.userRole.delete({ where: { userId_role: { userId, role } } })
    revalidatePath('/admin/users')
  }
  ```

- [ ] **Step 2: Create the user management client component**

  Create `apps/web/src/app/(admin)/admin/users/UserManagementClient.tsx`:

  ```typescript
  'use client'

  import { useState, useEffect, useRef, useTransition } from 'react'
  import Image from 'next/image'
  import { searchUsers, grantRole, revokeRole } from './actions'

  type User = Awaited<ReturnType<typeof searchUsers>>[number]

  const AVAILABLE_ROLES = ['admin']

  export default function UserManagementClient() {
    const [q, setQ] = useState('')
    const [users, setUsers] = useState<User[]>([])
    const [isPending, startTransition] = useTransition()
    const timer = useRef<ReturnType<typeof setTimeout>>()

    useEffect(() => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        startTransition(async () => {
          const result = await searchUsers(q)
          setUsers(result)
        })
      }, 300)
      return () => clearTimeout(timer.current)
    }, [q])

    // Load initial users
    useEffect(() => {
      startTransition(async () => {
        const result = await searchUsers('')
        setUsers(result)
      })
    }, [])

    function handleGrant(userId: string, role: string) {
      startTransition(async () => {
        await grantRole(userId, role)
        const result = await searchUsers(q)
        setUsers(result)
      })
    }

    function handleRevoke(userId: string, role: string) {
      startTransition(async () => {
        await revokeRole(userId, role)
        const result = await searchUsers(q)
        setUsers(result)
      })
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display font-bold text-2xl text-white">Users</h1>
        </div>

        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by username or Steam ID…"
          className="w-full max-w-sm px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-500 mb-6"
        />

        {isPending && <p className="text-zinc-500 text-sm">Loading…</p>}

        {!isPending && users.length === 0 && (
          <p className="text-zinc-600 text-sm">No users found.</p>
        )}

        <div className="space-y-2">
          {users.map((user) => {
            const heldRoles = user.roles.map((r) => r.role)
            const grantableRoles = AVAILABLE_ROLES.filter((r) => !heldRoles.includes(r))

            return (
              <div
                key={user.id}
                className="flex items-center gap-4 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg"
              >
                {/* Avatar */}
                <div className="shrink-0">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.username ?? user.name ?? ''}
                      width={36}
                      height={36}
                      className="rounded-full ring-1 ring-zinc-700"
                      unoptimized
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-zinc-800 ring-1 ring-zinc-700" />
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate">
                    {user.username ?? user.name ?? 'Anonymous'}
                  </p>
                  <p className="text-xs text-zinc-600 truncate">{user.steamId}</p>
                </div>

                {/* Current roles */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {heldRoles.map((role) => (
                    <span
                      key={role}
                      className="flex items-center gap-1.5 text-xs px-2 py-1 bg-violet-900/50 border border-violet-700/50 text-violet-300 rounded"
                    >
                      {role}
                      <button
                        type="button"
                        onClick={() => handleRevoke(user.id, role)}
                        className="text-violet-500 hover:text-red-400 transition-colors leading-none"
                        title={`Revoke ${role}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  {/* Grant dropdown */}
                  {grantableRoles.length > 0 && (
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleGrant(user.id, e.target.value)
                        e.target.value = ''
                      }}
                      className="text-xs px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded cursor-pointer focus:outline-none"
                    >
                      <option value="">Grant role…</option>
                      {grantableRoles.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 3: Create the users page**

  Create `apps/web/src/app/(admin)/admin/users/page.tsx`:

  ```typescript
  import { auth } from '@/lib/auth'
  import { requireRole } from '@/lib/roles'
  import UserManagementClient from './UserManagementClient'

  export default async function AdminUsersPage() {
    const session = await auth()
    requireRole(session, 'admin')
    return <UserManagementClient />
  }
  ```

- [ ] **Step 4: Type-check**

  ```bash
  cd apps/web
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Manual verification**

  With dev server running, navigate to `/admin/users`.
  Confirm the user list loads (recent users shown).
  Search by username — confirm results filter.
  Grant "admin" to a test user — confirm the badge appears.
  Revoke it — confirm the badge disappears.
  Confirm you cannot revoke your own admin role (the × on your own admin badge should silently no-op).

- [ ] **Step 6: Commit**

  ```bash
  git add apps/web/src/app/\(admin\)/admin/users/
  git commit -m "feat(admin): add user role management page"
  ```

---

## Task 10: Credits Display on Guide Detail Page

**Files:**

- Create: `apps/web/src/components/CreditChip.tsx`
- Modify: `apps/web/src/app/(community)/guides/[id]/page.tsx`

- [ ] **Step 1: Create the CreditChip component**

  Create `apps/web/src/components/CreditChip.tsx`:

  ```typescript
  // Icon SVG paths from simple-icons (viewBox="0 0 24 24")
  const TWITCH_PATH =
    'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z'
  const YOUTUBE_PATH =
    'M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z'
  const X_PATH =
    'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 7.184zm-1.285 19.378h2.04L6.463 3.24H4.282z'
  const STEAM_PATH =
    'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z'

  type Platform = 'twitch' | 'youtube' | 'x' | 'steam' | 'person'

  function inferPlatform(handle: string): Platform {
    if (handle.includes('twitch.tv')) return 'twitch'
    if (handle.includes('youtube.com') || handle.includes('youtu.be')) return 'youtube'
    if (handle.includes('twitter.com') || handle.includes('x.com') || handle.startsWith('@')) return 'x'
    if (handle.includes('steamcommunity.com')) return 'steam'
    return 'person'
  }

  const PLATFORM_COLORS: Record<Platform, string> = {
    twitch:  '#9146ff',
    youtube: '#ff0000',
    x:       '#e7e7e7',
    steam:   '#c7d5e0',
    person:  '#71717a',
  }

  function PlatformIcon({ platform }: { platform: Platform }) {
    if (platform === 'person') {
      return (
        <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor" aria-hidden>
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
      )
    }
    const paths: Record<Exclude<Platform, 'person'>, string> = {
      twitch:  TWITCH_PATH,
      youtube: YOUTUBE_PATH,
      x:       X_PATH,
      steam:   STEAM_PATH,
    }
    return (
      <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor" aria-hidden>
        <path d={paths[platform]} />
      </svg>
    )
  }

  function isUrl(handle: string): boolean {
    return handle.startsWith('http://') || handle.startsWith('https://') || handle.includes('.com') || handle.includes('.tv')
  }

  interface CreditChipProps {
    handle: string
    label?: string | null
  }

  export function CreditChip({ handle, label }: CreditChipProps) {
    const platform = inferPlatform(handle)
    const display = label || handle
    const color = PLATFORM_COLORS[platform]
    const clickable = isUrl(handle)

    const inner = (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300"
        style={{ color }}
      >
        <PlatformIcon platform={platform} />
        <span className="text-zinc-300">{display}</span>
      </span>
    )

    if (clickable) {
      const href = handle.startsWith('http') ? handle : `https://${handle}`
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="no-underline">
          {inner}
        </a>
      )
    }
    return inner
  }
  ```

- [ ] **Step 2: Add credits to the guide detail page query**

  In `apps/web/src/app/(community)/guides/[id]/page.tsx`, update the `db.guide.findUnique` call (around line 35) to include credits:

  Find:

  ```typescript
  const guide = await db.guide.findUnique({
    where: { id },
    include: {
      user: { select: { username: true, avatar: true, name: true } },
      ratings: { select: { value: true, userId: true } },
      comments: {
        include: { user: { select: { username: true, avatar: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  ```

  Replace with:

  ```typescript
  const guide = await db.guide.findUnique({
    where: { id },
    include: {
      user: { select: { username: true, avatar: true, name: true } },
      ratings: { select: { value: true, userId: true } },
      comments: {
        include: { user: { select: { username: true, avatar: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      credits: { orderBy: { position: 'asc' } },
    },
  })
  ```

- [ ] **Step 3: Render credits below the author line**

  In the same file, add the `CreditChip` import at the top:

  ```typescript
  import { CreditChip } from '@/components/CreditChip'
  ```

  Find the author line block (around line 142–162):

  ```typescript
            <div className="flex items-center gap-2">
              {guide.user.avatar ? (
  ```

  After the closing `</div>` of that author block (the one that ends with `<span className="text-xs font-data text-zinc-600">v{guide.version}</span>`), add:

  ```typescript
            {guide.credits.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs text-zinc-600">Credits:</span>
                {guide.credits.map((c) => (
                  <CreditChip key={c.id} handle={c.handle} label={c.label} />
                ))}
              </div>
            )}
  ```

- [ ] **Step 4: Type-check**

  ```bash
  cd apps/web
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Manual verification**

  With dev server running, navigate to a guide detail page that has credits (add some via admin panel first).
  Confirm credit chips appear below the author line.
  Confirm Twitch/YouTube/X/Steam handles show the correct icon color.
  Confirm URL handles are clickable links; `@handle` strings are plain text.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/web/src/components/CreditChip.tsx apps/web/src/app/\(community\)/guides/\[id\]/page.tsx
  git commit -m "feat(web): add credits display to guide detail page"
  ```

---

## Task 11: Public Featured Guides API

**Files:**

- Create: `apps/web/src/app/api/featured-guides/route.ts`
- Create: `apps/web/src/app/api/featured-guides/[id]/blob/route.ts`

- [ ] **Step 1: Create the featured guides list endpoint**

  Create `apps/web/src/app/api/featured-guides/route.ts`:

  ```typescript
  import { NextResponse } from 'next/server'
  import { db } from '@/lib/db'

  export const revalidate = 60

  export async function GET() {
    const featured = await db.featuredGuide.findMany({
      orderBy: { position: 'asc' },
      include: {
        guide: {
          select: {
            id: true,
            title: true,
            map: true,
            nodeCount: true,
            credits: {
              orderBy: { position: 'asc' },
              select: { handle: true, label: true },
            },
          },
        },
      },
    })

    return NextResponse.json({
      guides: featured.map((fg) => ({
        id: fg.guideId,
        title: fg.guide.title,
        map: fg.guide.map,
        nodeCount: fg.guide.nodeCount,
        credits: fg.guide.credits,
      })),
    })
  }
  ```

- [ ] **Step 2: Create the blob redirect endpoint**

  Create `apps/web/src/app/api/featured-guides/[id]/blob/route.ts`:

  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { db } from '@/lib/db'
  import { getGuideBlobUrl } from '@/lib/blob'

  export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params
    const guide = await db.guide.findFirst({
      where: { id, isPublic: true },
      select: { blobKey: true },
    })
    if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const url = await getGuideBlobUrl(guide.blobKey)
    if (!url) return NextResponse.json({ error: 'Content not available' }, { status: 404 })

    return NextResponse.redirect(url)
  }
  ```

- [ ] **Step 3: Type-check**

  ```bash
  cd apps/web
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Manual verification**

  With dev server running:

  ```bash
  curl http://localhost:3000/api/featured-guides
  ```

  Expected: JSON with `{ guides: [...] }` (empty array if none featured yet).

  Add a featured guide via admin panel, then re-run — confirm it appears.

  ```bash
  curl -L "http://localhost:3000/api/featured-guides/<guideId>/blob"
  ```

  Expected: follows redirect to Vercel Blob URL and returns KV3 content.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/app/api/featured-guides/
  git commit -m "feat(api): add public featured-guides list and blob redirect endpoints"
  ```

---

## Task 12: Desktop — useFeaturedGuides Hook + App.tsx Wiring

**Files:**

- Create: `apps/desktop/src/hooks/useFeaturedGuides.ts`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Create the hook**

  Create `apps/desktop/src/hooks/useFeaturedGuides.ts`:

  ```typescript
  import { useState, useEffect } from 'react'

  export interface FeaturedGuide {
    id: string
    title: string
    map: string | null
    nodeCount: number
    credits: Array<{ handle: string; label: string | null }>
  }

  const WEB_API = 'https://cs2annotations.com/api'

  export function useFeaturedGuides(): { guides: FeaturedGuide[]; loading: boolean } {
    const [guides, setGuides] = useState<FeaturedGuide[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      fetch(`${WEB_API}/featured-guides`)
        .then((r) => r.json() as Promise<{ guides: FeaturedGuide[] }>)
        .then((data) => setGuides(data.guides))
        .catch(() => { /* network unavailable — show no featured guides */ })
        .finally(() => setLoading(false))
    }, [])

    return { guides, loading }
  }
  ```

- [ ] **Step 2: Wire the hook into App.tsx**

  In `apps/desktop/src/App.tsx`, add the import at the top:

  ```typescript
  import { useFeaturedGuides } from './hooks/useFeaturedGuides'
  ```

  Inside `AppInner`, add the hook call after `useCloudStatus`:

  ```typescript
  const featuredGuides = useFeaturedGuides()
  ```

  Update the `<Guides>` component call to pass the new props:

  ```typescript
          <Guides
            cloudStatuses={cloudStatus.statuses}
            onCloudRefresh={cloudStatus.refresh}
            featuredGuides={featuredGuides.guides}
            onFeaturedFork={async (guideId, title) => {
              await (window.electronAPI as any).featuredFork(guideId, title)
              cloudStatus.refresh()
            }}
          />
  ```

- [ ] **Step 3: Type-check**

  ```bash
  cd apps/desktop
  npx tsc --noEmit
  ```

  Expected: errors about unknown props on `Guides` — these will be fixed in the next task.

- [ ] **Step 4: Commit** (after Task 13 resolves the type errors)

  _Skip — commit together with Task 13._

---

## Task 13: Desktop — Guides.tsx Update + Fork IPC

**Files:**

- Modify: `packages/ui/src/Guides.tsx`
- Modify: `apps/desktop/electron/preload/index.ts`
- Modify: `apps/desktop/electron/main/index.ts`

- [ ] **Step 1: Update Guides.tsx props and types**

  In `packages/ui/src/Guides.tsx`, add a `FeaturedGuide` interface and update `GuidesProps`. Replace lines 20–46:

  ```typescript
  interface FeaturedGuide {
    id: string
    title: string
    map: string | null
    nodeCount: number
    credits: Array<{ handle: string; label: string | null }>
  }

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
    onCloudRefresh?: () => void
    featuredGuides?: FeaturedGuide[]
    onFeaturedFork?: (guideId: string, title: string) => void | Promise<void>
  }
  ```

  Remove the `FEATURED_IDS` constant (lines 20–23):

  ```typescript
  const FEATURED_IDS = new Set([
    '3387810001', '3387870747', '3388581972', '3388611848',
    '3388638091', '3388681214', '3388737112', '3388761697',
  ])
  ```

- [ ] **Step 2: Update Guides function signature and featured logic**

  Change the function signature (line 87) from:
  ```typescript
  export default function Guides({ onGuideChange, cloudStatuses = {}, onCloudRefresh }: GuidesProps = {}) {
  ```

  to:

  ```typescript
  export default function Guides({ onGuideChange, cloudStatuses = {}, onCloudRefresh, featuredGuides = [], onFeaturedFork }: GuidesProps = {}) {
  ```

  Add a memoized set of installed cloud IDs after the existing state declarations (around line 100, after `const [mapFilter, setMapFilter] = useState<string | null>(null)`):

  ```typescript
  const installedCloudIds = useMemo(() => {
    return new Set(
      Object.values(cloudStatuses)
        .map((s) => s.cloudId)
        .filter((id): id is string => !!id)
    )
  }, [cloudStatuses])
  ```

- [ ] **Step 3: Replace the featured section computation**

  Find lines 245–246:
  ```typescript
  const featured = guides.filter((g) => g.source === 'workshop' && g.workshopId && FEATURED_IDS.has(g.workshopId))
  const yours = guides.filter((g) => !(g.source === 'workshop' && g.workshopId && FEATURED_IDS.has(g.workshopId)))
  ```

  Replace with:

  ```typescript
  const yours = guides
  ```

  (All local/workshop guides are now in "yours" — featured section is driven by the API.)

  Also remove the `filteredFeatured` variable:

  ```typescript
  const filteredFeatured = featured.filter(matchesFilters)
  ```

  Remove it too (it's no longer used).

- [ ] **Step 4: Replace the Featured guides JSX section**

  Find the entire "Featured guides" JSX block (lines 360–418 approximately, starting with `{/* Featured guides */}`). Replace the entire block with:

  ```tsx
  {/* Featured guides from API */}
  {featuredGuides.length > 0 && (
    <div className="mb-1">
      <div className="flex items-center gap-2 mb-2">
        <p
          className="m-0 text-[0.7rem] uppercase tracking-wider font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)' }}
        >
          Featured map guides
        </p>
        <span className="text-[0.6rem] px-1 py-0.5 bg-zinc-800 text-zinc-500 rounded-full">
          {featuredGuides.length}
        </span>
      </div>
      <ul className="list-none m-0 p-0 space-y-1">
        {featuredGuides.map((fg) => {
          const { accent } = getMapColor(fg.map)
          const isInstalled = installedCloudIds.has(fg.id)
          const creditLine = fg.credits.map((c) => c.label || c.handle).join(', ')

          if (isInstalled) {
            // Find the local guide path for opening
            const localGuide = guides.find(
              (g) => g.source === 'local' && cloudStatuses[g.path]?.cloudId === fg.id
            )
            return (
              <li key={fg.id}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 min-w-0 px-3 py-2.5 text-left bg-zinc-800/60 hover:bg-zinc-800 rounded text-zinc-200 cursor-pointer text-[0.9rem] transition-colors border border-zinc-700/50 border-l-[3px]"
                  style={{ borderLeftColor: accent }}
                  onClick={() => localGuide && openGuideByPath(localGuide.name, localGuide.path, 'local')}
                  disabled={!localGuide}
                >
                  <span className="flex flex-col min-w-0">
                    <span
                      className="text-left overflow-hidden text-ellipsis whitespace-nowrap font-semibold"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {fg.title}
                    </span>
                    {creditLine && (
                      <span className="text-[0.65rem] text-zinc-500 mt-0.5">{creditLine}</span>
                    )}
                  </span>
                  <MapChip mapName={fg.map ?? undefined} />
                </button>
              </li>
            )
          }

          return (
            <li key={fg.id}>
              <div
                className="flex items-center justify-between gap-2 min-w-0 px-3 py-2.5 bg-zinc-800/30 border border-zinc-700/50 border-l-[3px] rounded text-zinc-500 text-[0.9rem]"
                style={{ borderLeftColor: accent }}
              >
                <span className="flex flex-col min-w-0">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{fg.title}</span>
                  {creditLine && (
                    <span className="text-[0.65rem] text-zinc-600 mt-0.5">{creditLine}</span>
                  )}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <MapChip mapName={fg.map ?? undefined} />
                  {onFeaturedFork && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onFeaturedFork(fg.id, fg.title)
                        await loadGuides()
                      }}
                      className="text-[0.7rem] px-2 py-0.5 bg-violet-700 hover:bg-violet-600 text-white rounded cursor-pointer transition-colors"
                    >
                      Fork
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )}
  ```

- [ ] **Step 5: Expose featuredFork IPC in preload**

  In `apps/desktop/electron/preload/index.ts`, add before the closing `})`:

  ```typescript
  featuredFork: (guideId: string, title: string) => ipcRenderer.invoke('featuredFork', guideId, title),
  ```

- [ ] **Step 6: Implement featuredFork IPC handler in main process**

  In `apps/desktop/electron/main/index.ts`, add this handler after the `openCommunity` handler (near the end of the file):

  ```typescript
  ipcMain.handle('featuredFork', async (_event, guideId: string, title: string) => {
    try {
      const annotationsRoot = store.get('annotationsRoot', '') as string
      if (!annotationsRoot) return { error: 'Annotations folder not configured. Set it in Settings first.' }

      // Fetch guide content from the public blob redirect
      const res = await fetch(`${WEB_API}/featured-guides/${guideId}/blob`, { redirect: 'follow' })
      if (!res.ok) return { error: `Failed to fetch guide content (${res.status})` }
      const content = await res.text()

      // Sanitise title → safe directory/file name
      const safeName = title.trim().replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'featured_guide'
      const guideDir = path.join(annotationsRoot, safeName)
      const filePath = path.join(guideDir, safeName + '.txt')

      fs.mkdirSync(guideDir, { recursive: true })
      fs.writeFileSync(filePath, content, 'utf-8')

      // Register the cloud ID so the guide is recognised as installed
      store.set(`cloudId:${filePath}`, guideId)
      store.set(`cloudVersion:${filePath}`, 1)

      return { ok: true, filePath }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })
  ```

- [ ] **Step 7: Type-check both packages**

  ```bash
  cd packages/ui
  npx tsc --noEmit

  cd ../../apps/desktop
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 8: Manual verification**

  Build and run the desktop app in dev mode:

  ```bash
  cd apps/desktop
  pnpm dev
  ```

  Confirm "Featured map guides" section appears with guides from the API (requires the web app to be deployed or running locally with featured guides added via admin panel).

  Confirm that guides already forked (with a `cloudId` in electron-store) show as installed and are openable.

  Click "Fork" on an uninstalled featured guide — confirm a new `.txt` file appears in the annotations folder under a directory named after the guide title, and the guide appears installed after the list refreshes.

- [ ] **Step 9: Commit**

  ```bash
  git add packages/ui/src/Guides.tsx apps/desktop/src/App.tsx apps/desktop/src/hooks/useFeaturedGuides.ts apps/desktop/electron/preload/index.ts apps/desktop/electron/main/index.ts
  git commit -m "feat(desktop): replace FEATURED_IDS with API-driven featured guides and fork action"
  ```
