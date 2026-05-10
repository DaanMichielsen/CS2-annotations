# Guide List & Cloud Sync Improvements — Spec A

**Date:** 2026-05-10
**Status:** Approved

## Overview

Fix a critical cloud status bug that causes all guides to show as unknown, clean up guide list visual styling, add name/map filtering, and add a smart sync button inside the guide editor.

No backend API changes required. All changes are in the desktop app and shared UI package.

---

## 1. Cloud Status Bug Fix

### Root cause

`apps/desktop/electron/main/index.ts` line 787:

```typescript
const res = await fetch(`${WEB_API}\guides`, { headers: cloudHeaders() })
```

The backslash `\g` is not a valid escape sequence in a JavaScript template literal. It silently becomes `g`, producing the URL `https://cs2annotations.com/apiguides` (missing the `/`). The fetch fails or returns a 404, the handler returns `{ states: {} }`, and every guide's status stays unknown — even after manual refresh.

### Fix

Change `\guides` to `/guides` on that single line:

```typescript
const res = await fetch(`${WEB_API}/guides`, { headers: cloudHeaders() })
```

**File:** `apps/desktop/electron/main/index.ts`

---

## 2. Guide List Visual Polish

### Component location

`packages/ui/src/Guides.tsx`

### Row background tint — remove

