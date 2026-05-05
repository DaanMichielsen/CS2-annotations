# CS2 Annotations — Full Product Roadmap Design

**Date:** 2026-05-05  
**Status:** Approved

---

## Context

A Windows Electron + React desktop app for editing Counter-Strike 2 annotation guide files (KV3 format). Users create and manage grenade lineups, positions, text labels, and lines on interactive map overlays. The app reads/writes directly to the CS2 local annotations folder and can send console commands to the game.

Current state: fully working local CRUD app. Goal: package it for distribution, then grow it into a cloud-backed community platform for sharing CS2 nade guides.

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Repo structure | Turborepo monorepo (pnpm workspaces) | Shared types and UI components across desktop + web without drift |
| Desktop framework | Electron 28 (existing) | Already built, not changing |
| Web framework | Next.js 15 (App Router) | User-preferred, deploys to Vercel, pairs with NextAuth |
| Auth | NextAuth v5 + Steam OpenID 2.0 | Steam is the natural identity for CS2 players; Clerk doesn't support Steam OpenID natively |
| Database | Neon Postgres + Drizzle ORM | Relational data (users, guides metadata, ratings, comments) |
| File storage | Vercel Blob | Raw KV3 files + media (screenshots, video); preserves original format, avoids parse round-trips |
| Sync strategy | Optimistic versioning + explicit conflict dialog | Never silent overwrites; catch divergence on Electron open; always give user explicit choice |
| Editor availability | Both Electron and browser | Shared `packages/ui` with adapter pattern; Electron adds local FS + CS2 integration on top |
| Guide visibility | Private by default, explicit publish | Users iterate privately before exposing to community |

---

## Monorepo Structure

```
cs2-annotations/
  apps/
    desktop/              ← Electron app (current codebase, moved here)
    web/                  ← Next.js 15 app (new)
  packages/
    shared/               ← annotation types, KV3 parser, API contract types
    ui/                   ← GuideEditor, MapOverlay, all shared React components
  turbo.json
  pnpm-workspace.yaml
  package.json
```

### GuideAdapter Interface (packages/shared)

All persistence is abstracted behind a single interface so editor components are context-agnostic:

```ts
interface GuideAdapter {
  loadGuide(id: string): Promise<AnnotationGuide>
  saveGuide(id: string, guide: AnnotationGuide): Promise<void>
  listGuides(): Promise<GuideSummary[]>
  deleteGuide(id: string): Promise<void>
}
```

- `LocalAdapter` (apps/desktop) — implements via Electron IPC → local KV3 files
- `CloudAdapter` (apps/web) — implements via fetch → Next.js API routes → Vercel Blob

---

## Database Schema (Neon Postgres)

```sql
users
  id            uuid PK
  steamId       text UNIQUE NOT NULL
  username      text
  avatar        text          -- Steam avatar URL
  createdAt     timestamp

guides
  id            uuid PK
  userId        uuid FK → users
  title         text
  description   text
  map           text          -- e.g. "de_mirage"
  tags          text[]
  blobUrl       text          -- Vercel Blob URL of raw KV3 file
  version       integer       -- increments on every cloud save
  isPublic      boolean DEFAULT false
  forkOf        uuid FK → guides (nullable)
  nodeCount     integer
  createdAt     timestamp
  updatedAt     timestamp

guide_ratings
  id            uuid PK
  userId        uuid FK → users
  guideId       uuid FK → guides
  value         smallint      -- +1 or -1
  UNIQUE(userId, guideId)

guide_comments
  id            uuid PK
  userId        uuid FK → users
  guideId       uuid FK → guides
  body          text
  createdAt     timestamp

guide_media
  id            uuid PK
  guideId       uuid FK → guides
  nodeId        text          -- annotation node identifier
  type          text          -- "screenshot" | "video"
  blobUrl       text
  createdAt     timestamp
```

---

## Sync Strategy (Electron ↔ Cloud)

