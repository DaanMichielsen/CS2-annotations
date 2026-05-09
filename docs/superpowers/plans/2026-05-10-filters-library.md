# Filters, Pagination & Grenade Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve web filtering on Browse and My Guides pages (map icons, name search with X, pagination), expand throw type inference in the shared package with a desktop keyword reference panel, and build a Grenade Library feature (cron indexer, `/library` page, per-guide filters).

**Architecture:** Three independent phases executed in order — Scope B (shared package + desktop) first because the cron indexer depends on correct inference, then Scope A (web polish, no DB changes), then Scope C (schema migration, cron, library page). Each phase is independently shippable.

**Tech Stack:** TypeScript, Next.js 15 App Router (server components + client islands), Prisma + PostgreSQL, Vercel Blob, vitest (shared package tests), Tailwind CSS.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `packages/shared/src/annotation/inferUtils.ts` | Rewritten `inferThrowType` with expanded regex table |
| Create | `packages/shared/src/annotation/inferUtils.test.ts` | Unit tests for every throw type pattern |
| Modify | `apps/desktop/src/components/AnnotationCreateModal.tsx` | Add keyword reference `<details>` panel after aim instruction field |
| Create | `apps/web/src/components/MapFilterBar.tsx` | Shared map filter bar with thumbnail icons |
| Create | `apps/web/src/components/PaginationFooter.tsx` | Shared pagination footer (prev/next + page numbers) |
| Create | `apps/web/src/components/SearchInput.tsx` | Client search input with debounce + X clear button |
| Modify | `apps/web/src/app/(community)/guides/page.tsx` | Add SearchInput, MapFilterBar, PaginationFooter |
| Modify | `apps/web/src/app/(community)/my-guides/page.tsx` | Add searchParams, MapFilterBar, SearchInput, PaginationFooter |
| Modify | `apps/web/prisma/schema.prisma` | Add `GrenadeEntry` and `CronState` models |
| Create | `apps/web/src/app/api/cron/index-grenades/route.ts` | Cron handler: clean private + index public guide blobs |
| Create | `apps/web/src/components/ThrowTypeFilterBar.tsx` | Server component: throw type text-pill links |
| Create | `apps/web/src/components/GrenadeTypeFilterBar.tsx` | Server component: grenade type icon+label links |
| Create | `apps/web/src/app/(community)/library/page.tsx` | Grenade Library page with all four filters + pagination |
| Create | `apps/web/src/components/GuideNodeFilter.tsx` | Client component: wraps GuideAnnotationPreview with client-side throw/nade type filters |
| Modify | `apps/web/src/app/(community)/guides/[id]/page.tsx` | Replace bare GuideAnnotationPreview with GuideNodeFilter |
| Modify | `apps/web/src/app/(community)/layout.tsx` | Add Library nav link |
| Modify | `apps/web/vercel.json` | Add cron schedule entry |

---

## Phase 1 — Scope B: Inference & Desktop Reference Panel

### Task 1: Write failing tests for `inferThrowType`

**Files:**
- Create: `packages/shared/src/annotation/inferUtils.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// packages/shared/src/annotation/inferUtils.test.ts
import { describe, it, expect } from 'vitest'
import { inferThrowType } from './inferUtils'
import type { AnnotationNode } from './types'

function node(desc: string, title = ''): AnnotationNode {
  return { Desc: { Text: desc }, Title: { Text: title } } as unknown as AnnotationNode
}

describe('inferThrowType', () => {
  describe('m1m2_jump', () => {
    it('detects m1+m2', () => expect(inferThrowType(node('m1+m2'))).toBe('m1m2_jump'))
    it('detects m1m2', () => expect(inferThrowType(node('m1m2'))).toBe('m1m2_jump'))
    it('detects lmb+rmb', () => expect(inferThrowType(node('lmb+rmb'))).toBe('m1m2_jump'))
    it('detects both clicks', () => expect(inferThrowType(node('both clicks'))).toBe('m1m2_jump'))
    it('detects both mouse', () => expect(inferThrowType(node('both mouse'))).toBe('m1m2_jump'))
  })

  describe('m2_jump', () => {
    it('detects m2 jump', () => expect(inferThrowType(node('m2 jump'))).toBe('m2_jump'))
    it('detects m2jt',   () => expect(inferThrowType(node('m2jt'))).toBe('m2_jump'))
    it('detects m2 jt',  () => expect(inferThrowType(node('m2 jt'))).toBe('m2_jump'))
    it('detects rmb jump', () => expect(inferThrowType(node('rmb jump'))).toBe('m2_jump'))
    it('detects rmb jt',   () => expect(inferThrowType(node('rmb jt'))).toBe('m2_jump'))
    it('detects right click jump', () => expect(inferThrowType(node('right click jump'))).toBe('m2_jump'))
  })

  describe('m2', () => {
    it('detects m2',          () => expect(inferThrowType(node('standing m2 throw'))).toBe('m2'))
    it('detects rmb',         () => expect(inferThrowType(node('rmb throw'))).toBe('m2'))
    it('detects right click', () => expect(inferThrowType(node('right click'))).toBe('m2'))
    it('detects rclick',      () => expect(inferThrowType(node('rclick'))).toBe('m2'))
    it('detects right mouse', () => expect(inferThrowType(node('right mouse'))).toBe('m2'))
  })

  describe('w_jump', () => {
    it('detects w-jump',      () => expect(inferThrowType(node('w-jump'))).toBe('w_jump'))
    it('detects w+jump',      () => expect(inferThrowType(node('w+jump'))).toBe('w_jump'))
    it('detects w jump',      () => expect(inferThrowType(node('w jump'))).toBe('w_jump'))
    it('detects wjump',       () => expect(inferThrowType(node('wjump'))).toBe('w_jump'))
    it('detects w-jt',        () => expect(inferThrowType(node('w-jt'))).toBe('w_jump'))
    it('detects w jt',        () => expect(inferThrowType(node('w jt'))).toBe('w_jump'))
    it('detects wjt',         () => expect(inferThrowType(node('wjt'))).toBe('w_jump'))
    it('detects w+space',     () => expect(inferThrowType(node('w+space'))).toBe('w_jump'))
    it('detects w jumpthrow', () => expect(inferThrowType(node('w jumpthrow'))).toBe('w_jump'))
    it('detects W-Jumpthrow from title', () =>
      expect(inferThrowType(node('', 'standing W-Jumpthrow'))).toBe('w_jump'))
  })

  describe('crouch_jump', () => {
    it('detects crouched',    () => expect(inferThrowType(node('crouched jumpthrow'))).toBe('crouch_jump'))
    it('detects crouch jump', () => expect(inferThrowType(node('crouch jump'))).toBe('crouch_jump'))
    it('detects duck',        () => expect(inferThrowType(node('duck jump'))).toBe('crouch_jump'))
    it('detects cjt',         () => expect(inferThrowType(node('cjt'))).toBe('crouch_jump'))
  })

  describe('run_jump', () => {
    it('detects run jump',          () => expect(inferThrowType(node('run jump'))).toBe('run_jump'))
    it('detects run jt',            () => expect(inferThrowType(node('run jt'))).toBe('run_jump'))
    it('detects runjump',           () => expect(inferThrowType(node('runjump'))).toBe('run_jump'))
    it('detects rjt',               () => expect(inferThrowType(node('rjt'))).toBe('run_jump'))
    it('detects running jumpthrow', () => expect(inferThrowType(node('running jumpthrow'))).toBe('run_jump'))
    it('detects running jump',      () => expect(inferThrowType(node('running jump'))).toBe('run_jump'))
  })

  describe('stand_jump', () => {
    it('detects jumpthrow',    () => expect(inferThrowType(node('jumpthrow'))).toBe('stand_jump'))
    it('detects jthrow',       () => expect(inferThrowType(node('jthrow'))).toBe('stand_jump'))
    it('detects jt alone',     () => expect(inferThrowType(node('jt'))).toBe('stand_jump'))
    it('detects j-throw',      () => expect(inferThrowType(node('j-throw'))).toBe('stand_jump'))
    it('detects jump throw',   () => expect(inferThrowType(node('jump throw'))).toBe('stand_jump'))
    it('detects standing jump',() => expect(inferThrowType(node('standing jump'))).toBe('stand_jump'))
    it('detects stand jt',     () => expect(inferThrowType(node('stand jt'))).toBe('stand_jump'))
  })

  describe('run', () => {
    it('detects running throw', () => expect(inferThrowType(node('running throw'))).toBe('run'))
    it('detects runthrow',      () => expect(inferThrowType(node('runthrow'))).toBe('run'))
    it('detects run throw',     () => expect(inferThrowType(node('run throw'))).toBe('run'))
  })

  describe('walk', () => {
    it('detects walking throw', () => expect(inferThrowType(node('walking throw'))).toBe('walk'))
    it('detects walkthrow',     () => expect(inferThrowType(node('walkthrow'))).toBe('walk'))
    it('detects walk throw',    () => expect(inferThrowType(node('walk throw'))).toBe('walk'))
  })

  describe('stand', () => {
    it('detects standing',() => expect(inferThrowType(node('standing throw'))).toBe('stand'))
    it('detects static',  () => expect(inferThrowType(node('static'))).toBe('stand'))
    it('detects regular', () => expect(inferThrowType(node('regular throw'))).toBe('stand'))
    it('detects normal',  () => expect(inferThrowType(node('normal'))).toBe('stand'))
    it('detects lmb',     () => expect(inferThrowType(node('lmb throw'))).toBe('stand'))
    it('detects left click', () => expect(inferThrowType(node('left click'))).toBe('stand'))
  })

  describe('other', () => {
    it('returns other for unrecognized text', () => expect(inferThrowType(node('from banana'))).toBe('other'))
    it('returns other for empty node',        () => expect(inferThrowType(node(''))).toBe('other'))
  })

  describe('priority ordering', () => {
    it('m1m2 beats m2',        () => expect(inferThrowType(node('m1+m2 jumpthrow'))).toBe('m1m2_jump'))
    it('m2_jump beats m2',     () => expect(inferThrowType(node('standing m2 jumpthrow'))).toBe('m2_jump'))
    it('run_jump beats run',   () => expect(inferThrowType(node('running jumpthrow'))).toBe('run_jump'))
    it('run_jump beats stand_jump', () => expect(inferThrowType(node('run jump'))).toBe('run_jump'))
    it('w_jump: "w jt" does not bleed into stand_jump', () =>
      expect(inferThrowType(node('w jt'))).toBe('w_jump'))
    it('m2_jump: "m2 jt" does not bleed into stand_jump', () =>
      expect(inferThrowType(node('m2 jt'))).toBe('m2_jump'))
    it('crouch_jump: "crouch jt" does not bleed into stand_jump', () =>
      expect(inferThrowType(node('crouch jt'))).toBe('crouch_jump'))
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/shared && npx vitest run src/annotation/inferUtils.test.ts
```

