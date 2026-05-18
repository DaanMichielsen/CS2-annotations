# Annotation Media — Design Spec

**Date:** 2026-05-18
**Status:** Approved, ready for implementation planning

---

## Overview

Add per-annotation media (video + image) to the CS2 Annotations platform. Users can attach media to three slots per grenade lineup — standing position, aim position, and landing position — in both video and image format, via direct upload or YouTube link. Media is displayed across the map view, annotation list, library, and desktop app.

---

## Goals

- Guide owners and community members can attach visual proof to grenade lineups.
- Media surfaces on every page where annotation data already appears.
- Video trimming happens client-side (ffmpeg.wasm Web Worker) before upload, reducing storage.
- Desktop app supports full upload and viewing for cloud-synced guides.

---

## Out of scope (Phase 1)

- Media for local-only (non-synced) desktop guides.
- Per-segment speed adjustment on videos (only a single playback rate multiplier is stored).
- Moderation / flagging of community-contributed media.

---

## Data Model

### New model: `AnnotationMedia`

```prisma
model AnnotationMedia {
  id         String   @id @default(cuid())
  guideId    String
  nodeId     String           // AnnotationNode.Id (UUID from KV3)
  uploadedBy String           // User.id — NOT a FK relation, plain string
  slot       String           // 'standing' | 'aim' | 'landing'
  mediaType  String           // 'video' | 'image'
  source     String           // 'upload' | 'youtube'
  url        String           // Vercel Blob URL or full YouTube URL
  blobKey    String?          // only for source='upload'; used for blob deletion
  caption    String?
  notes      String?          // freeform text, multiline
  trimStart  Float?           // seconds; uploaded videos only (metadata, file is pre-trimmed)
  trimEnd    Float?           // seconds; uploaded videos only
  speedRate  Float?           // playback multiplier: 1.0 | 1.5 | 2.0
  cropBox    Json?            // { x, y, w, h } as 0-1 fractions; images only
  position   Int   @default(0)
  createdAt  DateTime @default(now())

  guide Guide @relation(fields: [guideId], references: [id], onDelete: Cascade)

  @@index([guideId, nodeId])
  @@index([guideId])
}
```

**Key design notes:**

- `uploadedBy` is a plain `String` (not a Prisma relation) to avoid cascade complexity. Checked in auth logic.
- `trimStart`/`trimEnd` are stored as metadata — the actual file uploaded is already trimmed by ffmpeg.wasm, so these reflect the original clip timestamps for display purposes.
- `cropBox` is stored as JSON fractions (`{ x: 0.1, y: 0.05, w: 0.8, h: 0.9 }`) and applied at display time via CSS transform — the original image file is not modified.

### `GrenadeEntry` additions

Two nullable columns added to enable library thumbnails without re-fetching blobs per card:

```prisma
model GrenadeEntry {
  // ...existing fields...
  hasMedia     Boolean @default(false)
  landingThumb String?   // URL: blob image URL or YouTube poster (img.youtube.com/vi/{id}/mqdefault.jpg)
}
```

Updated by the existing `/api/cron/index-grenades` cron job. Both columns require a Prisma migration alongside the `AnnotationMedia` migration.

---

## Auth Rules

| Action | Who can perform it |
| --- | --- |
| Read media | Any user (on public guides) |
| Create media | Guide owner (any slot); any authenticated user (only if the target slot currently has zero items) |
| Update / Delete | Guide owner **or** the `uploadedBy` user of that specific record |

The "empty slot" check on community POST is a single `count` query before insert.

---

## API Routes

All routes are under `apps/web/src/app/api/guides/[id]/media/`.

```text
POST   /api/guides/[id]/media/upload-url        Get presigned Vercel Blob upload URL
POST   /api/guides/[id]/media                   Create AnnotationMedia record (after upload or YouTube)
GET    /api/guides/[id]/media                   List all media for a guide, grouped by nodeId
GET    /api/guides/[id]/media/[nodeId]          List media for one specific annotation node
PUT    /api/guides/[id]/media/[mediaId]         Update caption / notes / trim / crop / speed
DELETE /api/guides/[id]/media/[mediaId]         Delete record + blob file (if source='upload')
```

### Upload flow — direct file

