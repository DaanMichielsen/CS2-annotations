6# Design: Onboarding & UX Improvements
**Date:** 2026-04-28  
**Status:** Approved

---

## Overview

Four independent improvements to make the app easier for new users and fix several broken or confusing workflows: a workshop guide registry with featured suggestions, a persistent top nav with Settings modal, line annotation UX guardrails, and a set of small but impactful fixes.

---

## 1. Workshop Guide Registry & Detection

### Hardcoded Registry

A constant `FEATURED_GUIDES` in the main process lists the known active-map-pool annotation guide workshop IDs:

| Workshop ID  | Name                  |
|--------------|-----------------------|
| 3387810001   | inferno_essential     |
| 3387870747   | ancient_essential     |
| 3388581972   | anubis_essential      |
| 3388611848   | overpass_essential    |
| 3388638091   | nuke_essential        |
| 3388681214   | dust2_essential       |
| 3388737112   | mirage_essential      |
| 3388761697   | vertigo_essential     |
| *(placeholder)* | cache_essential    |

### Detection Logic

For **featured registry items**: check if `steamapps/workshop/content/730/<id>/` exists AND contains a `.txt` file whose first line matches the KV3 header prefix `<!-- kv3 encoding:text:version{`. Installation status determines rendering (see UI below).

For **non-registry workshop items** (user-downloaded guides not in the registry): scan the workshop/730 directory as before, but with a looser check — a folder qualifies if it contains at least one `.txt` file whose first line matches the KV3 header. The old `folderContainsOnlyTxtFiles` guard is removed. This fixes the re-add bug where Steam bundles extra files on re-download.

### MapName Metadata

When a `.txt` file passes the header check, scan the first 10 lines for a `MapName = "..."` field and extract the value. The annotation files are the source of truth — no separate metadata store or cache. `mapName` is read fresh from the file on every `listGuides` call and returned as an optional field in the in-memory result only. Not used for filtering or display in this iteration — reserved for future map grouping and logo display.

### `listGuides` Return Type

```ts
{ name: string; path: string; source: 'local' | 'workshop'; mapName?: string; workshopId?: string; installed: boolean }
```

`installed: false` entries only appear for featured registry items that are not yet downloaded. Non-registry workshop items are always `installed: true` by definition (they can only be discovered if the folder exists).

### UI — Guides List

- Section header **"Featured map guides"** always appears above the guide list.
- Featured guides render in order. Installed ones look identical to today's workshop guides. Uninstalled ones render greyed-out with a **"Subscribe"** button that opens `steam://url/CommunityFilePage/<id>`.
- Local guides and non-registry workshop guides appear below a **"Your guides"** section header.

---

## 2. Persistent Top Nav & Settings Modal

### Top Nav Bar

A thin persistent bar at the very top of the app (all pages, all states). Contains:
- Left: app name / wordmark
- Right: ⚙ icon button that opens Settings

The bar is one button-height tall (~36px). It replaces the current tab-based navigation between Guides and Settings pages.

### Settings as Centered Modal

Clicking ⚙ sets `showSettings: boolean` in `App.tsx` to `true`. The current page (Guides list or Guide editor) stays fully mounted underneath. Settings renders as a fixed centered modal with a semi-transparent backdrop, matching the style of `AnnotationCreateModal`.

- ✕ button and backdrop click both close the modal (backdrop click is intentionally kept here since Settings has no multi-step flow that could be accidentally interrupted).
- Settings content is unchanged — same fields, same layout, just inside the modal container.
- `App.tsx` navigation simplifies: no more "page" state switching between Guides and Settings. Only `showSettings` toggles.

---

## 3. Line Annotation UX

### Root Cause

A line requires at least two nodes: a master node (from `annotation_create line <mount> new`) and at least one child node (from `annotation_create line <mount>`) connected via `MasterNodeId`. A single master node with no children is invisible in CS2.

### Modal State

The line creation modal tracks:
- `lineStarted: boolean` — set to `true` after "Start new line" is clicked once
- `pointsPlaced: number` — increments by 1 on Start, and again on each Add point click

### Button Behaviour

| Button | Enabled when | After click |
|--------|-------------|-------------|
| Start new line | `!lineStarted` | Disabled (✓ indicator shown), Step 1 marked done |
| + Add point | `lineStarted` | `pointsPlaced++`, counter updates |
| Save annotation | `pointsPlaced >= 2` | Proceeds to save |
| Abort & discard | always | Discards |

"Save annotation" shows a tooltip `"Add at least one point first"` when hovered while disabled.

### Step Indicators

The three instruction steps in the modal use visual state:
- **Pending** — muted text, no icon
- **Active** — bright text, pulsing dot
- **Done** — muted text, ✓ icon

### Line Label

An optional **Line label** text input. Value is stored in `CreateMeta.lineLabel`. After `annotation_save` fires and the file watcher detects the new nodes, the metadata-patch logic applies the label as `Title.Text` on the master node (the node with no `MasterNodeId`). If blank, no patch is applied.

---

## 4. Small Fixes

### Remove "Reload in CS2" Button

The button in `GuideEditor.tsx` that calls `annotation_load ${guideName}` is removed. The correct reload workflow is to unload and reload annotations manually in-game.

### Modal Click-Outside No Longer Closes

Remove the `onClick` dismiss handler from the overlay backdrop `<div>` in `AnnotationCreateModal.tsx`. The ✕ button remains as the only dismiss path. This prevents accidental data loss during multi-step line creation.

---

## Files Affected

| File | Changes |
|------|---------|
| `electron/main/index.ts` | Add `FEATURED_GUIDES` registry; rewrite workshop detection in `listGuides`; add `mapName` + `workshopId` + `installed` to return type |
| `electron/preload/index.ts` | Update `listGuides` return type |
| `src/vite-env.d.ts` | Update `ElectronAPI.listGuides` return type |
| `src/App.tsx` | Add `showSettings` state; add persistent `TopNav` component; remove page-switch nav |
| `src/components/TopNav.tsx` | New — thin persistent nav bar with app title and ⚙ button |
| `src/components/Guides.tsx` | Render featured + your-guides sections; handle `installed: false` entries |
| `src/components/GuideEditor.tsx` | Remove "Reload in CS2" button |
| `src/components/AnnotationCreateModal.tsx` | Remove backdrop click-to-close; add line state tracking + step indicators + line label field |