Expected: multiple failures on patterns not yet in the inference function.

- [ ] **Step 3: Commit the test file**

```bash
git add packages/shared/src/annotation/inferUtils.test.ts
git commit -m "test(shared): add comprehensive inferThrowType test suite"
```

---

### Task 2: Rewrite `inferThrowType` to pass all tests

**Files:**
- Modify: `packages/shared/src/annotation/inferUtils.ts:68-94`

- [ ] **Step 1: Replace the `inferThrowType` function body**

Replace lines 68–94 in `packages/shared/src/annotation/inferUtils.ts`:

```typescript
export function inferThrowType(node: AnnotationNode): ThrowType {
  const raw = ((node.Desc?.Text ?? '') + ' ' + (node.Title?.Text ?? '')).toLowerCase()

  // M1+M2 (always treated as jumpthrow in CS2; check before M2-only patterns)
  if (/m1[+\s]m2|m1m2|\blmb[+\s]rmb\b|left[+\s]right\s*click|both\s+clicks|both\s+mouse/.test(raw))
    return 'm1m2_jump'

  // M2 + jump (before plain M2 so "m2 jump" doesn't match \bm2\b first)
  if (/m2\s*jump|m2\s*jt\b|jump.{0,10}m2|\brmb\s+jump|\brmb\s*jt\b|right\s*click\s*jump/.test(raw))
    return 'm2_jump'

  // M2 only
  if (/\bm2\b|\brmb\b|right\s*click|\brclick\b|right\s*mouse/.test(raw))
    return 'm2'

  // W-Jumpthrow (check before plain jump so "w-jt" doesn't fall to stand_jump via \bjt\b)
  if (/w[-+\s]jump|w[-+\s]jt\b|\bwjump\b|\bwjt\b|w[+\s]space|w\s+jumpthrow|w-jumpthrow/.test(raw))
    return 'w_jump'

  // Crouched jumpthrow
  if (/crouch|\bduck\b|\bcjt\b/.test(raw))
    return 'crouch_jump'

  // Running jumpthrow (check before plain jump AND before plain run)
  if (/run\s*jt\b|run.{0,12}jump|jump.{0,12}run|\brunjump\b|run-jump|\brjt\b|running\s+jump/.test(raw))
    return 'run_jump'

  // Standing jumpthrow (\bjt\b is safe here — w_jump, m2_jump, run_jump are all caught above)
  if (/jumpthrow|\bjthrow\b|j-throw|\bj\s+throw\b|\bjt\b|jump\s+throw|jump-throw|standing\s+jump|stand\s+jt/.test(raw))
    return 'stand_jump'

  // Ground movement (no jump)
  if (/\brun\b|running|\brunthrow\b|run\s+throw|run-throw/.test(raw)) return 'run'
  if (/\bwalk\b|walking|\bwalkthrow\b|walk\s+throw|walk-throw/.test(raw)) return 'walk'

  // Explicit stand / left-click — lmb with no other modifier is a standing throw
  if (/\bstand\b|standing|static|regular|normal|\blmb\b|left\s*click|\blclick\b|left\s*mouse/.test(raw))
    return 'stand'

  return 'other'
}
```