- Each guide synced to cloud carries a `version` integer stored locally in electron-store alongside the guide path.
- **On Electron open:** for each guide that has been synced, check cloud `version` against local `lastSyncedVersion`. If cloud is newer → show persistent banner: "Cloud has changes — [Pull]". User can dismiss and keep editing.
- **On push:** API checks that the incoming `version` matches current cloud `version`. If not → conflict dialog:
  - "Keep mine (overwrite cloud)" — local wins, cloud version is replaced
  - "Keep cloud (discard my local changes)" — pull replaces local
- **On pull:** local KV3 file is backed up to a `.bak` file before overwrite. Recoverable.
- **CS2 local file:** always reflects the last local save (push or pull both update the local KV3 file). The game reads from local; cloud is the backup/sharing layer.

---

## CS2 File Detection Fix

When a new guide file is created while CS2 is running, the game won't list it in the dropdown until the map reloads. Workaround added to Electron app:

- "Reload map in CS2" button in the guide list header
- Writes `map <currentMap>` to the CS2 exec config (same mechanism as `annotation_load`)
- Shown with a warning: "This will restart the current round"
- Map name is derived from the currently open guide's map field

---

## Phase Breakdown

### Phase 1 — Electron Packaging & Distribution

**Goal:** Standalone Windows installer. Non-technical users install and run without a dev server.

**Tasks:**
1. Migrate package manager to pnpm
2. Initialize Turborepo with `turbo.json` and `pnpm-workspace.yaml`
3. Move current app into `apps/desktop/`
4. Create stub `apps/web/` and `packages/shared/`, `packages/ui/` directories with placeholder `package.json` files
5. Move annotation types and KV3 parser to `packages/shared/`
6. Update all imports in `apps/desktop/` to use `@cs2ann/shared`
7. Configure electron-builder: NSIS installer, app icon, app ID (`com.cs2ann.desktop`), output dir
8. Add electron-updater: check for updates on app start, background download, prompt to install on next launch
9. Configure GitHub Actions workflow: trigger on `v*` tag push → build → publish GitHub Release with installer artifact
10. Add "Reload map in CS2" button with map-reload command and round-restart warning
11. Test cold install on a clean Windows machine (no Node, no dev server)

**Deliverable:** Tagged GitHub release produces a downloadable `.exe` installer with auto-update.

---

### Phase 2 — Shared UI Package

**Goal:** Decouple `GuideEditor` and `MapOverlay` from Electron IPC so the same components run in a browser.

**Tasks:**
1. Define `GuideAdapter` interface in `packages/shared/`
2. Create `packages/ui/` — move `GuideEditor.tsx`, `MapOverlay.tsx`, and all sub-components
3. Replace all `window.electronAPI.*` calls inside moved components with adapter method calls (passed as props or context)
4. Implement `LocalAdapter` in `apps/desktop/` wrapping existing IPC calls
5. Wire `LocalAdapter` into the desktop app's root — verify all existing functionality works identically
6. Create stub `CloudAdapter` in `apps/web/` returning empty/mock data (real implementation in Phase 4)
7. Run existing test suite; fix any import breakage

**Deliverable:** Desktop app works identically. `packages/ui` components are Electron-free and browser-safe.

---

### Phase 3 — Cloud Infrastructure & Auth

**Goal:** Working Next.js app on Vercel with Steam sign-in, database, and user profile.

**Tasks:**
1. Scaffold `apps/web/` — Next.js 15 App Router + Tailwind CSS
2. Configure Neon Postgres project, connection string in env vars
3. Set up Drizzle ORM — schema file, migrations for `users` table and NextAuth required tables (`accounts`, `sessions`, `verification_tokens`)
4. Install and configure NextAuth v5 with Steam OpenID 2.0 provider
5. Store sessions in Neon via Drizzle adapter (no JWT, database sessions)
6. User profile page: `/profile` — Steam avatar, username, Steam ID
7. Deploy `apps/web/` to Vercel, configure env vars (NEXTAUTH_SECRET, Steam API key, DATABASE_URL)
8. Electron: "Sign in with Steam" button → opens system browser to `/api/auth/signin`
9. Next.js: after Steam auth success, redirect to `/auth/desktop-callback` page — this page reads the session token and immediately does `window.location.href = 'cs2ann://auth/callback?token=<token>'` to hand off to Electron (NextAuth cannot redirect to custom URL schemes directly)
10. Electron: register `cs2ann://` deep link handler in main process → receive token from URL → store in electron-store
11. Electron: show signed-in state (Steam avatar + username) in app sidebar