1. Client calls `POST .../upload-url` with `{ slot, mediaType, filename, contentType }`.
2. Server validates ownership / slot-empty rule, calls Vercel Blob `put()` with `allowedContentTypes`, returns `{ uploadUrl, blobKey }`.
3. Client uploads the **already-trimmed** file directly to Vercel Blob using the upload URL.
4. Client calls `POST .../media` with `{ nodeId, slot, source: 'upload', blobKey, url, caption, notes, trimStart, trimEnd, speedRate, cropBox }`.

### Upload flow — YouTube link

1. Client extracts video ID from the pasted URL and validates format client-side.
2. Client calls `POST .../media` directly with `{ nodeId, slot, source: 'youtube', url }`.
3. Embed uses `youtube-nocookie.com` for GDPR compliance.

### Desktop upload path

Desktop `LocalAdapter.media.*` methods call `https://cs2annotations.com/api/guides/[id]/media/*` with `Authorization: Bearer <token>`. Identical pattern to existing cloud sync calls. No direct DB access from desktop.

---

## Multi-step Upload Modal

Lives in `packages/ui/src/MediaUploadModal.tsx` so it is shared by web and desktop.

### Steps

```text
① Select annotation  →  ② Standing position  →  ③ Aim position  →  ④ Landing position  →  ⑤ Notes & submit
```

- Modal does **not** close on backdrop click. Escape key closes with a confirmation prompt if any slot has unsaved content.
- Steps 2–4 (the three slots) are individually skippable.
- Back navigation is always available.

### Per-slot step

Each slot step offers two source modes:

**Upload mode:**

- Drag-and-drop or click-to-browse file input (accepts `video/*` and `image/*`).
- For video: `VideoTrimmer` sub-component renders after file is selected.
- For image: `ImageZoomEditor` sub-component renders after file is selected.
- Optional caption field.

**YouTube mode:**

- URL paste input with client-side video ID extraction and validation.
- Live embed preview using `youtube-nocookie.com`.
- Optional caption field.

### Video trimming (`VideoTrimmer.tsx`)

- HTML5 `<video>` element with two range handles overlaid as a dual-handle timeline.
- Scrubbing a handle seeks the video to that position in real time.
- Speed selector: `1x` / `1.5x` / `2x` radio buttons (stored as `speedRate`, applied via `video.playbackRate` at view time).
- On "Next": ffmpeg.wasm runs in a Web Worker (`videoTrimWorker.ts`). Uses `-c copy` (stream copy, no re-encode) — fast, snaps to nearest keyframe.
- A progress bar replaces the trim UI during processing.
- The trimmed file blob is held in memory until Step 5 submit — not uploaded per-step, so the user can go back and redo.

### Image zoom/crop (`ImageZoomEditor.tsx`)

- CSS `transform: scale()` on a preview image with a range slider for zoom level and pointer-drag to reposition.
- Produces a `cropBox` `{ x, y, w, h }` stored in the DB.
- Original file uploaded untouched; zoom applied at display time.

### Step 5 — Notes & submit

- Single textarea for notes (applies to the annotation as a whole, not per-slot).
- Summary row shows filled-slot thumbnails/icons.
- "Upload & save" triggers all pending Vercel Blob uploads in parallel, then sequential `POST .../media` DB writes, then closes the modal.

### Editing existing media

Opening the modal for an annotation that already has media pre-populates each slot with the existing record. Per-slot: "Replace" clears and re-uploads; "Remove" calls the DELETE route. Auth is enforced server-side (guide owner or uploader).

---

## Component Architecture

### New files

```text
packages/ui/src/
  MediaUploadModal.tsx        Multi-step modal (shared web + desktop)
  MediaViewer.tsx             Read-only tab viewer (slot tabs, video/image/notes)
  VideoTrimmer.tsx            Dual-handle timeline + speed selector
  ImageZoomEditor.tsx         Zoom slider + drag-to-reposition
  videoTrimWorker.ts          Web Worker — ffmpeg.wasm trim logic

apps/web/src/components/
  GuideMapWithMedia.tsx       Wraps InteractiveMapView, fetches + passes mediaMap
  MediaDetailModal.tsx        Fullscreen media modal for library card clicks
  MediaCoverageBar.tsx        "3 / 12 lineups have media" stat for my-guides page
```

### `GuideAdapter` additions

```ts
interface GuideAdapter {
  // ...existing methods...
  media?: {
    list(guideId: string, nodeId?: string): Promise<AnnotationMedia[]>
    getUploadUrl(guideId: string, payload: UploadUrlPayload): Promise<{ uploadUrl: string; blobKey: string }>
    create(guideId: string, payload: CreateMediaPayload): Promise<AnnotationMedia>
    update(mediaId: string, payload: UpdateMediaPayload): Promise<AnnotationMedia>
    remove(mediaId: string): Promise<void>
  }
}
```