- [ ] **Step 2: Run the tests to confirm all pass**

```bash
cd packages/shared && npx vitest run src/annotation/inferUtils.test.ts
```

Expected: all tests pass with 0 failures.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/annotation/inferUtils.ts
git commit -m "feat(shared): expand inferThrowType keyword coverage (rmb, lmb, wjt, rjt, etc.)"
```

---

### Task 3: Add keyword reference panel to `AnnotationCreateModal`

**Files:**
- Modify: `apps/desktop/src/components/AnnotationCreateModal.tsx:329-334`

The aim instruction field ends at line 333 and `<ColorPicker />` is at line 334. The reference panel goes between them, inside the `kind === 'grenade'` block.

- [ ] **Step 1: Insert the `<details>` panel after the aim instruction `<div>` and before `<ColorPicker />`**

In `apps/desktop/src/components/AnnotationCreateModal.tsx`, find this block:

```tsx
              <div>
                <label className={labelCls}>Aim instruction <span className={hintCls}>(auto-applied on save)</span></label>
                <input type="text" className={inputCls} placeholder='e.g. "standing W-Jumpthrow"'
                  value={aimText} onChange={(e) => setAimText(e.target.value)} />
              </div>
              <ColorPicker />
```

Replace with:

```tsx
              <div>
                <label className={labelCls}>Aim instruction <span className={hintCls}>(auto-applied on save)</span></label>
                <input type="text" className={inputCls} placeholder='e.g. "standing W-Jumpthrow"'
                  value={aimText} onChange={(e) => setAimText(e.target.value)} />
              </div>
              <details className="group">
                <summary className="text-[0.68rem] text-zinc-500 cursor-pointer hover:text-zinc-300 select-none list-none flex items-center gap-1">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                  ⓘ Throw type keywords
                </summary>
                <div className="mt-2 border border-zinc-800 rounded-lg p-3 text-[0.67rem] text-zinc-400">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-zinc-600 text-left border-b border-zinc-800">
                        <th className="pb-1 pr-3 font-medium">Type</th>
                        <th className="pb-1 font-medium">Example keywords</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Stand (default)', 'stand, standing, regular, normal, lmb, left click'],
                        ['Walk throw',      'walk, walkthrow, walk throw'],
                        ['Run throw',       'run, runthrow, run throw'],
                        ['Jumpthrow',       'jumpthrow, jthrow, jt, jump throw, j-throw'],
                        ['W-Jumpthrow',     'w-jump, w+jump, wjump, wjt, w-jt, w+space'],
                        ['Crouch JT',       'crouch, duck, cjt, crouch jump'],
                        ['Run JT',          'run jump, runjump, run jt, rjt'],
                        ['M2 throw',        'm2, rmb, right click, rclick'],
                        ['M2 Jumpthrow',    'm2 jump, m2jt, m2 jt, rmb jump'],
                        ['M1+M2 JT',        'm1+m2, m1m2, lmb+rmb, both clicks'],
                      ].map(([type, keywords]) => (
                        <tr key={type} className="border-b border-zinc-800/50 last:border-0">
                          <td className="py-0.5 pr-3 text-zinc-300 whitespace-nowrap">{type}</td>
                          <td className="py-0.5 text-zinc-500">{keywords}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <ColorPicker />
```

- [ ] **Step 2: Build the desktop app and verify the panel renders**

```bash
cd apps/desktop && npm run dev
```

Open the Create Annotation modal, select "Grenade", and confirm the "ⓘ Throw type keywords" accordion appears below the Aim instruction field and expands/collapses correctly.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/AnnotationCreateModal.tsx
git commit -m "feat(desktop): add throw type keyword reference panel to annotation create modal"
```

---

## Phase 2 — Scope A: Web Filter Components

### Task 4: Create `MapFilterBar` component

**Files:**
- Create: `apps/web/src/components/MapFilterBar.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/web/src/components/MapFilterBar.tsx
import Image from 'next/image'
import Link from 'next/link'
import { KNOWN_MAPS, getMapColor, getMapLabel } from '@/lib/mapColors'

interface MapFilterBarProps {
  activeMap: string | null | undefined
  buildHref: (map: string | null) => string
}

const pillBase = 'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors'
const pillActive = 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
const pillInactive = 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'

export function MapFilterBar({ activeMap, buildHref }: MapFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={buildHref(null)} className={`${pillBase} ${!activeMap ? pillActive : pillInactive}`}>
        All maps
      </Link>
      {KNOWN_MAPS.map((m) => {
        const { icon } = getMapColor(m)
        return (
          <Link
            key={m}
            href={buildHref(m)}
            className={`${pillBase} ${activeMap === m ? pillActive : pillInactive}`}
          >
            {icon && (
              <Image src={icon} alt="" width={14} height={14} className="rounded-sm opacity-80" unoptimized />
            )}
            {getMapLabel(m)}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/MapFilterBar.tsx
git commit -m "feat(web): add MapFilterBar component with map thumbnail icons"
```

---

### Task 5: Create `PaginationFooter` component

**Files:**
- Create: `apps/web/src/components/PaginationFooter.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/web/src/components/PaginationFooter.tsx
import Link from 'next/link'

function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

interface PaginationFooterProps {
  currentPage: number
  totalPages: number
  createHref: (page: number) => string
}

export function PaginationFooter({ currentPage, totalPages, createHref }: PaginationFooterProps) {
  if (totalPages <= 1) return null
  const pages = getPageRange(currentPage, totalPages)
  const base = 'text-xs px-2.5 py-1.5 rounded transition-colors'
  const active = 'bg-violet-600 text-white font-semibold'
  const inactive = 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
  const disabled = 'text-zinc-700 pointer-events-none'

  return (
    <nav className="flex items-center justify-center gap-1 mt-10" aria-label="Pagination">
      <Link
        href={createHref(currentPage - 1)}
        className={`${base} ${currentPage <= 1 ? disabled : inactive}`}
        aria-disabled={currentPage <= 1}
      >
        ← Prev
      </Link>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="text-xs text-zinc-600 px-1">…</span>
        ) : (
          <Link
            key={p}
            href={createHref(p)}
            className={`${base} ${p === currentPage ? active : inactive}`}
            aria-current={p === currentPage ? 'page' : undefined}
          >
            {p}
          </Link>
        )
      )}
      <Link
        href={createHref(currentPage + 1)}
        className={`${base} ${currentPage >= totalPages ? disabled : inactive}`}
        aria-disabled={currentPage >= totalPages}
      >
        Next →
      </Link>
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/PaginationFooter.tsx
git commit -m "feat(web): add PaginationFooter component"
```

---

### Task 6: Create `SearchInput` component

**Files:**
- Create: `apps/web/src/components/SearchInput.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/web/src/components/SearchInput.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface SearchInputProps {
  initialValue?: string
  placeholder?: string
  paramName?: string
  otherParams?: Record<string, string>
}

export function SearchInput({
  initialValue = '',
  placeholder = 'Search...',
  paramName = 'q',
  otherParams = {},
}: SearchInputProps) {
  const [value, setValue] = useState(initialValue)
  const router = useRouter()
  const pathname = usePathname()
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(otherParams)
      if (value) params.set(paramName, value)
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    }, 300)
    return () => clearTimeout(timer.current)
  // otherParams object identity is stable when built from searchParams in the server component
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, pathname, paramName, router])

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 pr-7 w-52"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition-colors text-base leading-none"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/SearchInput.tsx
git commit -m "feat(web): add SearchInput component with debounce and X clear button"
```

---

### Task 7: Update Browse page

**Files:**
- Modify: `apps/web/src/app/(community)/guides/page.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
// apps/web/src/app/(community)/guides/page.tsx
import { db } from '@/lib/db'
import GuideCard from '@/components/GuideCard'
import { getMapLabel } from '@/lib/mapColors'
import Link from 'next/link'
import { MapFilterBar } from '@/components/MapFilterBar'
import { PaginationFooter } from '@/components/PaginationFooter'
import { SearchInput } from '@/components/SearchInput'

interface SearchParams {
  map?: string
  sort?: string
  q?: string
  page?: string
}

export const revalidate = 60

const PAGE_SIZE = 24

export default async function BrowsePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { map, sort, q, page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    isPublic: true,
    ...(map ? { map } : {}),
    ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
  }

  const [guides, total] = await Promise.all([
    db.guide.findMany({
      where,
      include: {
        user: { select: { username: true, avatar: true, name: true } },
        ratings: { select: { value: true } },
      },
      orderBy: sort === 'newest' ? { createdAt: 'desc' } : { updatedAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    db.guide.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const withScores = guides.map((g) => ({
    ...g,
    score: g.ratings.reduce((acc, r) => acc + r.value, 0),
  }))
  if (sort === 'top') withScores.sort((a, b) => b.score - a.score)

  function buildMapHref(m: string | null) {
    const params = new URLSearchParams({
      ...(m ? { map: m } : {}),
      ...(sort ? { sort } : {}),
      ...(q ? { q } : {}),
    })
    const qs = params.toString()
    return qs ? `/guides?${qs}` : '/guides'
  }

  function buildPageHref(p: number) {
    const params = new URLSearchParams({
      ...(map ? { map } : {}),
      ...(sort ? { sort } : {}),
      ...(q ? { q } : {}),
      page: String(p),
    })
    return `/guides?${params.toString()}`
  }

  const searchOtherParams: Record<string, string> = {
    ...(map ? { map } : {}),
    ...(sort ? { sort } : {}),
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-10">
        <h1 className="font-display font-bold text-4xl text-white mb-2 tracking-tight">
          Community Guides
        </h1>
        <p className="text-zinc-500 text-sm">
          Annotated nade &amp; utility guides built and shared by the CS2 community.
        </p>
      </div>

      {/* Map filters */}
      <MapFilterBar activeMap={map} buildHref={buildMapHref} />

      {/* Sort + Search row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-8">
        <div className="flex gap-1">
          {[
            { value: undefined, label: 'Recent' },
            { value: 'top',    label: 'Top' },
            { value: 'newest', label: 'Newest' },
          ].map(({ value, label }) => {
            const params = new URLSearchParams({
              ...(map ? { map } : {}),
              ...(value ? { sort: value } : {}),
              ...(q ? { q } : {}),
            })
            const qs = params.toString()
            return (
              <Link
                key={label}
                href={qs ? `/guides?${qs}` : '/guides'}
                className={`text-xs px-3 py-1.5 rounded transition-colors ${
                  (sort ?? undefined) === value
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
        <SearchInput
          initialValue={q ?? ''}
          placeholder="Search guides…"
          otherParams={searchOtherParams}
        />
      </div>

      {/* Guide grid */}
      {withScores.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-display font-semibold text-xl text-zinc-600 mb-2">No guides found</p>
          <p className="text-zinc-700 text-sm">
            {map ? `No public ${getMapLabel(map)} guides yet.` : 'Be the first to share a guide.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {withScores.map((g) => (
            <GuideCard
              key={g.id}
              id={g.id}
              title={g.title}
              map={g.map}
              nodeCount={g.nodeCount}
              score={g.score}
              authorName={g.user.username ?? g.user.name}
              authorAvatar={g.user.avatar}
            />
          ))}
        </div>
      )}

      <PaginationFooter
        currentPage={page}
        totalPages={totalPages}
        createHref={buildPageHref}
      />
    </div>
  )
}
```

- [ ] **Step 2: Start dev server and verify in browser**

```bash
cd apps/web && npm run dev
```

Visit `http://localhost:3000/guides`. Verify:
- Map filter buttons show thumbnail icons
- Searching in the input updates the URL after 300 ms and filters results
- The × button appears when text is entered and clears on click
- Page 1/2/… footer appears when there are more than 24 guides

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(community)/guides/page.tsx
git commit -m "feat(web): add map icons, name search with X, and pagination to Browse page"
```

---

### Task 8: Update My Guides page

**Files:**
- Modify: `apps/web/src/app/(community)/my-guides/page.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
// apps/web/src/app/(community)/my-guides/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { deleteGuideBlob } from '@/lib/blob'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { getMapColor, getMapLabel } from '@/lib/mapColors'
import { MapFilterBar } from '@/components/MapFilterBar'
import { PaginationFooter } from '@/components/PaginationFooter'
import { SearchInput } from '@/components/SearchInput'

