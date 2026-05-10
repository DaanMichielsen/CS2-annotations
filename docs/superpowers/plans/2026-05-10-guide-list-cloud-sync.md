# Guide List & Cloud Sync Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the cloud status bug that keeps all guides showing as unknown, polish the guide list UI, add name/map filtering, and add a smart push/pull button inside the guide editor.

**Architecture:** Four independent tasks in order: (1) one-line bug fix in the Electron main process, (2) visual polish in `Guides.tsx`, (3) filter state + filter UI in `Guides.tsx`, (4) new cloud sync button threaded through `GuideEditor` ← `Guides` ← `App`.

**Tech Stack:** React 18, TypeScript, Tailwind v4, Electron IPC, lucide-react, `@cs2ann/shared`.

---

## File Map

| Action | Path | What changes |
|---|---|---|
| Modify | `apps/desktop/electron/main/index.ts` | Fix backslash typo in fetch URL |
| Modify | `packages/ui/src/Guides.tsx` | Remove row tint, fix button, add filters, add cloud push/pull, new props |
| Modify | `packages/ui/src/GuideEditor.tsx` | New cloud props + CloudSyncButton component |
| Modify | `apps/desktop/src/App.tsx` | Pass `onCloudRefresh` to `<Guides>` |

---

## Task 1: Fix Cloud Status URL Bug

**Files:**
- Modify: `apps/desktop/electron/main/index.ts`

The `cloudGetAllSyncStates` IPC handler has a backslash instead of a forward slash in the fetch URL. JavaScript silently drops the backslash escape, producing `https://cs2annotations.com/apiguides` instead of the correct `https://cs2annotations.com/api/guides`. This causes every sync status to stay unknown forever.

- [ ] **Step 1: Fix the typo**

Open `apps/desktop/electron/main/index.ts`. Find the `cloudGetAllSyncStates` handler (around line 783). Change the fetch URL from:

```typescript
const res = await fetch(`${WEB_API}\guides`, { headers: cloudHeaders() })
```

to:

```typescript
const res = await fetch(`${WEB_API}/guides`, { headers: cloudHeaders() })
```

- [ ] **Step 2: Build to verify no TypeScript errors**

From `c:\Users\appel\Desktop\Projects\CS2-annotations`:

```bash
pnpm --filter @cs2ann/desktop build
```

Expected: `✓ built` with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/electron/main/index.ts
git commit -m "fix(desktop): correct backslash typo in cloudGetAllSyncStates fetch URL"
```

---

## Task 2: Guide List Visual Polish

**Files:**
- Modify: `packages/ui/src/Guides.tsx`

Remove the map-colored background tint from all guide rows (keep the left border). Fix the "New guide" button disabled-state contrast.

- [ ] **Step 1: Remove background tint from the featured installed row**

In `packages/ui/src/Guides.tsx`, find the featured installed button (it has `border-l-[3px]` and `backgroundColor: dim` in its inline style). It looks like this:

```tsx
<button
  type="button"
  className="w-full flex items-center justify-between gap-2 min-w-0 px-3 py-2.5 text-left bg-zinc-800/60 hover:bg-zinc-800 rounded text-zinc-200 cursor-pointer text-[0.9rem] transition-colors border-l-[3px]"
  style={{ borderLeftColor: accent, backgroundColor: dim }}
  onClick={() => openGuideByPath(g.name, g.path, g.source)}
>
```

Change the `style` prop to only keep `borderLeftColor`:

```tsx
<button
  type="button"
  className="w-full flex items-center justify-between gap-2 min-w-0 px-3 py-2.5 text-left bg-zinc-800/60 hover:bg-zinc-800 rounded text-zinc-200 cursor-pointer text-[0.9rem] transition-colors border-l-[3px]"
  style={{ borderLeftColor: accent }}
  onClick={() => openGuideByPath(g.name, g.path, g.source)}
>
```

- [ ] **Step 2: Remove background tint from the "Your guides" row**

Find the "Your guides" row button (it also has `backgroundColor: dim`):

```tsx
<button
  type="button"
  className="flex-1 flex items-center gap-2.5 min-w-0 px-3 py-2.5 text-left rounded text-zinc-200 cursor-pointer text-[0.9rem] transition-colors border-l-[3px]"
  style={{ borderLeftColor: accent, backgroundColor: dim }}
  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
  onClick={() => openGuideByPath(g.name, g.path, g.source)}
