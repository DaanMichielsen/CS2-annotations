# Featured Guides, Admin Panel & Credits Design

**Date:** 2026-05-11
**Status:** Approved

## Overview

Replace the hardcoded `FEATURED_IDS` workshop list in the desktop app with database-driven featured guides managed through a new admin panel on the web app. Admins curate featured guides from the existing public guide pool, set a drag-to-reorder position, and optionally attach creator credits (plain-text social handles with inferred icons). The desktop consumes a public API endpoint to display the featured list and lets users fork any featured guide they haven't installed yet as their own local guide.

A `UserRole` join table is introduced for proper multi-role support with audit history. An admin panel at `/admin` is protected by Next.js middleware and reached via a link on the user's profile page.

---

## 1. Database

### `UserRole` model

Replaces any future single-field role approach. Supports multiple roles per user with a full audit trail.

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
```

`User` gains two new relations:

```prisma
roles        UserRole[] @relation("UserRoles")
rolesGranted UserRole[] @relation("GrantedRoles")
```

### `FeaturedGuide` model

One row per featured guide, ordered by `position`.

```prisma
model FeaturedGuide {
  id      String   @id @default(cuid())
  guideId String   @unique
  position Int
  addedAt DateTime @default(now())

  guide Guide @relation(fields: [guideId], references: [id], onDelete: Cascade)

  @@index([position])
}
```

`Guide` gains: `featuredGuide FeaturedGuide?`

### `GuideCredit` model

One row per credited social handle per guide, ordered by `position`.

```prisma
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

`Guide` gains: `credits GuideCredit[]`

---

## 2. Auth & Middleware

### Session

The `session` callback in `apps/web/src/lib/auth.ts` is extended to load the user's roles on every sign-in:

```typescript
async session({ session, user }) {
  if (session.user) {
    session.user.id = user.id
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      include: { roles: true },
    })
    session.user.roles = dbUser?.roles.map((r) => r.role) ?? []
    // existing steamId / avatar / name backfill ...
  }
  return session
}
```

NextAuth types are augmented in `apps/web/src/types/next-auth.d.ts`:

```typescript
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      steamId?: string
      roles: string[]
    } & DefaultSession['user']
  }
}
```

### Middleware

`apps/web/src/middleware.ts` intercepts all `/admin/*` requests. If the session is missing or `roles` does not include `"admin"`, it redirects to `/`:

```typescript
export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: ['/admin/:path*'],
}
```

The middleware wraps the `auth` export from `@/lib/auth`. Because the app uses database sessions (PrismaAdapter), `req.auth?.user?.roles` is available in the middleware callback after the session callback runs. If the roles array does not include `"admin"`, the middleware returns a redirect to `/`.

### Role helpers

`apps/web/src/lib/roles.ts`:

```typescript
export function hasRole(session: Session | null, role: string): boolean {
  return session?.user?.roles?.includes(role) ?? false
}

export function requireRole(session: Session | null, role: string): void {
  if (!hasRole(session, role)) redirect('/')
}
```

---

## 3. Admin Panel Shell

### Route group

```text
apps/web/src/app/(admin)/
  layout.tsx          — header + horizontal tab bar
  admin/
    page.tsx          — redirects to /admin/featured
    featured/
      page.tsx        — Featured Guides management
    users/
      page.tsx        — User role management
```

### Layout

Server component. Calls `auth()` and `requireRole(session, 'admin')` at the top as a safety net behind the middleware. Renders:

- Top header: CS2 Annotations brand (left), signed-in admin name + avatar (right)
- Horizontal tab bar below header with tabs: **Featured Guides** (`/admin/featured`) and **Users** (`/admin/users`)
- `{children}` below

The tab bar is a small `"use client"` component that uses `usePathname()` to highlight the active tab with a violet underline.

### Entry point

The profile edit page (`/profile/edit`) conditionally renders an "Admin panel →" link when `session.user.roles.includes('admin')`. No role check is added to the community nav layout.

---

## 4. Featured Guides Management (`/admin/featured`)

### Featured list layout

A vertical list of featured guide cards, each showing:

- Map chip (colored accent, same pattern as the rest of the app)
- Guide title + author username
- Credits chips (handle + inferred icon)
- Drag handle (left edge)
- Remove button (right edge)

An **"Add featured guide"** button above the list opens a modal guide browser.

### Drag-to-reorder

Uses `@dnd-kit/core` and `@dnd-kit/sortable`. Dropping a card fires a server action `reorderFeaturedGuides(orderedIds: string[])` that writes new `position` values in a single transaction. The list is optimistically reordered on drop for instant feedback.

### Guide browser modal

