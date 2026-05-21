# Media UX Improvements — Design Spec

_Date: 2026-05-21_

## Overview

Four targeted improvements to the annotation media experience: fixing the upload size limit, making media state scannable from the lineup list, wiring map pins to list expansion, and rebalancing the play mode layout.

---

## 1. Direct-to-Blob Upload

### Problem
The current upload path posts files through a Next.js API route. Vercel serverless functions cap request bodies at 4.5 MB. A typical 720p/30fps MP4 clip exceeds this immediately, producing `FUNCTION_PAYLOAD_TOO_LARGE`.

### Decision
Replace the multipart upload path with Vercel Blob client upload. The browser uploads directly to Vercel Blob; the API route becomes a thin token endpoint only.

### Implementation shape
- New endpoint `POST /api/guides/[id]/media/upload-token` — validates auth, returns a short-lived Vercel Blob client token scoped to the guide's media path.
- Client calls `@vercel/blob`'s `upload()` with the token; the blob URL is returned directly to the browser.
- Client then calls `POST /api/guides/[id]/media` (JSON, not multipart) with the resulting URL, slot, mediaType, and optional caption.
- The existing multipart POST handler in `route.ts` is removed.
- `VideoTrimmer` is removed from `MediaUploadModal`. Trimming is the user's responsibility before uploading.

---

## 2. Camera Icon Media Indicator on List Items

### Problem
The current "Manage media" button is hidden behind guide-level UI and opens a modal listing all grenades — too many steps to add media to a specific lineup, and no way to see at a glance which lineups lack media.

### Decision
Every row in `AnnotationList` gets a camera icon on the right side of the collapsed row, always visible. Icon state communicates media coverage:

- **Outline / dimmed** — no media attached to this node.
- **Filled / coloured (violet)** — at least one media item exists.

Clicking the icon opens a single modal pre-scoped to that node. The grenade selector dropdown is removed — the node is implicit from which row was clicked. `MediaUploadModal` gains a required `nodeId` prop; the internal grenade-selector state and `nodes` prop are removed.

### Modal layout
The modal has two sections in order:
1. **Existing media** — each item shown with a thumbnail/label and a remove button.
2. **Add slots** — upload fields for `full`, `standing`, `aim`, `landing` slots, with YouTube link option per slot.

The same modal handles both the "add" and "manage" cases. If a row has no media the existing section is empty; the upload slots are the only content.

---

## 3. Map Pin → List Item Expansion (Guide Detail Page)

### Problem
Clicking a pin on the map in the guide detail page has no effect on the `AnnotationList` rendered below. The two panels are unconnected.

### Decision
When a pin is clicked on the guide detail page's `InteractiveMapView`, the corresponding item in `AnnotationList` expands (same as clicking the item directly). No scroll. No highlight styling beyond the existing expanded state.

### Implementation shape
- `InteractiveMapView` already has an `onPinClick?: (nodeId: string) => void` prop.
- The guide detail page is a server component; state must live in a new thin client wrapper component (e.g. `GuideInteractionClient`) that renders `GuideNodeFilter` and `AnnotationList` and owns `expandedNodeId` state.
- `GuideInteractionClient` passes `onPinClick` down through `GuideNodeFilter` → `GuideAnnotationPreview` → `InteractiveMapView`, and passes `expandedNodeId` to `AnnotationList`.
- `AnnotationList` merges this with its own internal expanded state: if `expandedNodeId` matches a node, that node renders as expanded.

---

## 4. Play Mode Layout — Fixed Square Map

### Problem
The current layout gives the media panel a fixed `w-80` (320 px) sidebar. The map takes all remaining width. This wastes horizontal space on the map (which is square) and starves the media panel (which needs 16:9 width to show video well).

### Decision
The map is a fixed square: `aspect-square h-full`. Width equals height — no horizontal waste. The media panel (`flex-1`) fills all remaining horizontal space. The filter bar (grenade type pills, pin mode toggle) stays above the map because the filters control what is shown on the map.

### Layout structure
```
┌──────────────────────────────────────────┐
│ ┌─────────────────┐  ┌─────────────────┐ │
│ │ [filters]       │  │                 │ │
│ │ ┌─────────────┐ │  │  media panel    │ │
│ │ │             │ │  │  (flex-1)       │ │
│ │ │  map        │ │  │  16:9 video     │ │
│ │ │  (square)   │ │  │  fills width    │ │
│ │ │             │ │  │  naturally      │ │
│ │ └─────────────┘ │  │                 │ │
│ └─────────────────┘  └─────────────────┘ │
└──────────────────────────────────────────┘
```

The filter bar spans only the map column. The media panel is full-height with no filter bar above it. The square map's side length equals the viewport height minus the filter bar height. The media panel has no fixed width — it is whatever the viewport width minus the map width gives.

---

## Glossary updates

No new domain terms introduced. The existing **media panel** definition in `apps/web/CONTEXT.md` remains accurate.
