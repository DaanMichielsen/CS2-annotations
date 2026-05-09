# Filters, Pagination & Grenade Library — Design Spec
**Date:** 2026-05-10  
**Status:** Approved  

---

## Overview

Three independent scopes of work, to be planned and implemented in order:

| Scope | Summary | Complexity |
|---|---|---|
| A | Browse & My Guides filter polish | Low |
| B | Desktop throw type inference & keyword reference | Medium |
| C | Grenade Library — cron indexer + new page | High |

---

## Scope A — Browse & My Guides Filter Improvements

### Goals
- Both the Browse page and My Guides page get consistent, usable filters.
- Filters are visually rich (map icons) and easy to clear (X on search).
- Large guide lists are navigable via traditional pagination.

### Map Filter Buttons
- Existing `Link` buttons on the Browse page are extended to My Guides page.
- Each map button renders a small map thumbnail icon (`/public/map-icons/{mapname}.png`, 20×20 px, rounded) left of the map name label.
- The "All maps" button gets no icon.
- Active state: violet background (`bg-violet-600`), white text. Inactive: zinc border.
- Component is extracted to a shared `MapFilterBar` component used by both pages.

### Name Search with X Button
- Browse page already has `?q=` search; My Guides page gets the same.
- Both pages become client components to support controlled input state.
- Implementation:
  - Controlled `<input>` bound to local state.
  - 300 ms debounce before updating the `?q=` URL param via `router.push`.
  - When the field has a value, an `×` icon button appears at the right edge of the input and clears both local state and the URL param on click.
- The search filter is applied server-side via Prisma `{ title: { contains: q, mode: 'insensitive' } }`.

### Traditional Pagination
- Server reads `?page=` param (default 1). Page size: 24.
- Prisma query: `skip = (page - 1) * 24`, `take = 24`.
- A `count()` query runs alongside to get the total for computing page count.
- Footer pagination component:
  - `← Prev` (disabled on page 1) | page number buttons | `Next →` (disabled on last page).
  - For more than 5 pages: show first, last, current ± 1, and ellipsis gaps.
  - All pagination links are `<Link>` elements preserving existing filter params.
- My Guides page gets the same pagination footer.

### No Throw Type Filter at Guide Level
- A guide is a collection of lineups with mixed throw types. Filtering the guide list by throw type would return misleading results.
- Throw type filtering is reserved for Scope C (Grenade Library and individual guide detail).

---

## Scope B — Desktop Throw Type Inference & Reference Panel

### Goals
- `inferThrowType` correctly identifies all common human spellings of throw type keywords.
- Users creating annotations have an in-app reference for which keywords trigger which throw type.

### Expanded Keyword Matching (`packages/shared/src/annotation/inferUtils.ts`)

Rewrite `inferThrowType` as a priority-ordered regex table. Rules apply top-to-bottom; first match wins. Raw input is lowercased concatenation of `Desc.Text` and `Title.Text`.

| Priority | ThrowType | Matched patterns (case-insensitive) |
|---|---|---|
| 1 | `m1m2_jump` | `m1\+m2`, `m1m2`, `lmb\+rmb`, `lmb rmb`, `left\+right`, `left right click`, `both clicks`, `both mouse` |
| 2 | `m2_jump` | `m2.{0,10}jump`, `jump.{0,10}m2`, `m2jt`, `rmb jump`, `rmb jt`, `right click jump` |
| 3 | `m2` | `\bm2\b`, `\brmb\b`, `right click`, `rclick`, `right mouse` |
| 4 | `w_jump` | `w[-+\s]jump`, `w[-+\s]jt`, `wjump`, `w\+space`, `w jumpthrow`, `w-jumpthrow` |
| 5 | `crouch_jump` | `crouch`, `\bduck\b`, `\bcjt\b`, `crouch jump`, `crouch jt` |
| 6 | `run_jump` | `run.{0,12}jump`, `jump.{0,12}run`, `runjump`, `run-jump`, `\brjt\b`, `running jump` |
| 7 | `stand_jump` | `jumpthrow`, `jthrow`, `j-throw`, `j throw`, `\bjt\b`, `jump throw`, `jump-throw`, `standing jump`, `stand jt` |
| 8 | `run` | `\brun\b`, `running`, `runthrow`, `run throw`, `run-throw` |
| 9 | `walk` | `\bwalk\b`, `walking`, `walkthrow`, `walk throw`, `walk-throw` |
| 10 | `stand` | `\bstand\b`, `standing`, `static`, `regular`, `normal` |
| 11 | `other` | fallthrough |