>
```

Remove `backgroundColor: dim`:

```tsx
<button
  type="button"
  className="flex-1 flex items-center gap-2.5 min-w-0 px-3 py-2.5 text-left rounded text-zinc-200 cursor-pointer text-[0.9rem] transition-colors border-l-[3px]"
  style={{ borderLeftColor: accent }}
  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
  onClick={() => openGuideByPath(g.name, g.path, g.source)}
>
```

Note: also remove the `{ accent, dim }` destructure and replace with `{ accent }` only since `dim` is no longer used in the "Your guides" section (the featured section still uses `accent`):

```typescript
const { accent } = getMapColor(g.mapName)
```

- [ ] **Step 3: Fix the New Guide button contrast**

Find the "New guide" button (it has `style={{ backgroundColor: 'var(--color-brand)' }}`):

```tsx
<button
  type="button"
  className="px-4 py-2 rounded text-white text-sm cursor-pointer disabled:opacity-60 transition-colors"
  style={{ backgroundColor: 'var(--color-brand)' }}
  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-brand-hover)')}
  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-brand)')}
  onClick={createAndOpenGuide}
  disabled={creating || !newGuideName.trim()}
>
  {creating ? 'Creating…' : 'New guide'}
</button>
```

Replace with (add `font-semibold`, change `disabled:opacity-60` to `disabled:opacity-40`):

```tsx
<button
  type="button"
  className="px-4 py-2 rounded text-white text-sm font-semibold cursor-pointer disabled:opacity-40 transition-opacity"
  style={{ backgroundColor: 'var(--color-brand)' }}
  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--color-brand-hover)' }}
  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-brand)')}
  onClick={createAndOpenGuide}
  disabled={creating || !newGuideName.trim()}
>
  {creating ? 'Creating…' : 'New guide'}
</button>
```

- [ ] **Step 4: Build to verify**

```bash
pnpm --filter @cs2ann/ui build
```

Expected: `✓ built` with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/Guides.tsx
git commit -m "feat(ui): remove guide row background tint, improve New Guide button contrast"
```

---

## Task 3: Guide Filtering (Name Search + Map Chips)

**Files:**
- Modify: `packages/ui/src/Guides.tsx`

Add name search and map chip filtering above the guide list. Filters are local state only — no persistence.

- [ ] **Step 1: Add imports**

At the top of `packages/ui/src/Guides.tsx`, the existing imports include:

```typescript
import { getMapColor } from '@cs2ann/shared'
```

Change to also import `KNOWN_MAPS`:

```typescript
import { getMapColor, KNOWN_MAPS } from '@cs2ann/shared'
```

- [ ] **Step 2: Add filter state**

Inside `export default function Guides(...)`, alongside the existing `useState` calls, add:

```typescript
const [nameFilter, setNameFilter] = useState('')
const [mapFilter, setMapFilter] = useState<string | null>(null)
```

- [ ] **Step 3: Add the matchesFilters helper and filtered arrays**

Just before the `return (` statement (where `featured` and `yours` are computed), add:

```typescript
function matchesFilters(g: GuideItem): boolean {
  const nameOk = !nameFilter || g.name.toLowerCase().includes(nameFilter.toLowerCase())
  const mapOk = !mapFilter || g.mapName === mapFilter
  return nameOk && mapOk
}
const filteredFeatured = featured.filter(matchesFilters)
const filteredYours = yours.filter(matchesFilters)
```

Note: `featured` and `yours` are computed just above this — they use `guides` state. The filtered arrays replace them in the JSX below.

- [ ] **Step 4: Add the filter UI**

In the JSX, after the "New guide" creation block (the `<div className="flex flex-col gap-2 mb-4 shrink-0">` block) and before the `{/* Featured guides */}` comment, insert this filter UI:

```tsx
{/* Filter controls */}
<div className="flex flex-col gap-1.5 mb-3 shrink-0">
  <input
    type="text"
    value={nameFilter}
    onChange={(e) => setNameFilter(e.target.value)}
    placeholder="Search guides…"
    className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600"
  />
  <div className="flex flex-wrap gap-1">
    <button
      type="button"
      className={`px-1.5 py-0.5 rounded text-[0.65rem] font-semibold uppercase tracking-wide border transition-colors ${
        !mapFilter
          ? 'bg-violet-700 text-white border-transparent'
          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200'
      }`}
      onClick={() => setMapFilter(null)}
    >
      All
    </button>
    {KNOWN_MAPS.map((mapName) => {
      const { label, accent, icon } = getMapColor(mapName)
      const isActive = mapFilter === mapName
      return (
        <button
          key={mapName}
          type="button"
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.65rem] font-semibold uppercase tracking-wide border transition-colors ${
            isActive ? 'border-transparent text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
          style={isActive ? { backgroundColor: accent } : undefined}
          onClick={() => setMapFilter(isActive ? null : mapName)}
        >
          {icon && <img src={icon} alt="" width={10} height={10} className="shrink-0" />}
          {label}
        </button>
      )
    })}
  </div>
</div>
```

