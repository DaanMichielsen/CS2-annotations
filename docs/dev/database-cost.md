# Database cost: why this app is expensive to keep awake

Audited 2026-08-07, when the Neon bill was running at ~516 CU-hours/month (~$55)
with zero real users.

## The cost model

Neon project `cs2-annotations` is on the **Launch** plan at **$0.106/CU-hour**.
Compute scales to zero after **5 minutes of inactivity**, and on Launch that
timeout is **not configurable** — only the Scale plan can change it.

That gives the rule that governs every decision in this document:

> **Bill ≈ (number of _isolated_ requests) × 5 minutes × CU size.**

Query volume is almost irrelevant. A single stray request that reaches Postgres
costs a full 5 CU-minutes, whether it runs one query or two hundred. Ten requests
spread an hour apart cost ten times more than ten requests in the same second.

This is why the fixes below are all about **not reaching Postgres at all** for
anonymous traffic, rather than about making queries faster.

## What went wrong

Measured from the Neon API over 6,000 compute operations:

- **69.3%** of wall-clock time awake
- **~70 wake/suspend cycles per day**
- `start_compute` counts were **flat across all 24 hours** (112–145 every hour,
  including 03:00 UTC) — the signature of crawlers, not humans

Three compounding causes:

1. **`autoscaling_limit_min_cu` was 1** (max also 1). Launch supports 0.25 CU and
   the database is ~39 MB. Everything was billed at 4× the necessary size.
2. **The root layout called `auth()`.** `auth()` reads cookies, which opts the
   route out of static rendering — and because it was in `src/app/layout.tsx`,
   it did so for *every route in the app*. `export const revalidate` was inert
   everywhere. Confirmed in production: `/` (with `revalidate = 120`) returned
   `X-Vercel-Cache: MISS` and `no-store`, while `/api/featured-guides` (same
   idea, no `auth()` call) returned `PRERENDER`.
3. **No `robots.txt`** — it 404'd. Crawlers were free to walk every
   filter/sort/page permutation of `/guides` and `/library`, and each permutation
   was a dynamic, DB-backed render.

## Rules to keep it cheap

**Never call `auth()` in a layout.** It makes the entire subtree dynamic. Read
the session client-side with `useSession()` (see `TopNav.tsx`, `HeroCta.tsx`) or
push `auth()` down into the specific page that needs it.

**Public reads go through `src/lib/queries.ts`.** Pages that use `searchParams`
are dynamic no matter what, so the full-route cache never saves them; the
`unstable_cache` layer is what keeps repeat traffic off Postgres. Two rules for
anything added there:

- the result must not depend on the signed-in user — per-user reads stay out;
- return primitives only. `unstable_cache` round-trips through JSON, which
  silently turns `Date` into `string` on a cache *hit* but not on a miss.

**Invalidate with tags, not time.** Mutations call
`revalidateTag(CACHE_TAG_GUIDES)` / `CACHE_TAG_LIBRARY` so the cache TTL can stay
long without content going stale.

**Never poll the cloud API faster than the scale-to-zero window.** The desktop
apps used to poll `/api/saved-guides` every 2 minutes. Against a 5-minute
suspend timeout that pins the compute awake permanently — a single user leaving
the app open would cost ~744 CU-h/month (~$79). Both apps now refresh on window
focus with a 30-minute backstop.

**Anything crawlable must be cacheable.** If a new public route can't be static,
either route its reads through `src/lib/queries.ts` or add it to `robots.ts`.

## Consequence for builds

`/` is now prerendered at build time, so **`next build` needs a reachable
database**. On Vercel that is fine — `DATABASE_URL` is set and the build simply
wakes the compute for a few seconds. Locally it means `pnpm build` requires
`pnpm db:start` first, where before it did not.

Note that `next build` sets `NODE_ENV=production`, so the production-database
guard in `src/lib/db.ts` does **not** fire during a local build. A Neon URL in
your environment will be used silently by `pnpm build`, unlike `pnpm dev`.

## Known gaps

- `/guides/[id]` and `/users/[id]` still query Postgres per request. They mix
  public data with per-user state (save status, follow status, ownership checks)
  and with dates that are hand-converted to ISO strings at the component
  boundary, so caching them needs real restructuring. Deliberately deferred: the
  public surface is ~10 guides, so the crawl cost is bounded and small compared
  to the facet explosion that `robots.ts` closed off. Revisit if guide count
  grows substantially.
- NextAuth still uses **database sessions** (`PrismaAdapter`, no `strategy`), and
  the `session()` callback does an extra `db.user.findUnique` with roles — 2+
  round-trips per authenticated request. Switching to JWT sessions would remove
  those, but it changes auth behaviour (roles must move into the token, existing
  sessions are invalidated) and it does nothing for the anonymous crawler traffic
  that caused this bill. Worth doing before the app has real traffic, not as part
  of a cost fix.