**Notes:**
- M2 variants are checked before M1+M2 to avoid false positives; M1+M2 is checked first within that group.
- `\bjt\b` (word-boundary `jt`) only matches in priority 7 so it doesn't trigger inside words like `"wjt"` (caught by priority 4).
- `lmb` alone (left mouse button only) has no dedicated throw type — it is a stand throw by default; no explicit rule needed.
- The existing `ThrowType` enum values are unchanged; only the detection logic expands.

### Keyword Reference Panel (`apps/desktop/src/components/AnnotationCreateModal.tsx`)

- Added directly below the label/description fields in the grenade creation form.
- Trigger: a small `ⓘ Throw type keywords` text button. Uses a native `<details>`/`<summary>` element for zero-JS accordion behavior.
- When expanded, shows a compact two-column table:

  | Throw type | Example keywords |
  |---|---|
  | Stand (default) | stand, standing, regular, normal |
  | Walk throw | walk, walkthrow, walk throw |
  | Run throw | run, runthrow, run throw |
  | Jumpthrow | jumpthrow, jthrow, jt, jump throw |
  | W-Jumpthrow | w-jump, w+jump, w-jt, w+space |
  | Crouch Jumpthrow | crouch, duck, cjt, crouch jump |
  | Run Jumpthrow | run jump, runjump, rjt |
  | M2 throw | m2, rmb, right click, rclick |
  | M2 Jumpthrow | m2 jump, m2jt, rmb jump |
  | M1+M2 Jumpthrow | m1+m2, m1m2, lmb+rmb, both clicks |

- Styled to match the existing zinc dark theme. No interactive behavior beyond expand/collapse.
- The panel is read-only; it does not pre-fill fields.

---

## Scope C — Grenade Library

### Goals
- All grenade lineups from public guides are searchable in one place.
- Filters: map, grenade type, throw type, name/position search.
- The same throw type filter is available inside individual guide detail views.
- Data stays fresh via a scheduled cron job that processes only changed public guides.

### DB Schema — `GrenadeEntry` model

Add to `apps/web/prisma/schema.prisma`:

```prisma
model GrenadeEntry {
  id          String   @id @default(cuid())
  guideId     String
  nodeId      String
  map         String
  grenadeType String   // smoke | flash | he | molotov | incendiary | decoy
  throwType   String   // ThrowType enum value as string
  posLabel    String?  // Desc.Text of the standing position node
  aimLabel    String?  // Title.Text / aim instruction of the main node
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  guide Guide @relation(fields: [guideId], references: [id], onDelete: Cascade)

  @@unique([guideId, nodeId])
  @@index([map])
  @@index([throwType])
  @@index([grenadeType])
}
```

Also add a `CronState` model to track the indexer cursor:

```prisma
model CronState {
  key       String   @id   // e.g. "grenade-indexer"
  value     String         // ISO timestamp of last processed updatedAt
  updatedAt DateTime @updatedAt
}
```

Add `grenadeEntries GrenadeEntry[]` relation to the `Guide` model.

### Cron Indexer (`apps/web/src/app/api/cron/index-grenades/route.ts`)

**Authentication:** Bearer token from `CRON_SECRET` env var. Vercel cron supplies this automatically when configured in `vercel.json`.

**Schedule:** Every 5 minutes (`"*/5 * * * *"` in `vercel.json` crons config).