interface SearchParams {
  map?: string
  q?: string
  page?: string
}

const PAGE_SIZE = 24

async function deleteGuide(id: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.id) return
  const guide = await db.guide.findUnique({ where: { id } })
  if (!guide || guide.userId !== session.user.id) return
  await deleteGuideBlob(guide.blobKey)
  await db.guide.delete({ where: { id } })
  revalidatePath('/my-guides')
}

async function togglePublish(id: string, currentIsPublic: boolean) {
  'use server'
  const session = await auth()
  if (!session?.user?.id) return
  const guide = await db.guide.findUnique({ where: { id } })
  if (!guide || guide.userId !== session.user.id) return
  await db.guide.update({ where: { id }, data: { isPublic: !currentIsPublic } })
  revalidatePath('/my-guides')
}

export default async function MyGuidesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth()
  if (!session) redirect('/auth/signin')

  const { map, q, page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    userId: session.user.id,
    ...(map ? { map } : {}),
    ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
  }

  const [guides, total] = await Promise.all([
    db.guide.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: PAGE_SIZE }),
    db.guide.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const totalUnfiltered = await db.guide.count({ where: { userId: session.user.id } })

  function buildMapHref(m: string | null) {
    const params = new URLSearchParams({ ...(m ? { map: m } : {}), ...(q ? { q } : {}) })
    const qs = params.toString()
    return qs ? `/my-guides?${qs}` : '/my-guides'
  }

  function buildPageHref(p: number) {
    const params = new URLSearchParams({
      ...(map ? { map } : {}),
      ...(q ? { q } : {}),
      page: String(p),
    })
    return `/my-guides?${params.toString()}`
  }

  const searchOtherParams: Record<string, string> = { ...(map ? { map } : {}) }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl text-white tracking-tight mb-1">My Guides</h1>
          <p className="text-zinc-600 text-sm">
            {totalUnfiltered === 0
              ? 'No guides yet — push one from the desktop app.'
              : `${totalUnfiltered} guide${totalUnfiltered !== 1 ? 's' : ''} · ${guides.filter((g) => g.isPublic).length} public on this page`}
          </p>
        </div>
        <Link
          href="/guides"
          className="text-xs px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-lg transition-colors"
        >
          Browse community →
        </Link>
      </div>

      {/* Map filter */}
      <MapFilterBar activeMap={map} buildHref={buildMapHref} />

      {/* Search row */}
      <div className="flex justify-end mt-3 mb-6">
        <SearchInput
          initialValue={q ?? ''}
          placeholder="Search my guides…"
          otherParams={searchOtherParams}
        />
      </div>

      {guides.length === 0 ? (
        <div className="text-center py-24 border border-zinc-800/60 rounded-xl">
          <p className="font-display font-semibold text-xl text-zinc-600 mb-2">No guides found</p>
          <p className="text-zinc-700 text-sm">
            {map || q ? 'Try clearing the filters.' : 'Open the desktop app and push a guide to get started.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {guides.map((guide) => {
            const { accent, dim } = getMapColor(guide.map)
            const mapLabel = getMapLabel(guide.map)
            return (
              <div
                key={guide.id}
                className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 rounded-xl px-5 py-4 hover:border-zinc-700 transition-colors"
                style={{ borderLeftColor: accent, borderLeftWidth: '3px' }}
              >
                <span
                  className="shrink-0 text-[0.6rem] font-data uppercase tracking-widest px-2 py-0.5 rounded hidden sm:block"
                  style={{ backgroundColor: dim, color: accent }}
                >
                  {mapLabel}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-zinc-100 truncate">{guide.title}</p>
                  <p className="text-xs font-data text-zinc-600 mt-0.5">
                    {guide.nodeCount} nodes · v{guide.version} ·{' '}
                    {new Date(guide.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[0.65rem] font-data uppercase tracking-wide px-2 py-0.5 rounded ${
                    guide.isPublic
                      ? 'bg-emerald-950 text-emerald-500 border border-emerald-900'
                      : 'bg-zinc-800 text-zinc-600'
                  }`}
                >
                  {guide.isPublic ? 'Public' : 'Private'}
                </span>
                <div className="flex gap-2 shrink-0">
                  {guide.isPublic && (
                    <Link
                      href={`/guides/${guide.id}`}
                      className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-lg transition-colors"
                    >
                      View
                    </Link>
                  )}
                  <form action={togglePublish.bind(null, guide.id, guide.isPublic)}>
                    <button
                      type="submit"
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                        guide.isPublic
                          ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-400'
                          : 'bg-violet-950/50 hover:bg-violet-900/50 border-violet-900 text-violet-400'
                      }`}
                    >
                      {guide.isPublic ? 'Unpublish' : 'Publish'}
                    </button>
                  </form>
                  <form action={deleteGuide.bind(null, guide.id)}>
                    <button
                      type="submit"
                      className="text-xs px-3 py-1.5 bg-zinc-900 hover:bg-red-950 border border-zinc-800 hover:border-red-900 text-zinc-600 hover:text-red-400 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PaginationFooter currentPage={page} totalPages={totalPages} createHref={buildPageHref} />
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Visit `http://localhost:3000/my-guides` (sign in first). Verify map filter icons, search with X, and pagination footer appear.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(community)/my-guides/page.tsx
git commit -m "feat(web): add map filter, name search, and pagination to My Guides page"
```

---

## Phase 3 — Scope C: Grenade Library

### Task 9: DB schema migration

**Files:**
- Modify: `apps/web/prisma/schema.prisma`

- [ ] **Step 1: Add `GrenadeEntry`, `CronState`, and the `grenadeEntries` relation to `Guide`**

In `apps/web/prisma/schema.prisma`, add to the `Guide` model (after the existing relations):

```prisma
  grenadeEntries GrenadeEntry[]
```

Then append these two models at the end of the file:

```prisma
model GrenadeEntry {
  id          String   @id @default(cuid())
  guideId     String
  nodeId      String
  map         String
  grenadeType String
  throwType   String
  posLabel    String?
  aimLabel    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  guide Guide @relation(fields: [guideId], references: [id], onDelete: Cascade)

  @@unique([guideId, nodeId])
  @@index([map])
  @@index([throwType])
  @@index([grenadeType])
}

model CronState {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Generate and apply the migration**

```bash
cd apps/web && npx prisma migrate dev --name add-grenade-entry-cron-state
```

Expected: migration file created and applied, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add apps/web/prisma/schema.prisma apps/web/prisma/migrations/
git commit -m "feat(db): add GrenadeEntry and CronState models"
```

---

### Task 10: Create cron indexer route

**Files:**
- Create: `apps/web/src/app/api/cron/index-grenades/route.ts`

**Context:** The blob fetch pattern comes from the existing guide detail page:
```typescript
const blobUrl = await getGuideBlobUrl(guide.blobKey)
const res = await fetch(blobUrl)
const kv3Text = await res.text()
if (kv3Text.charCodeAt(0) === 0xfeff) kv3Text = kv3Text.slice(1) // strip BOM
const root = parseKv3Text(kv3Text) as Kv3Object
const nodesKey = extractNodesKey(root)
const nodes = kv3ToNodes(root, nodesKey)
```

The aim_target node (`SubType === 'aim_target'`) holds the throw instruction in `Desc.Text`. Call `inferThrowType` on the aim_target node to get the correct throw type. The main node (`SubType !== 'aim_target' && SubType !== 'destination'`) holds `Title.Text` (lineup name) and `Desc.Text` (standing position label).

- [ ] **Step 1: Create the route file**

```typescript
// apps/web/src/app/api/cron/index-grenades/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getGuideBlobUrl } from '@/lib/blob'
import { parseKv3Text, kv3ToNodes, extractNodesKey, inferThrowType } from '@cs2ann/shared/web'
import type { Kv3Object, AnnotationNode } from '@cs2ann/shared/web'

export const dynamic = 'force-dynamic'

const BATCH_SIZE = 50
const CURSOR_KEY = 'grenade-indexer'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cursorRow = await db.cronState.findUnique({ where: { key: CURSOR_KEY } })
  const cursor = cursorRow ? new Date(cursorRow.value) : new Date(0)

  let processed = 0
  let cleaned = 0
  let latestDate = cursor

  // 1. Clean up entries for guides that became private since last run
  const privateGuides = await db.guide.findMany({
    where: { isPublic: false, updatedAt: { gt: cursor } },
    select: { id: true, updatedAt: true },
  })
  if (privateGuides.length > 0) {
    await db.grenadeEntry.deleteMany({
      where: { guideId: { in: privateGuides.map((g) => g.id) } },
    })
    cleaned = privateGuides.length
    for (const g of privateGuides) {
      if (g.updatedAt > latestDate) latestDate = g.updatedAt
    }
  }

  // 2. Index new / updated public guides
  const publicGuides = await db.guide.findMany({
    where: { isPublic: true, updatedAt: { gt: cursor } },
    orderBy: { updatedAt: 'asc' },
    take: BATCH_SIZE,
    select: { id: true, map: true, blobKey: true, updatedAt: true },
  })

  for (const guide of publicGuides) {
    try {
      const blobUrl = await getGuideBlobUrl(guide.blobKey)
      if (!blobUrl) continue

      const res = await fetch(blobUrl)
      if (!res.ok) continue

      let kv3Text = await res.text()
      if (kv3Text.charCodeAt(0) === 0xfeff) kv3Text = kv3Text.slice(1)

      const root = parseKv3Text(kv3Text) as Kv3Object
      const nodesKey = extractNodesKey(root)
      const nodes = kv3ToNodes(root, nodesKey)

      // Group grenade nodes by master id
      const mainNodes = nodes.filter(
        (n: AnnotationNode) => n.Type === 'grenade' && n.SubType !== 'aim_target' && n.SubType !== 'destination'
      )
      const aimTargets = nodes.filter((n: AnnotationNode) => n.Type === 'grenade' && n.SubType === 'aim_target')
      const aimByMaster = new Map(aimTargets.map((n: AnnotationNode) => [n.MasterNodeId, n]))

      const upserts = mainNodes
        .filter((n: AnnotationNode) => n.GrenadeType && n.Id)
        .map((n: AnnotationNode) => {
          const aim = aimByMaster.get(n.Id)
          const throwType = aim ? inferThrowType(aim) : 'other'
          return db.grenadeEntry.upsert({
            where: { guideId_nodeId: { guideId: guide.id, nodeId: n.Id! } },
            create: {
              guideId: guide.id,
              nodeId: n.Id!,
              map: guide.map ?? 'unknown',
              grenadeType: n.GrenadeType!,
              throwType,
              posLabel: n.Desc?.Text ?? null,
              aimLabel: n.Title?.Text ?? null,
            },
            update: {
              map: guide.map ?? 'unknown',
              grenadeType: n.GrenadeType!,
              throwType,
              posLabel: n.Desc?.Text ?? null,
              aimLabel: n.Title?.Text ?? null,
            },
          })
        })

      await Promise.all(upserts)
      processed++
      if (guide.updatedAt > latestDate) latestDate = guide.updatedAt
    } catch (err) {
      console.error(`[cron] Failed to index guide ${guide.id}:`, err)
    }
  }

  // 3. Advance cursor
  if (latestDate > cursor) {
    await db.cronState.upsert({
      where: { key: CURSOR_KEY },
      create: { key: CURSOR_KEY, value: latestDate.toISOString() },
      update: { value: latestDate.toISOString() },
    })
  }

  return NextResponse.json({ processed, cleaned })
}
```

- [ ] **Step 2: Add `CRON_SECRET` to `.env.local`**

Open `apps/web/.env.local` and add:

```
CRON_SECRET=local-dev-secret
```

- [ ] **Step 3: Test the cron route manually in dev**

With the dev server running:

```bash
curl -H "Authorization: Bearer local-dev-secret" http://localhost:3000/api/cron/index-grenades
```

Expected response: `{"processed":N,"cleaned":0}` with no errors in the server console.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/cron/index-grenades/route.ts apps/web/.env.local
git commit -m "feat(web): add grenade indexer cron route"
```

---

### Task 11: Create `ThrowTypeFilterBar` and `GrenadeTypeFilterBar` components

**Files:**
- Create: `apps/web/src/components/ThrowTypeFilterBar.tsx`
- Create: `apps/web/src/components/GrenadeTypeFilterBar.tsx`

- [ ] **Step 1: Create `ThrowTypeFilterBar`**

```tsx
// apps/web/src/components/ThrowTypeFilterBar.tsx
import Link from 'next/link'
import { THROW_TYPE_SHORT, THROW_TYPE_LABEL } from '@cs2ann/shared/web'
import type { ThrowType } from '@cs2ann/shared/web'

const THROW_TYPES: ThrowType[] = [
  'stand', 'walk', 'run', 'stand_jump', 'w_jump',
  'crouch_jump', 'run_jump', 'm2', 'm2_jump', 'm1m2_jump',
]

interface ThrowTypeFilterBarProps {
  activeType: string | null | undefined
  buildHref: (type: string | null) => string
}

const pill = (active: boolean) =>
  `text-xs px-2.5 py-1 rounded border transition-colors ${
    active
      ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-200'
  }`

export function ThrowTypeFilterBar({ activeType, buildHref }: ThrowTypeFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link href={buildHref(null)} className={pill(!activeType)}>All</Link>
      {THROW_TYPES.map((t) => (
        <Link
          key={t}
          href={buildHref(t)}
          className={pill(activeType === t)}
          title={THROW_TYPE_LABEL[t]}
        >
          {THROW_TYPE_SHORT[t]}
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `GrenadeTypeFilterBar`**

```tsx
// apps/web/src/components/GrenadeTypeFilterBar.tsx
import Link from 'next/link'

const GRENADE_TYPES = [
  { value: 'smoke',      label: 'Smoke',      icon: '/nades/smoke.png' },
  { value: 'flash',      label: 'Flash',      icon: '/nades/flash.png' },
  { value: 'he',         label: 'HE',         icon: '/nades/hegrenade.png' },
  { value: 'molotov',    label: 'Molotov',    icon: '/nades/molotov.png' },
  { value: 'incendiary', label: 'Incendiary', icon: '/nades/molotov.png' },
  { value: 'decoy',      label: 'Decoy',      icon: '/nades/decoy.png' },
] as const

interface GrenadeTypeFilterBarProps {
  activeType: string | null | undefined
  buildHref: (type: string | null) => string
}

const pill = (active: boolean) =>
  `flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors ${
    active
      ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-200'
  }`

export function GrenadeTypeFilterBar({ activeType, buildHref }: GrenadeTypeFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link href={buildHref(null)} className={pill(!activeType)}>All types</Link>
      {GRENADE_TYPES.map(({ value, label, icon }) => (
        <Link key={value} href={buildHref(value)} className={pill(activeType === value)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt="" width={13} height={13} className="opacity-75" />
          {label}
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ThrowTypeFilterBar.tsx apps/web/src/components/GrenadeTypeFilterBar.tsx
git commit -m "feat(web): add ThrowTypeFilterBar and GrenadeTypeFilterBar components"
```

---

### Task 12: Create Grenade Library page

**Files:**
- Create: `apps/web/src/app/(community)/library/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// apps/web/src/app/(community)/library/page.tsx
import { db } from '@/lib/db'
import { MapFilterBar } from '@/components/MapFilterBar'
import { ThrowTypeFilterBar } from '@/components/ThrowTypeFilterBar'
import { GrenadeTypeFilterBar } from '@/components/GrenadeTypeFilterBar'
import { PaginationFooter } from '@/components/PaginationFooter'
import { SearchInput } from '@/components/SearchInput'
import { THROW_TYPE_SHORT } from '@cs2ann/shared/web'
import type { ThrowType } from '@cs2ann/shared/web'
import { getMapColor, getMapLabel } from '@/lib/mapColors'
import Link from 'next/link'
import Image from 'next/image'

interface SearchParams {
  map?: string
  type?: string
  throw?: string
  q?: string
  page?: string
}

export const revalidate = 300

const PAGE_SIZE = 24

const GRENADE_ICONS: Record<string, string> = {
  smoke:      '/nades/smoke.png',
  flash:      '/nades/flash.png',
  he:         '/nades/hegrenade.png',
  molotov:    '/nades/molotov.png',
  incendiary: '/nades/molotov.png',
  decoy:      '/nades/decoy.png',
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { map, type, throw: throwParam, q, page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    ...(map ? { map } : {}),
    ...(type ? { grenadeType: type } : {}),
    ...(throwParam ? { throwType: throwParam } : {}),
    ...(q
      ? {
          OR: [
            { posLabel: { contains: q, mode: 'insensitive' as const } },
            { aimLabel: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [entries, total] = await Promise.all([
    db.grenadeEntry.findMany({
      where,
      include: { guide: { select: { title: true } } },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    db.grenadeEntry.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildMapHref(m: string | null) {
    const p = new URLSearchParams({
      ...(m ? { map: m } : {}),
      ...(type ? { type } : {}),
      ...(throwParam ? { throw: throwParam } : {}),
      ...(q ? { q } : {}),
    })
    const qs = p.toString()
    return qs ? `/library?${qs}` : '/library'
  }

  function buildTypeHref(t: string | null) {
    const p = new URLSearchParams({
      ...(map ? { map } : {}),
      ...(t ? { type: t } : {}),
      ...(throwParam ? { throw: throwParam } : {}),
      ...(q ? { q } : {}),
    })
    const qs = p.toString()
    return qs ? `/library?${qs}` : '/library'
  }

  function buildThrowHref(t: string | null) {
    const p = new URLSearchParams({
      ...(map ? { map } : {}),
      ...(type ? { type } : {}),
      ...(t ? { throw: t } : {}),
      ...(q ? { q } : {}),
    })
    const qs = p.toString()
    return qs ? `/library?${qs}` : '/library'
  }

  function buildPageHref(p: number) {
    const params = new URLSearchParams({
      ...(map ? { map } : {}),
      ...(type ? { type } : {}),
      ...(throwParam ? { throw: throwParam } : {}),
      ...(q ? { q } : {}),
      page: String(p),
    })
    return `/library?${params.toString()}`
  }

  const searchOtherParams: Record<string, string> = {
    ...(map ? { map } : {}),
    ...(type ? { type } : {}),
    ...(throwParam ? { throw: throwParam } : {}),
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-10">
        <h1 className="font-display font-bold text-4xl text-white mb-2 tracking-tight">Grenade Library</h1>
        <p className="text-zinc-500 text-sm">
          Every grenade lineup from public community guides, indexed and filterable.
        </p>
      </div>

      {/* Map filter */}
      <MapFilterBar activeMap={map} buildHref={buildMapHref} />

      {/* Grenade type filter */}
      <div className="mt-4">
        <GrenadeTypeFilterBar activeType={type} buildHref={buildTypeHref} />
      </div>

      {/* Throw type + search row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-8">
        <ThrowTypeFilterBar activeType={throwParam} buildHref={buildThrowHref} />
        <SearchInput
          initialValue={q ?? ''}
          placeholder="Search lineups…"
          otherParams={searchOtherParams}
        />
      </div>

      <p className="text-xs text-zinc-600 mb-4">{total.toLocaleString()} lineup{total !== 1 ? 's' : ''}</p>

      {entries.length === 0 ? (
        <div className="text-center py-24 border border-zinc-800/60 rounded-xl">
          <p className="font-display font-semibold text-xl text-zinc-600 mb-2">No lineups found</p>
          <p className="text-zinc-700 text-sm">Try clearing some filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map((entry) => {
            const { accent, dim, icon: mapIcon } = getMapColor(entry.map)
            const mapLabel = getMapLabel(entry.map)
            const grenadeIcon = GRENADE_ICONS[entry.grenadeType]
            const throwShort = THROW_TYPE_SHORT[entry.throwType as ThrowType] ?? entry.throwType

            return (
              <div
                key={entry.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors flex flex-col gap-3"
              >
                {/* Header: map chip + grenade icon + throw badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="flex items-center gap-1 text-[0.6rem] font-data uppercase tracking-widest px-2 py-0.5 rounded font-semibold"
                    style={{ backgroundColor: dim, color: accent }}
                  >
                    {mapIcon && (
                      <Image src={mapIcon} alt="" width={10} height={10} className="opacity-80" unoptimized />
                    )}
                    {mapLabel}
                  </div>
                  {grenadeIcon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={grenadeIcon} alt={entry.grenadeType} width={16} height={16} className="opacity-80" />
                  )}
                  <span className="text-[0.65rem] font-data px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                    {throwShort}
                  </span>
                </div>

                {/* Labels */}
                <div className="flex-1">
                  {entry.aimLabel && (
                    <p className="font-display font-semibold text-zinc-100 text-sm leading-tight mb-1 truncate">
                      {entry.aimLabel}
                    </p>
                  )}
                  {entry.posLabel && (
                    <p className="text-xs text-zinc-500 truncate">{entry.posLabel}</p>
                  )}
                </div>

                {/* Guide link */}
                <Link
                  href={`/guides/${entry.guideId}`}
                  className="text-[0.68rem] text-zinc-600 hover:text-violet-400 transition-colors truncate"
                >
                  {entry.guide.title} →
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <PaginationFooter currentPage={page} totalPages={totalPages} createHref={buildPageHref} />
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Visit `http://localhost:3000/library`. Verify all four filters work, cards render correctly, and pagination appears.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(community)/library/page.tsx
git commit -m "feat(web): add Grenade Library page with map, type, throw, and search filters"
```

---

### Task 13: Add throw type filter to guide detail view

**Files:**
- Create: `apps/web/src/components/GuideNodeFilter.tsx`
- Modify: `apps/web/src/app/(community)/guides/[id]/page.tsx`

- [ ] **Step 1: Create `GuideNodeFilter` client component**

```tsx
// apps/web/src/components/GuideNodeFilter.tsx
'use client'
import { useState } from 'react'
import { inferThrowType, THROW_TYPE_SHORT, THROW_TYPE_LABEL } from '@cs2ann/shared/web'
import GuideAnnotationPreview from '@/components/GuideAnnotationPreview'
import type { AnnotationNode, ThrowType, GrenadeType } from '@cs2ann/shared/web'

const THROW_TYPES: ThrowType[] = [
  'stand', 'walk', 'run', 'stand_jump', 'w_jump',
  'crouch_jump', 'run_jump', 'm2', 'm2_jump', 'm1m2_jump',
]

const GRENADE_TYPES: GrenadeType[] = ['smoke', 'flash', 'he', 'molotov', 'decoy']
const GRENADE_ICONS: Record<GrenadeType, string> = {
  smoke:   '/nades/smoke.png',
  flash:   '/nades/flash.png',
  he:      '/nades/hegrenade.png',
  molotov: '/nades/molotov.png',
  decoy:   '/nades/decoy.png',
}

interface Props {
  nodes: AnnotationNode[]
  mapName: string | null | undefined
}

const pill = (active: boolean) =>
  `text-xs px-2 py-0.5 rounded border transition-colors cursor-pointer ${
    active
      ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-200'
  }`

export function GuideNodeFilter({ nodes, mapName }: Props) {
  const [throwFilter, setThrowFilter] = useState<ThrowType | 'all'>('all')
  const [grenadeFilter, setGrenadeFilter] = useState<GrenadeType | 'all'>('all')

  const hasGrenades = nodes.some((n) => n.Type === 'grenade')
  if (!hasGrenades) {
    return <GuideAnnotationPreview nodes={nodes} mapName={mapName} />
  }

  // Build set of main node IDs that pass the throw type filter
  // Throw type is read from the aim_target node for each grenade group
  const aimByMaster = new Map(
    nodes
      .filter((n) => n.Type === 'grenade' && n.SubType === 'aim_target')
      .map((n) => [n.MasterNodeId, n])
  )

  const mainNodes = nodes.filter(
    (n) => n.Type === 'grenade' && n.SubType !== 'aim_target' && n.SubType !== 'destination'
  )

  const visibleMainIds = new Set(
    mainNodes
      .filter((n) => grenadeFilter === 'all' || n.GrenadeType === grenadeFilter)
      .filter((n) => {
        if (throwFilter === 'all') return true
        const aim = aimByMaster.get(n.Id)
        return aim ? inferThrowType(aim) === throwFilter : false
      })
      .map((n) => n.Id)
  )

  const filteredNodes = nodes.filter((n) => {
    if (n.Type !== 'grenade') return true
    if (n.SubType === 'aim_target' || n.SubType === 'destination') {
      return visibleMainIds.has(n.MasterNodeId ?? '')
    }
    return visibleMainIds.has(n.Id ?? '')
  })

  return (
    <div>
      {/* Grenade type filter */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <button className={pill(grenadeFilter === 'all')} onClick={() => setGrenadeFilter('all')}>
          All
        </button>
        {GRENADE_TYPES.map((gt) => (
          <button key={gt} className={pill(grenadeFilter === gt)} onClick={() => setGrenadeFilter(gt)}>
            <span className="inline-flex items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GRENADE_ICONS[gt]} alt="" width={12} height={12} className="opacity-75" />
              {gt.charAt(0).toUpperCase() + gt.slice(1)}
            </span>
          </button>
        ))}
      </div>

      {/* Throw type filter */}
      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        <button className={pill(throwFilter === 'all')} onClick={() => setThrowFilter('all')}>
          All throws
        </button>
        {THROW_TYPES.map((t) => (
          <button
            key={t}
            className={pill(throwFilter === t)}
            onClick={() => setThrowFilter(t)}
            title={THROW_TYPE_LABEL[t]}
          >
            {THROW_TYPE_SHORT[t]}
          </button>
        ))}
      </div>

      <GuideAnnotationPreview nodes={filteredNodes} mapName={mapName} />
    </div>
  )
}
```

- [ ] **Step 2: Update the guide detail page to use `GuideNodeFilter`**

In `apps/web/src/app/(community)/guides/[id]/page.tsx`, add the import:

```typescript
import { GuideNodeFilter } from '@/components/GuideNodeFilter'
```

Then find the Annotations section (around line 208–213):

```tsx
      <section className="mb-10">
        <h2 className="font-display font-semibold text-lg text-white mb-4 tracking-tight">
          Annotations
        </h2>
        <GuideAnnotationPreview nodes={nodes} mapName={guide.map} />
      </section>
```

Replace with:

```tsx
      <section className="mb-10">
        <h2 className="font-display font-semibold text-lg text-white mb-4 tracking-tight">
          Annotations
        </h2>
        <GuideNodeFilter nodes={nodes} mapName={guide.map} />
      </section>
```

- [ ] **Step 3: Verify in browser**

Open a guide detail page that has grenade nodes. Confirm the grenade type chips and throw type pills appear above the preview and filter the visible lineups.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/GuideNodeFilter.tsx apps/web/src/app/(community)/guides/[id]/page.tsx
git commit -m "feat(web): add grenade type and throw type filters to guide detail view"
```

---

### Task 14: Add Library link to nav and configure Vercel cron

**Files:**
- Modify: `apps/web/src/app/(community)/layout.tsx`
- Modify: `apps/web/vercel.json`

- [ ] **Step 1: Add Library nav link in `layout.tsx`**

Find the Browse link in `apps/web/src/app/(community)/layout.tsx`:

```tsx
          <Link
            href="/guides"
            className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
          >
            Browse
          </Link>
```

Add the Library link immediately after it:

```tsx
          <Link
            href="/guides"
            className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
          >
            Browse
          </Link>

          <Link
            href="/library"
            className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
          >
            Library
          </Link>
```

- [ ] **Step 2: Add cron schedule to `vercel.json`**

Replace the full content of `apps/web/vercel.json`:

```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install",
  "crons": [
    {
      "path": "/api/cron/index-grenades",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Verify nav in browser**

Reload any community page and confirm "Library" appears between "Browse" and "For You" in the nav bar. Click it to confirm the library page loads.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(community)/layout.tsx apps/web/vercel.json
git commit -m "feat(web): add Library nav link and Vercel cron schedule for grenade indexer"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - ✅ Map filter with icons → Tasks 4, 7, 8
  - ✅ Name search with X → Tasks 6, 7, 8
  - ✅ Pagination Browse + My Guides → Tasks 5, 7, 8
  - ✅ Expanded throw type inference → Tasks 1, 2
  - ✅ Desktop keyword reference panel → Task 3
  - ✅ GrenadeEntry + CronState schema → Task 9
  - ✅ Cron indexer (public only, private cleanup, aim_target inference) → Task 10
  - ✅ ThrowTypeFilterBar + GrenadeTypeFilterBar → Task 11
  - ✅ Library page with all four filters → Task 12
  - ✅ Throw type filter within guide detail → Task 13
  - ✅ Library nav link + vercel.json cron → Task 14

- **Aim_target note:** The throw type text (e.g. "standing W-Jumpthrow") lives in the `aim_target` node's `Desc.Text`, not the main node. Tasks 10 and 13 both explicitly find the aim_target node per grenade group and call `inferThrowType` on it. This fixes the root cause of the desktop filter's incorrect inference.

- **Private guide safety:** Task 10 step 1 queries `isPublic: false` guides updated since the last cursor and deletes their `GrenadeEntry` rows before indexing new public guides.

- **Type names:** `THROW_TYPE_SHORT`, `THROW_TYPE_LABEL`, `ThrowType`, `GrenadeType` are all sourced from `@cs2ann/shared/web` consistently across Tasks 11, 12, 13.