- [ ] **Step 5: Use filtered arrays in the JSX**

In the JSX, find where `featured` is mapped:

```tsx
{featured.map((g) => {
```

Replace with `filteredFeatured`:

```tsx
{filteredFeatured.map((g) => {
```

Find the `featured.length === 0` check:

```tsx
{featured.length === 0 && (
  <p className="text-zinc-600 text-sm">No featured guides configured. Set Workshop content folder in Settings.</p>
)}
```

Replace with (only show the empty state message when there are featured guides at all but none match the filter):

```tsx
{featured.length === 0 && (
  <p className="text-zinc-600 text-sm">No featured guides configured. Set Workshop content folder in Settings.</p>
)}
{featured.length > 0 && filteredFeatured.length === 0 && (
  <p className="text-zinc-600 text-sm">No featured guides match the filter.</p>
)}
```

Find the "Your guides" section:

```tsx
{yours.length > 0 && (
  <div className="mt-4">
    ...
    {yours.map((g) => {
```

Replace `yours.length > 0` with `filteredYours.length > 0` and `yours.map` with `filteredYours.map`:

```tsx
{filteredYours.length > 0 && (
  <div className="mt-4">
    <p
      className="m-0 mb-2 text-[0.7rem] text-zinc-500 uppercase tracking-wider font-semibold"
      style={{ fontFamily: 'var(--font-display)' }}
    >
      Your guides
    </p>
    <ul className="list-none m-0 p-0 space-y-1">
      {filteredYours.map((g) => {
```

Also hide the section header when all your guides are filtered out — this is already handled since the whole block is `filteredYours.length > 0 && (...)`.

- [ ] **Step 6: Build to verify**

```bash
pnpm --filter @cs2ann/ui build
```