**Deliverable:** Steam sign-in works on both web and Electron. User identity is established.

---

### Phase 4 — Cloud Backup

**Goal:** Push/pull guides between Electron and cloud with conflict protection.

**Tasks:**
1. Drizzle migration: add `guides` table per schema above
2. API route `POST /api/guides` — accept KV3 file upload → store in Vercel Blob → insert guides row
3. API route `GET /api/guides` — list authenticated user's guides (title, map, version, updatedAt)
4. API route `GET /api/guides/[id]` — return guide metadata + signed Blob download URL
5. API route `PUT /api/guides/[id]` — update KV3 blob + bump version; return 409 if version mismatch
6. Implement `CloudAdapter` in `apps/web/` using the above API routes
7. Web: "My Guides" page — list user's cloud guides, open in browser editor (using `packages/ui`), delete
8. Electron: "My Cloud Guides" panel — list cloud guides with version badge ("local / cloud")
9. Electron: push guide → call PUT API, handle 409 with conflict dialog ("Keep mine" / "Keep cloud")
10. Electron: pull guide → backup local `.bak`, download from Blob, write to CS2 annotations folder
11. Electron: on-open cloud version check → show "Cloud has changes" banner per guide if behind
12. Electron: first-time push of a local guide → call POST API to create cloud record

**Deliverable:** Guides sync bidirectionally with conflict protection. Both Electron and browser can edit.

---

### Phase 5 — Community Platform

**Goal:** Public guide browsing, forking, rating, and commenting.

**Tasks:**
1. Drizzle migrations: `guide_ratings`, `guide_comments` tables
2. API route `PATCH /api/guides/[id]/publish` — set `isPublic = true`, require title + description + map tag
3. Browse page `/guides` — paginated grid of public guides, filter by map and grenade type, sort by rating/date
4. Guide detail page `/guides/[id]` — map preview thumbnail, node list, author (Steam avatar + name), rating, comments
5. Fork API `POST /api/guides/[id]/fork` — copy Blob file to new record under authenticated user
6. Fork button on guide detail page — forks to user's account, redirects to their copy in editor
7. Rating API `POST /api/guides/[id]/rate` — upsert +1/-1 per user; aggregate shown on guide card and detail
8. Comments API `GET/POST /api/guides/[id]/comments` — threaded list, authenticated post
9. Comment thread UI on guide detail page
10. Electron: "Browse Community" button — opens `/guides` in system browser

**Deliverable:** Public guides are browsable. Users can fork, rate, and comment.

---

### Phase 6 — Media Attachments

**Goal:** Per-node screenshots and video clips on guide detail pages, supporting lineup documentation like csnades.com.

**Tasks:**
1. Drizzle migration: `guide_media` table
2. API route `POST /api/guides/[id]/media` — accept image or video upload → store in Vercel Blob under `/media/{guideId}/{nodeId}/`
3. API route `GET /api/guides/[id]/media` — list media for a guide, grouped by nodeId
4. API route `DELETE /api/guides/[id]/media/[mediaId]` — remove from Blob + DB
5. Browser editor: per-node media panel — drag-drop upload, image preview, video player
6. Guide detail page: show media alongside each node entry (images inline, video with play button)
7. Electron: read-only media view (display media from cloud for a synced guide; upload only from browser)

**Deliverable:** Guide authors can document each lineup with screenshots and video clips.

---

## Non-Goals (explicitly out of scope)

- Mobile app
- Real-time collaboration (multiple users editing same guide simultaneously)
- Automatic git-style merging of annotation conflicts
- Workshop integration with Steam itself
- Support for games other than CS2

---

## Open Questions

- Code signing certificate for Phase 1 (self-signed works but Windows SmartScreen will warn; EV cert costs ~$300/yr)
- Rate limiting / abuse prevention on public API routes (can defer to Phase 5)
- Video size limits (Vercel Blob max object size is 500MB per file; reasonable for short clips)
