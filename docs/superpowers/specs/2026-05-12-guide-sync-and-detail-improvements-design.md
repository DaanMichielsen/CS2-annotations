# Guide Sync & Detail Improvements Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a set of desktop/web bugs (EPERM on delete, push 500, saved guides auth) and add three features: annotation list with search on web guide detail, delete-from-cloud confirmation in desktop, and featured guide save blocking.

**Architecture:** Spans `packages/ui` (Guides.tsx accordion + refresh), `apps/web` (guide detail page, save API guard, new cloud delete route), and `apps/desktop` (main process watcher fix, new cloudDeleteGuide IPC, cloudAuthorId tracking, useSavedGuides poll interval).

**Tech Stack:** React, Electron/IPC, Prisma (Neon), Next.js API routes, electron-store, TypeScript

---

## Section 1: Bug Fixes

### 1a. EPERM on delete (desktop)

**Problem:** `deleteGuide` IPC handler calls `fs.unlinkSync()` while `FSWatcher` still holds a handle on the file, causing `EPERM: operation not permitted`.

**Fix:** Inside the `deleteGuide` handler in `apps/desktop/electron/main/index.ts`, stop the active file watcher (if any) before calling `fs.unlinkSync()`. The watcher is managed via `watchGuideFile`/`unwatchGuideFile` — the handler should call the same cleanup logic before deletion. Folder cleanup (removing the empty guide subdirectory) already works correctly once the file is successfully deleted.

### 1b. Push failed 500

**Problem:** After cleaning the DB, a forked guide is pushed as a new guide (no `cloudId` in electron-store). The `POST /api/cloud/guides` endpoint returns 500.

**Fix:** Read the `POST /api/cloud/guides` route in `apps/web/src/app/api/cloud/guides/route.ts` (or equivalent). Trace the error — likely a missing null-check, a DB unique constraint, or an unhandled Prisma error. Fix the root cause and ensure proper error responses are returned for all failure modes.

### 1c. Saved guides not showing on desktop

**Problem:** `useSavedGuides` sends `Authorization: Bearer <token>` but the token stored in electron-store may not match what `getApiUser()` expects (could be a full session string vs. userId).

**Fix:** Trace `getApiUser()` in `apps/web/src/lib/api-auth.ts` (or equivalent). Verify what format the desktop stores under `authToken` and what the helper expects. Align the two so the Bearer token is correctly resolved to a userId.

---

## Section 2: Web Guide Detail — Annotation List

**Location:** `apps/web/src/app/(community)/guides/[id]/page.tsx` (left column, below `GuideNodeFilter`)

### Behaviour
- Collapsible accordion, default expanded, labelled "Annotations"
- Search box inside the header row — filters annotation names as you type (client-side, no API call)
- Annotations grouped by grenade type (Smoke, Flash, Molotov, HE, Decoy) as sub-headers
- Each row: annotation name + inferred jump type (e.g. "Jump Throw", "Stand")
- When search text is non-empty, groups with zero matching items are hidden; groups with matches auto-expand even if previously collapsed
- The node data is already passed to the page via `GuideNodeFilter` — the same data feeds this list, no new DB query needed

### Component
Extract a new client component `AnnotationList` in `apps/web/src/components/AnnotationList.tsx`:

```tsx
// Props
interface Props {
  nodes: GuideNode[]  // same type already used in the page
}
```

Renders the search box and grouped list. Import and render it in the guide detail page directly below `<GuideNodeFilter ... />`.

---

## Section 3: Web Guide Detail — Button Layout Fix

**Location:** `apps/web/src/app/(community)/guides/[id]/page.tsx` right sidebar action area

Change the Save / Download / Manage button container from a stacked layout to:

```tsx
<div className="flex gap-2">
  <SaveButton ... className="flex-1" />
  <DownloadButton ... className="flex-1" />
  {isOwner && <ManageButton ... className="flex-1" />}
</div>
```

All three buttons receive `flex-1` so they share width equally when all present, or fill between themselves when Manage is absent. Verify the `isOwner` conditional (comparing `session.user.id === guide.user.id`) is already correct — if not, fix it.

---

## Section 4: Block Saving Featured Guides