Expected: `✓ built` with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/Guides.tsx
git commit -m "feat(ui): add name search and map chip filtering to guide list"
```

---

## Task 4: Smart Sync Button in Guide Editor

**Files:**
- Modify: `packages/ui/src/GuideEditor.tsx`
- Modify: `packages/ui/src/Guides.tsx`
- Modify: `apps/desktop/src/App.tsx`

Add a smart Push/Pull/Synced button to the guide editor top bar. Wired via new props through `Guides` from `App`.

- [ ] **Step 1: Add lucide-react imports to GuideEditor**

At the top of `packages/ui/src/GuideEditor.tsx`, there are currently no lucide-react imports. Add:

```typescript
import { Upload, Download, CheckCircle, RefreshCw } from 'lucide-react'
```

- [ ] **Step 2: Import GuideSyncState in GuideEditor**

`GuideEditor.tsx` currently imports from `@cs2ann/shared` but not `GuideSyncState`. Add it:

```typescript
import type { GuideSyncState } from '@cs2ann/shared'
```

The existing import line looks like:
```typescript
import { GRENADE_TYPES, defaultTextDesc, defaultPosition, defaultAngles, generateId } from '@cs2ann/shared'
```

Add `GuideSyncState` as a type import on a separate line after it:
```typescript
import type { GuideSyncState } from '@cs2ann/shared'
```

- [ ] **Step 3: Add new props to GuideEditorProps**

Find the `GuideEditorProps` interface (around line 43):

```typescript
interface GuideEditorProps {
  guideName: string
  filePath?: string
  isWorkshop?: boolean
  canDelete?: boolean
  nodes: AnnotationNode[]
  root: Record<string, unknown>
  nodesKey: string
  onSave: (nodes: AnnotationNode[], root: Record<string, unknown>, nodesKey: string) => Promise<{ error?: string }>
  onSaveAsLocalGuide?: (
    localName: string,
    root: Record<string, unknown>,
    nodes: AnnotationNode[]
  ) => Promise<{ error?: string; path?: string; loadName?: string }>
  onBack: () => void
  onDeleted?: () => void
}
```

Add three new optional props at the end:

```typescript
interface GuideEditorProps {
  guideName: string
  filePath?: string
  isWorkshop?: boolean
  canDelete?: boolean
  nodes: AnnotationNode[]
  root: Record<string, unknown>
  nodesKey: string
  onSave: (nodes: AnnotationNode[], root: Record<string, unknown>, nodesKey: string) => Promise<{ error?: string }>
  onSaveAsLocalGuide?: (
    localName: string,
    root: Record<string, unknown>,
    nodes: AnnotationNode[]
  ) => Promise<{ error?: string; path?: string; loadName?: string }>
  onBack: () => void
  onDeleted?: () => void
  cloudStatus?: GuideSyncState
  onCloudPush?: () => void
  onCloudPull?: () => void
}
```

- [ ] **Step 4: Add CloudSyncButton component**

Add this function before the main `export default function GuideEditor` (after the helpers section, around line 83):

```typescript
function CloudSyncButton({ status, onPush, onPull }: {
  status: GuideSyncState
  onPush?: () => void
  onPull?: () => void
}) {
  if (status.status === 'loading') {
    return (
      <span className="p-1.5 text-zinc-600" title="Checking cloud status…">
        <RefreshCw size={14} className="animate-spin" />
      </span>
    )
  }
  if (status.status === 'synced') {
    return (
      <span className="p-1.5 text-emerald-600" title="Synced with cloud">
        <CheckCircle size={14} />
      </span>
    )
  }
  if (status.status === 'cloud_ahead') {
    return (
      <button
        type="button"
        className="flex items-center gap-1 px-2 py-1 bg-yellow-900/40 border border-yellow-700 hover:bg-yellow-900/70 text-yellow-300 rounded text-xs transition-colors"
        title="Cloud has a newer version — pull to update"
        onClick={onPull}
      >
        <Download size={12} /> Pull
      </button>
    )
  }
  return (
    <button
      type="button"
      className="flex items-center gap-1 px-2 py-1 rounded text-white text-xs transition-opacity hover:opacity-90"
      style={{ backgroundColor: 'var(--color-brand)' }}
      title={status.status === 'not_in_cloud' ? 'Back up to cloud' : 'Push local changes to cloud'}
      onClick={onPush}
    >
      <Upload size={12} /> Push
    </button>
  )
}
```

- [ ] **Step 5: Destructure new props in GuideEditor function signature**

Find the `export default function GuideEditor({` signature (around line 85). It currently ends with `onDeleted,`. Add the three new props:

```typescript
export default function GuideEditor({
  guideName,
  filePath = '',
  isWorkshop = false,
  canDelete = false,
  nodes: initialNodes,
  root: initialRoot,
  nodesKey: initialNodesKey,
  onSave,
  onSaveAsLocalGuide,
  onBack,
  onDeleted,
  cloudStatus,
  onCloudPush,
  onCloudPull,
}: GuideEditorProps) {
```

- [ ] **Step 6: Add CloudSyncButton to the top bar**

Find the top bar action buttons section (around line 686):

```tsx
<div className="flex items-center gap-1.5 shrink-0">
  <button type="button" className={btnPrimary} onClick={handleSave} disabled={saveStatus === 'saving'}>
    {saveStatus === 'saving' ? 'Saving…' : 'Save'}
  </button>
  {canDelete && filePath && (
    <button type="button" className={btnDanger} onClick={handleDeleteGuideFile} disabled={deleteStatus === 'deleting'}>
      {deleteStatus === 'deleting' ? 'Deleting…' : 'Delete file'}
    </button>
  )}
</div>
```

Replace with (CloudSyncButton inserted between Save and Delete):

```tsx
<div className="flex items-center gap-1.5 shrink-0">
  <button type="button" className={btnPrimary} onClick={handleSave} disabled={saveStatus === 'saving'}>
    {saveStatus === 'saving' ? 'Saving…' : 'Save'}
  </button>
  {cloudStatus && !isWorkshop && (
    <CloudSyncButton status={cloudStatus} onPush={onCloudPush} onPull={onCloudPull} />
  )}
  {canDelete && filePath && (
    <button type="button" className={btnDanger} onClick={handleDeleteGuideFile} disabled={deleteStatus === 'deleting'}>
      {deleteStatus === 'deleting' ? 'Deleting…' : 'Delete file'}
    </button>
  )}
</div>
```

- [ ] **Step 7: Build GuideEditor to verify**

```bash
pnpm --filter @cs2ann/ui build
```

Expected: `✓ built` with no TypeScript errors.

- [ ] **Step 8: Add onCloudRefresh prop to GuidesProps**

In `packages/ui/src/Guides.tsx`, find the `GuidesProps` interface:

```typescript
interface GuidesProps {
  onGuideChange?: (guide: OpenGuideInfo | null) => void
  cloudStatuses?: Record<string, GuideSyncState>
}
```

Add the new prop:

```typescript
interface GuidesProps {
  onGuideChange?: (guide: OpenGuideInfo | null) => void
  cloudStatuses?: Record<string, GuideSyncState>
  onCloudRefresh?: () => void
}
```

- [ ] **Step 9: Destructure onCloudRefresh in Guides function**

Find the function signature:

```typescript
export default function Guides({ onGuideChange, cloudStatuses = {} }: GuidesProps = {}) {
```

Add the new prop:

```typescript
export default function Guides({ onGuideChange, cloudStatuses = {}, onCloudRefresh }: GuidesProps = {}) {
```

- [ ] **Step 10: Add handleCloudPush and handleCloudPull to Guides**

Add these two functions inside `Guides`, just before the `if (openGuide) {` block (around line 172):

```typescript
async function handleCloudPush() {
  if (!openGuide) return
  const state = cloudStatuses[openGuide.filePath]
  await (window.electronAPI as any).cloudPushGuide({
    filePath: openGuide.filePath,
    title: openGuide.name,
    map: (openGuide.root['MapName'] as string | undefined) ?? openGuide.mapName ?? '',
    nodeCount: openGuide.nodes.length,
    cloudId: state?.cloudId,
    cloudVersion: state?.cloudVersion,
  })
  onCloudRefresh?.()
}

async function handleCloudPull() {
  if (!openGuide) return
  const state = cloudStatuses[openGuide.filePath]
  if (!state?.cloudId) return
  await (window.electronAPI as any).cloudPullGuide({ cloudId: state.cloudId, filePath: openGuide.filePath })
  onCloudRefresh?.()
}
```

- [ ] **Step 11: Pass cloud props to GuideEditor**

In the `if (openGuide)` render block, find the `<GuideEditor` JSX. It currently ends with `onDeleted={...}`. Add the three new props:

```tsx
<GuideEditor
  guideName={openGuide.name}
  filePath={openGuide.filePath}
  isWorkshop={isWorkshop}
  canDelete={openGuide.source === 'local'}
  nodes={openGuide.nodes}
  root={openGuide.root}
  nodesKey={openGuide.nodesKey}
  onSave={async (nodes: AnnotationNode[], root: Record<string, unknown>, nodesKey: string) => {
    const res = await adapter.saveGuide({ id: openGuide.filePath, root, nodes, nodesKey, createBackup: true })
    if (!res.error) setOpenGuide((prev) => (prev ? { ...prev, nodes, root, nodesKey } : null))
    return res
  }}
  onSaveAsLocalGuide={isWorkshop
    ? async (localName: string, root: Record<string, unknown>, nodes: AnnotationNode[]) => {
        const res = await adapter.saveAsLocal({ root, nodes, nodesKey: openGuide.nodesKey, localName })
        if (!res.error && res.id && res.loadName) {
          await loadGuides()
          const rootPath = await adapter.getAnnotationsRoot?.()
          if (!rootPath) return res
          const localPath = [rootPath.replace(/[/\\]+$/, ''), res.loadName, res.loadName + '.txt'].join('\\')
          await openGuideByPath(res.loadName, localPath, 'local')
        }
        return res
      }
    : undefined}
  onBack={() => setOpenGuide(null)}
  onDeleted={async () => { await loadGuides() }}
  cloudStatus={openGuide.source === 'local' ? cloudStatuses[openGuide.filePath] : undefined}
  onCloudPush={openGuide.source === 'local' ? () => void handleCloudPush() : undefined}
  onCloudPull={openGuide.source === 'local' ? () => void handleCloudPull() : undefined}
/>
```

- [ ] **Step 12: Pass onCloudRefresh from App.tsx**

In `apps/desktop/src/App.tsx`, find:

```tsx
<Guides
  cloudStatuses={cloudStatus.statuses}
/>
```

Add the new prop:

```tsx
<Guides
  cloudStatuses={cloudStatus.statuses}
  onCloudRefresh={cloudStatus.refresh}
/>
```

- [ ] **Step 13: Build everything to verify**

```bash
pnpm --filter @cs2ann/ui build
pnpm --filter @cs2ann/desktop build
```

Expected: Both build with no TypeScript errors.

- [ ] **Step 14: Commit**

```bash
git add packages/ui/src/GuideEditor.tsx packages/ui/src/Guides.tsx apps/desktop/src/App.tsx
git commit -m "feat(ui): add smart cloud sync button to guide editor"
```