A full-screen modal with:

- `MapFilterBar` (same component already in the app)
- `SearchInput` with debounce
- Paginated grid of public guides (24 per page), same card style as Browse
- Clicking a guide calls server action `addFeaturedGuide(guideId)`, appends it at the end of the list (position = current max + 1), closes the modal

A guide already in the featured list is shown as disabled in the browser.

### Credits editing

Each card has an inline collapsible "Credits" section. It shows existing credits as chips. An **"Add credit"** row appends a new entry with:

- `handle` text input (required)
- `label` text input (optional display name override)

Credits within a card are draggable for reordering using the same `@dnd-kit/sortable` setup. A save button per card fires server action `updateGuideCredits(guideId, credits[])` that replaces all credits for that guide atomically.

### Removing a featured guide

A "Remove" button on each card fires server action `removeFeaturedGuide(guideId)` which deletes the `FeaturedGuide` row. Positions of remaining items are reindexed.

---

## 5. User Role Management (`/admin/users`)

A search input (debounced, queries by username or Steam handle). Results render as a user list, each row showing:

- Avatar + username
- Current roles as badges
- "Grant role" dropdown (shows roles not yet held: `admin`, etc.)
- "Revoke" button per existing role badge

Server actions:

- `grantRole(userId, role)` — creates a `UserRole` row with `grantedById = session.user.id`
- `revokeRole(userId, role)` — deletes the matching `UserRole` row

Admins cannot revoke their own admin role (guarded in the server action).

---

## 6. Credits Display

### Web — guide detail page

Credits render below the author line on `/guides/[id]` as a row of chips: `[icon] label-or-handle`. Included in the existing guide detail query via `include: { credits: { orderBy: { position: 'asc' } } }`.

**Icon inference** (matched in order):

| Handle pattern | Icon |
| --- | --- |
| contains `twitch.tv` | Twitch |
| contains `youtube.com` or `youtu.be` | YouTube |
| contains `twitter.com`, `x.com`, or starts with `@` | X / Twitter |
| contains `steamcommunity.com` | Steam |
| anything else | generic person |

Icons are inline SVG components sourced from `simple-icons`. If the handle looks like a URL (`http://` or contains `.com`), the chip is an `<a>` link. Plain `@handle` strings are non-clickable text.

### Desktop — featured guide list

Each featured guide row in `Guides.tsx` shows a small credit line below the guide name: `"by @handle, @handle"`. Credits come from the `useFeaturedGuides` hook response and are never stored in the raw `.txt` annotation file — this is an accepted limitation.

---

## 7. Desktop Consumption

### API endpoint

`GET /api/featured-guides` — public, no auth. Returns the ordered featured list:

```typescript
{
  guides: Array<{
    id: string          // Guide.id (cloud id)
    title: string
    map: string | null
    nodeCount: number
    credits: Array<{ handle: string; label: string | null }>
  }>
}
```

A second endpoint `GET /api/featured-guides/[id]/blob` returns a short-lived redirect to the Vercel Blob URL for the guide's content. Public, no auth (guide is already public).

### `useFeaturedGuides` hook

`apps/desktop/src/hooks/useFeaturedGuides.ts` — fetches the API on app start, stores the result in state. Exposed to `Guides.tsx` via props from `App.tsx` (same pattern as `useCloudStatus`).

### Replacing `FEATURED_IDS`

The hardcoded `FEATURED_IDS` set and workshop-based matching logic are removed from `Guides.tsx`. Featured guides are now identified by their cloud `guideId`. For each entry returned by the API, the desktop checks `electron-store` for a matching `cloudId:*` entry — if found, the guide is installed and opens normally. If not, a "Fork" button is shown.

### Fork action

1. User clicks "Fork" on an uninstalled featured guide
2. IPC handler `featuredFork(guideId, title)` is called in the main process
3. Main process calls `GET /api/featured-guides/[id]/blob`, follows the redirect, downloads the KV3 content
4. Writes the content as a new local guide file in the user's annotations folder under a sanitised filename derived from `title`
5. Stores `cloudId:<localPath> = guideId` in electron-store so the guide is recognised as installed on next launch
6. `useFeaturedGuides` and `useCloudStatus` both refresh — the guide appears installed with its cloud sync status

---

## 8. Out of Scope

- Curation workflow notifications (e.g. notifying a guide author that their guide was featured)
- Public-facing "Featured" badge on guide cards in Browse (can be added later using the `featuredGuide` relation)
- Admin audit log UI (the `grantedAt` / `grantedById` data is stored; a log view is a future tab)
- Conflict resolution if the forked guide diverges from the featured version