### Web page (`apps/web/src/app/(community)/guides/[id]/page.tsx`)
The server already has `guide.isFeatured` from the DB query. Pass it as a prop to the client action area. Conditionally hide `<SaveButton>` when `isFeatured === true`. No change to `SaveButton` itself.

### API guard (`apps/web/src/app/api/guides/[id]/save/route.ts`)
Add a check after fetching the guide:
```ts
if (guide.isFeatured) return NextResponse.json({ error: 'Featured guides cannot be saved' }, { status: 403 })
```
This prevents saves via direct API calls regardless of UI state.

---

## Section 5: Desktop Delete-from-Cloud Flow

### electron-store: store cloudAuthorId on push
In `apps/desktop/electron/main/index.ts`, inside the `cloudPushGuide` success path, store:
```ts
store.set(`guides.${storeKey}.cloudAuthorId`, authUserId)
```
where `authUserId` is the currently authenticated user's ID (already available from the stored auth token at push time).

### New IPC: cloudDeleteGuide
**Preload** (`apps/desktop/electron/preload/index.ts`):
```ts
cloudDeleteGuide: (cloudId: string) => ipcRenderer.invoke('cloudDeleteGuide', cloudId)
```

**Main handler** (`apps/desktop/electron/main/index.ts`):
```ts
ipcMain.handle('cloudDeleteGuide', async (_, cloudId: string) => {
  const token = store.get('authToken')
  const res = await fetch(`${API_BASE}/api/cloud/guides/${cloudId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return { error: await res.text() }
  return {}
})
```

### New API route: DELETE /api/cloud/guides/[id]
**File:** `apps/web/src/app/api/cloud/guides/[id]/route.ts` (add DELETE export alongside any existing GET/POST)

```ts
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getApiUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guide = await db.guide.findUnique({ where: { id: params.id } })
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (guide.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.guide.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
```

Orphaned `SavedGuide` rows for this guide are cleaned up automatically via the cascade delete defined on the model.

### Delete flow in renderer (Guides.tsx / GuideEditor)
When delete is triggered for a guide:
1. Call `cloudGetSyncState(filePath)` — already available
2. If `cloudId` exists, read `cloudAuthorId` from sync state (expose it from `cloudGetSyncState` response or via a new `cloudGetSyncState` field)
3. Compare `cloudAuthorId` with current auth user id (available from `getAuthState()`)
4. If match → show confirmation modal:
   > *"This guide is synced to the cloud. Remove it from there too? This cannot be undone."*
   > Buttons: **"Delete locally only"** | **"Delete everywhere"**
5. "Delete everywhere" → call `cloudDeleteGuide(cloudId)` then `deleteGuide(filePath)`
6. "Delete locally only" → call `deleteGuide(filePath)` only, leave cloud entry intact
7. No `cloudId` or not author → proceed directly to `deleteGuide(filePath)` with no modal

**Note:** `cloudAuthorId` is stored in electron-store (written at push time). The `cloudGetSyncState` handler reads it from the store and includes it in the returned object alongside `cloudId`, `cloudVersion`, `status`. No cloud API call is needed to retrieve it.

---

## Section 6: Desktop Saved Guides — Poll Interval + Refresh Button

### Poll interval (`apps/desktop/src/hooks/useSavedGuides.ts`)
Change `setInterval` delay from 5 minutes to **2 minutes** (120 000 ms).

### Expose refresh callback
The hook already returns `{ guides, loading, refresh }`. The `refresh` function is passed to `Guides` via `App.tsx` but currently unused in the Saved section UI.

### Refresh button in Guides.tsx (`packages/ui/src/Guides.tsx`)
Add a small refresh icon button to the Saved guides section header, beside the collapse toggle. On click, call `onSavedRefresh` prop (new prop alongside existing `savedGuides`/`savedGuidesLoading`/`onSavedPull`). Wire `onSavedRefresh` to `savedGuides.refresh` in `App.tsx`.

Use the same `RefreshCw` icon from lucide-react already used in CloudPanel. Show a spinning state while `savedGuidesLoading` is true.

---

## Out of Scope
- Library (individual lineup index) — separate future feature
- WebSocket/push notifications for real-time sync — polling is sufficient
- Cleanup of existing saved-featured-guide DB rows — harmless orphans, no action needed