Both `CloudAdapter` and `LocalAdapter` implement `media`. Desktop `LocalAdapter` proxies calls to the web API via IPC (`window.ipc.invoke('media:*')`).

### `InteractiveMapView` changes

Two new optional props:

- `mediaMap?: Record<string, AnnotationMedia[]>` — keyed by `nodeId`
- `pinMode?: 'throw' | 'landing'` — controls whether pins render at the main node position or destination node position

No other changes to `InteractiveMapView`; `GuideMapWithMedia` owns fetching and passes these down.

---

## Media Display Surfaces

### Web

| Surface | What shows |
| --- | --- |
| Guide detail — map | Hover: landing thumbnail in tooltip. Click: detail panel with slot tabs + media + notes. Toggle: throw vs landing pin placement |
| Guide detail — annotation list | Camera icon if any slot filled. Row expands inline: slot tabs, `MediaViewer`, "Edit media" button for owner/uploader |
| Guide edit page | Same annotation list as detail, "Add/Edit media" always visible (user is always owner) |
| Library cards | `landingThumb` as card header image + "has media" badge. Click: `MediaDetailModal` with full slot view + notes + link to guide. No media: existing link-to-guide behaviour |
| Guide cards (`GuideCard`) | Small video-camera badge if guide has any `AnnotationMedia` (via `_count` in listing query) |
| My-guides page | `MediaCoverageBar`: "X / Y lineups have media" per guide |

### Desktop

| Surface | What shows |
| --- | --- |
| GuideEditor — annotation list | Camera icon per node. Expands to `MediaViewer`. "Add media" button (disabled + tooltip for local-only guides) |
| GuideEditor — map (NodeMapView) | Hover thumbnail from landing slot. Click detail panel with media. Throw vs landing toggle |
| Guide list panel | Camera icon badge on guides that have any media |

---

## ffmpeg.wasm Web Worker Architecture

ffmpeg.wasm (~30 MB WASM binary) runs in a dedicated Web Worker:

- **Lazy load:** the worker module is only fetched when the user selects a file in `VideoTrimmer`. Vite's `new Worker(new URL('./videoTrimWorker.ts', import.meta.url))` syntax auto-splits this into a separate chunk.
- **Single instance per session:** the `FFmpeg` instance inside the worker is created once and reused. Subsequent trim operations skip the 30 MB load.
- **Communication:** main thread posts `{ inputBuffer: ArrayBuffer, startSec, endSec, filename }` — worker posts back `{ type: 'progress', value: 0-1 }` updates then `{ type: 'done', buffer: ArrayBuffer }`.
- **`-c copy` flag:** stream copy (no re-encode). Trim is nearly instant regardless of clip length; cut points snap to the nearest keyframe (imperceptible difference for lineup videos).
- **Electron:** works unchanged in the Electron renderer — Chromium runs WASM and Web Workers identically to a browser.

---

## Cron Job Updates (`/api/cron/index-grenades`)

The existing cron iterates every public guide's nodes. Two additions per `GrenadeEntry` upsert:

1. Query `AnnotationMedia` for `(guideId, nodeId)` where `slot = 'landing'`. If any exist, set `hasMedia = true` and `landingThumb` to:
   - For `source = 'upload'` image: the blob URL directly.
   - For `source = 'upload'` video: leave `landingThumb` null (video poster extraction is Phase 2).
   - For `source = 'youtube'`: `https://img.youtube.com/vi/{videoId}/mqdefault.jpg`.

2. Guide card `_count` on `AnnotationMedia` — added as an `include` to existing guide listing queries (`/guides`, `/for-you`, `/saved`, profile).

No new cron job needed.

---

## Open Questions / Phase 2 Notes

- **Local-only desktop guides:** a companion JSON file approach (stored next to the KV3 file) is a viable Phase 2 path. Requires tracking deletion when annotations or guide files are removed.
- **Video poster for direct uploads:** extract the first frame client-side via canvas and upload as a companion image, so `landingThumb` is populated for uploaded videos too. Deferred to Phase 2.
- **Community media moderation:** no flagging or moderation in Phase 1. The guide owner can always delete community-contributed media via the guide edit page.