Currently both "Featured map guides" and "Your guides" rows set `backgroundColor: dim` (the map's `rgba(accent, 0.08)` value) as an inline style. This creates a heavy, cluttered look.

**Change:** Remove `backgroundColor: dim` from the inline style on all guide row buttons/divs. The `border-l-[3px]` colored left border stays — it preserves map identity without cluttering the full row.

Affected rows:
- Featured installed row (line 291): remove `backgroundColor: dim` from the `style` prop
- Featured uninstalled row (line 307): remove `backgroundColor: dim` (it only has `borderLeftColor: accent` already — verify no dim applied)
- Your guides row (line 343): remove `backgroundColor: dim` from the `style` prop

### New Guide button contrast

The button already applies `var(--color-brand)` inline. The `disabled:opacity-60` state makes it appear washed out when no guide name has been typed (which is the default). 

**Change:** Add `hover:opacity-90` so the enabled state is clearly distinct from disabled. Also ensure the button text uses `font-semibold` for better legibility at the violet background color.

```tsx
className="px-4 py-2 rounded text-white text-sm font-semibold cursor-pointer disabled:opacity-40 hover:opacity-90 transition-opacity"
style={{ backgroundColor: 'var(--color-brand)' }}
```

Note: change `disabled:opacity-60` to `disabled:opacity-40` so the contrast between enabled and disabled states is more obvious.

---

## 3. Guide Filtering

### Component location

`packages/ui/src/Guides.tsx` — filter state is local `useState`, no prop changes needed in `App.tsx`.

### New state

```typescript
const [nameFilter, setNameFilter] = useState('')
const [mapFilter, setMapFilter] = useState<string | null>(null)  // null = All
```

### Filter UI layout

Rendered between the "New guide" creation row and the guide list sections. Two rows:

**Row 1 — Name search:**
```
[🔍 Search guides...                    ]
```
A full-width text input, `placeholder="Search guides…"`, zinc-800 background, zinc-600 border on focus. Filters by guide name (case-insensitive substring).

**Row 2 — Map chips:**
A wrapping flex row of small chips. First chip is "All" (always shown). Then one chip per known map from `KNOWN_MAPS` exported by `@cs2ann/shared/mapColors`. Each chip shows the 12×12 map icon + short label (e.g. "INFERNO").

Chip styling:
- **Inactive:** `bg-zinc-800 text-zinc-400 border border-zinc-700`
- **Active (selected map):** inline `backgroundColor: accent, color: '#fff'` using the map's `getMapColor()` accent
- **All chip active:** `bg-violet-700 text-white`

Only one map chip can be active at a time. Clicking an active map chip deselects it (returns to "All").

### Filter logic

```typescript
function matchesFilters(g: GuideItem): boolean {
  const nameOk = !nameFilter || g.name.toLowerCase().includes(nameFilter.toLowerCase())
  const mapOk = !mapFilter || g.mapName === mapFilter
  return nameOk && mapOk
}
```

Apply to both `featured` and `yours` arrays before rendering. If a section has zero results after filtering, hide the section header too.

```typescript
const filteredFeatured = featured.filter(matchesFilters)
const filteredYours = yours.filter(matchesFilters)
```

### Map chip data source

Import `KNOWN_MAPS` and `getMapColor` from `@cs2ann/shared`. `KNOWN_MAPS` is `string[]` — the map keys in order (e.g. `['de_mirage', 'de_inferno', ...]`). For each chip, call `getMapColor(mapName)` to get `{ label, accent, dim, icon }`. Render chips in the same order as `KNOWN_MAPS`.

### Persistence

Filter state is ephemeral — resets on app restart. No persistence needed.

---

## 4. Smart Sync Button in the Guide Editor

### Component locations

- `packages/ui/src/GuideEditor.tsx` — receives new props, renders the button
- `packages/ui/src/Guides.tsx` — passes cloud status + callbacks to GuideEditor
- `apps/desktop/src/App.tsx` — passes cloud callbacks down through Guides

### New GuideEditor props

Add to `GuideEditorProps` interface:

```typescript
cloudStatus?: GuideSyncState        // from @cs2ann/shared
onCloudPush?: () => void
onCloudPull?: () => void
```

All optional. Button only renders when `cloudStatus` is provided and the guide is not a workshop guide (`!isWorkshop`).

### Button rendering logic

In the GuideEditor toolbar, next to the Save and Delete buttons:

```typescript
function CloudSyncButton({ status, onPush, onPull }: {
  status: GuideSyncState
  onPush?: () => void
  onPull?: () => void
}) {
  if (status.status === 'loading') {
    return <span className="p-1.5 text-zinc-600"><RefreshCw size={14} className="animate-spin" /></span>
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
  // not_in_cloud or local_ahead
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

Required lucide-react icons: `Upload`, `Download`, `CheckCircle`, `RefreshCw` (already imported in GuideEditor or available from lucide-react).

### Data flow

`Guides.tsx` already has `cloudStatuses` prop. When rendering GuideEditor for an open local guide:

```typescript
<GuideEditor
  ...existing props...
  cloudStatus={openGuide.source === 'local' ? cloudStatuses[openGuide.filePath] : undefined}
  onCloudPush={openGuide.source === 'local' ? () => void handleCloudPush(openGuide.filePath) : undefined}
  onCloudPull={openGuide.source === 'local' ? () => void handleCloudPull(openGuide.filePath) : undefined}
/>
```

`handleCloudPush` and `handleCloudPull` are new functions in `Guides.tsx` that call `window.electronAPI` directly (same pattern as `CloudPanel.tsx`). After a successful push or pull they call `onCloudRefresh()`.

**New props on `Guides`:**

```typescript
interface GuidesProps {
  onGuideChange?: (guide: OpenGuideInfo | null) => void
  cloudStatuses?: Record<string, GuideSyncState>
  onCloudRefresh?: () => void   // NEW — called after push/pull to trigger useCloudStatus.refresh
}
```

`App.tsx` passes `cloudStatus.refresh` as `onCloudRefresh`.

### Push/pull implementation in Guides.tsx

```typescript
async function handleCloudPush(filePath: string) {
  const state = cloudStatuses[filePath]
  const guide = guides.find((g) => g.path === filePath)
  if (!guide) return
  await (window.electronAPI as any).cloudPushGuide({
    filePath,
    title: guide.name,
    map: guide.mapName ?? '',
    nodeCount: openGuide?.nodes.length ?? 0,
    cloudId: state?.cloudId,
    cloudVersion: state?.cloudVersion,
  })
  onCloudRefresh?.()
}

async function handleCloudPull(filePath: string) {
  const state = cloudStatuses[filePath]
  if (!state?.cloudId) return
  await (window.electronAPI as any).cloudPullGuide({ cloudId: state.cloudId, filePath })
  onCloudRefresh?.()
}
```

Error handling: keep it minimal — errors surface via the existing `CloudPanel` per-guide error display. The editor button just triggers the action.

---

## 5. Scope & Constraints

- No backend API changes
- `KNOWN_MAPS` must be exported from `packages/shared/src/mapColors.ts` (verify it is, or add the export)
- `window.electronAPI` calls in `Guides.tsx` use `as any` cast (same pattern as `useCloudStatus.ts`) since the type definition doesn't include the cloud IPC methods
- Featured guides list stays as-is (hardcoded Workshop IDs) — admin-driven featured guides is deferred to a future spec
- Filter state is not persisted — ephemeral only

---

## 6. Out of Scope

- Admin panel or database changes for featured guides
- Error toast/notification UI for push/pull failures in the editor (CloudPanel handles error display)
- Conflict resolution UI (existing behavior retained)
- Any changes to CloudPanel itself