**Algorithm:**
1. Read `CronState` row with key `"grenade-indexer"`. If absent, default cursor to epoch.
2. **Clean up newly-private guides:** query `Guide` rows where `isPublic = false` AND `updatedAt > cursor`. For each, delete all `GrenadeEntry` rows with that `guideId`. (Cascade delete on the FK only fires when the Guide row itself is deleted, not on `isPublic` changes — explicit cleanup is required.)
3. **Index new/updated public guides:** query `Guide` rows where `isPublic = true` AND `updatedAt > cursor`, ordered by `updatedAt ASC`, batched 50 at a time.
4. For each guide:
   a. Fetch the blob from KV storage using `blobKey`.
   b. Parse the KV3 JSON. Extract all nodes where `kind === 'grenade'`.
   c. For each grenade node, run `inferThrowType(node)` from the shared package.
   d. Upsert into `GrenadeEntry` on `[guideId, nodeId]` unique constraint, updating all fields.
5. After processing all guides in the batch, advance the cursor to the `updatedAt` of the last processed guide (across both private cleanup and public indexing).
6. Return `{ processed: N, cleaned: M }` JSON on success.

**Only public guides are indexed.** Private guides (`isPublic = false`) are never fetched or processed.

**Error handling:** Any parse/fetch failure for a single guide is caught and logged; the indexer continues with remaining guides and still advances the cursor past successfully processed guides.

### `/library` Page (`apps/web/src/app/(community)/library/page.tsx`)

**Filters (all URL params, server-side):**
- `?map=` — same `MapFilterBar` component from Scope A (with icons)
- `?type=` — grenade type chip row: All | 💨 Smoke | ⚡ Flash | 💣 HE | 🔥 Molotov | 🎭 Decoy (icon + label)
- `?throw=` — throw type text pills: All | Stand | Walk | Run | Jumpthrow | W-Jump | Crouch JT | Run JT | M2 | M2 JT | M1+M2 JT
- `?q=` — name/position search with X button (same pattern as Scope A)

**Results grid:**
- 24 per page, traditional pagination (same footer component as Scope A).
- Each card shows: grenade type icon, map chip, position label, aim label (truncated), throw type badge, link to parent guide ("View guide →").

**Prisma query:**
```typescript
where: {
  ...(map ? { map } : {}),
  ...(type ? { grenadeType: type } : {}),
  ...(throwParam ? { throwType: throwParam } : {}),
  ...(q ? {
    OR: [
      { posLabel: { contains: q, mode: 'insensitive' } },
      { aimLabel: { contains: q, mode: 'insensitive' } },
    ]
  } : {}),
}
```

**Navigation:** Add "Library" link to the community nav alongside Browse and My Guides.

### Throw Type Filter on Individual Guide Detail View

- The existing guide detail page renders a flat list or map of all lineup nodes.
- A filter bar is added at the top of the lineup list: throw type text pills + grenade type icons (same components, client-side state).
- Filtering is done client-side (the full guide blob is already loaded); no server round-trip.
- Active filters are not persisted to the URL on the detail page (client-only state is sufficient).

---

## Implementation Order

1. **Scope B first** — `inferUtils.ts` changes are in the shared package and unblock correct throw type data for Scope C's indexer. The reference panel is self-contained in the desktop modal.
2. **Scope A second** — standalone web polish, no DB migration needed.
3. **Scope C last** — depends on Scope B's inference being correct, and requires the DB migration + cron setup.

---

## Files Touched (summary)

| File | Change |
|---|---|
| `packages/shared/src/annotation/inferUtils.ts` | Rewrite `inferThrowType` with expanded regex table |
| `apps/desktop/src/components/AnnotationCreateModal.tsx` | Add keyword reference `<details>` panel |
| `apps/web/src/app/(community)/guides/page.tsx` | Add name search X button, pagination, extract MapFilterBar |
| `apps/web/src/app/(community)/my-guides/page.tsx` | Add MapFilterBar, name search with X, pagination |
| `apps/web/src/components/MapFilterBar.tsx` | New shared component |
| `apps/web/src/components/PaginationFooter.tsx` | New shared component |
| `apps/web/prisma/schema.prisma` | Add `GrenadeEntry`, `CronState` models |
| `apps/web/src/app/api/cron/index-grenades/route.ts` | New cron route handler |
| `apps/web/src/app/(community)/library/page.tsx` | New Grenade Library page |
| `apps/web/vercel.json` | Add cron schedule entry |
| `.gitignore` | Add `.superpowers/` |
