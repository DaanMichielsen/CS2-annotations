# Desktop Visual Refresh & Cloud Status Overview

**Date:** 2026-05-10  
**Status:** Approved

## Overview

Redesign the Electron desktop application's visual layer to align with the web app's design language (violet brand, Rajdhani/IBM Plex fonts, map color system), add per-guide cloud sync status indicators in the guide list, and overhaul the Cloud Panel into a grouped, actionable sync management view.

No backend API changes are required beyond reading cloud guide metadata that already exists. The featured guides section is styled for the future vision (own-cloud hosted essentials) but continues to source from the Steam Workshop for now.

---

## 1. Fonts & Brand Tokens

### Fonts
Bundle two Google Fonts directly into the Electron app (in `apps/desktop/resources/fonts/` or similar):

- **Rajdhani** — weights 400, 600, 700 (display/headings)
- **IBM Plex Sans** — weights 400, 500 (body text)

Define the same CSS variables as the web app in `apps/desktop/src/index.css`:

```css
--font-display: 'Rajdhani', system-ui, sans-serif;
--font-body: 'IBM Plex Sans', system-ui, sans-serif;
```

Apply `font-family: var(--font-body)` to the root. Apply `var(--font-display)` to headings, section labels, the TopNav brand, and the guide name in list rows.

### Brand Color
Introduce violet as the primary action color, matching the web:

```css
--brand: #8b5cf6;
--brand-hover: #7c3aed;
--brand-dim: rgba(139, 92, 246, 0.12);
```

Replace all uses of `bg-indigo-700` and generic zinc primary buttons (Save, Create annotation, Push, Pull, New guide) with violet. Danger actions (Delete) remain red. Secondary/neutral actions remain zinc.

### Background
Align the root background with the web: `#09090f` (currently `#18181b`).

---

## 2. TopNav

Current: plain "CS2 Annotations" text + gear icon.

Updated:
- Brand text uses `var(--font-display)`, Rajdhani 700, with "CS2" in white and "Annotations" in violet (`#8b5cf6`) — matching the web logo pattern
- Sync status dot and sidebar toggle remain as-is (already functional)
- Gear icon button stays, no structural change

The TopNav lives in `packages/ui/src/TopNav.tsx` (shared). Changes apply to both desktop and any future web embedding.

---

## 3. Guide List — Visual Row Design

### Component location
`packages/ui/src/Guides.tsx` — the guide list rendered in desktop's left panel.

### Row layout (left → right)

```
[3px left border] [status dot] [guide name]   [map chip] [load button]
```

**Left border (3px):** Map accent color from `mapColors.ts` keyed on the guide's `mapName` field (e.g. `de_inferno` → `#ea580c`). Falls back to zinc (`#52525b`) when `mapName` is absent or unrecognized.

**Status dot:** 8px filled circle, positioned left of the guide name.

| State | Color | Tailwind |
|---|---|---|
| Synced | Emerald | `bg-emerald-500` |
| Cloud ahead (needs pull) | Yellow | `bg-yellow-500` |
| Local ahead / not pushed | Orange | `bg-orange-500` |
| Not in cloud | Zinc | `bg-zinc-500` |
| Loading / unknown | Zinc dim | `bg-zinc-700` |

Only shown for "Your Guides" rows. Featured guides have no status dot.

**Guide name:** `var(--font-display)`, Rajdhani 600, white.

**Map chip (right side):** Small map icon (16×16 from `/map-icons/<mapname>.png`) + map label text (e.g. "INFERNO"), styled with the map's `accent` color as text and `dim` color as background — same pattern as the web's GuideCard chip. Hidden when `mapName` is unrecognized.

**Row background tint:** Map `dim` color (e.g. `rgba(234,88,12,0.08)`) as a subtle background. Falls back to transparent.

**Load button:** Icon-only button on the far right. Uses the Lucide `FolderDown` icon. No visible label. Native `title="Load guide"` attribute provides tooltip on hover. Triggers the existing copy-load / file-load logic.

### Featured Guides section

Same map-colored left border and map chip as "Your Guides". No status dot. Section header label "FEATURED MAP GUIDES" styled in Rajdhani, zinc-400. The Workshop badge remains.

---

## 4. Cloud Panel — Grouped Sync Management

### Component location
`apps/desktop/src/components/CloudPanel.tsx`

### Layout

The panel is restructured into four collapsible sections, rendered in priority order:

1. **BEHIND** — cloud has a newer version than local (needs pull)
2. **NOT PUSHED** — local has changes not yet in cloud, or guide is not in cloud at all
3. **SYNCED** — local matches cloud
4. *(NOT IN CLOUD is merged into NOT PUSHED since the action is the same: push. Within the NOT PUSHED section, `not_in_cloud` guides show a small "NEW" badge next to their name to distinguish them from `local_ahead` guides that were previously synced.)*

Each section header:
- Label in Rajdhani 600, colored by status (yellow / orange / emerald)
- Guide count badge (e.g. "3")
- Group action button: "Pull all" (BEHIND) or "Push all" (NOT PUSHED)
- Collapsed by default for SYNCED; expanded by default for BEHIND and NOT PUSHED

Each guide row inside a section:
- Guide name (IBM Plex Sans, white)
- Action button: "Pull" (BEHIND) or "Push" (NOT PUSHED), violet button, compact
- SYNCED rows have no action button

Auth section remains at the top of the panel (user avatar, name, sign out).

### Refresh behavior
Cloud status is fetched once on app open and cached. A manual "Refresh" button at the top of the cloud panel re-fetches. The list in the main guide panel reflects the same cached status data (the status dots update after refresh).

---

## 5. Cloud Status Logic

### Data model
Each guide needs a resolved `CloudSyncStatus`:

```typescript
type CloudSyncStatus =
  | 'synced'        // local matches cloud (same version/timestamp)
  | 'local_ahead'   // local is newer than cloud
  | 'cloud_ahead'   // cloud is newer than local
  | 'not_in_cloud'  // no matching guide in cloud
  | 'loading'       // fetch in progress
```

### Resolution
On app open (and on manual refresh):

1. Call the cloud API to list all cloud guides with their last-modified timestamps / version identifiers
2. Call `listGuides()` to get local guides with their last-modified metadata
3. For each local guide, match by guide ID:
   - No match in cloud → `not_in_cloud`
   - Cloud timestamp > local timestamp → `cloud_ahead`
   - Local timestamp > cloud timestamp → `local_ahead`
   - Equal timestamps → `synced`
4. Store resolved statuses in a `Map<guideId, CloudSyncStatus>` in component state (or a shared context if needed)

### Where to implement
- A new hook `useCloudStatus()` in `apps/desktop/src/` (not in `packages/ui` — cloud logic is desktop-specific)
- The hook exposes: `statuses: Map<string, CloudSyncStatus>`, `refresh()`, `isLoading: boolean`
- `Guides.tsx` consumes the hook to render status dots
- `CloudPanel.tsx` consumes the hook to render grouped sections and trigger push/pull actions

### Prerequisite check
Before implementing, verify that:
- The cloud API returns per-guide timestamps or version numbers
- Local `GuideSummary` includes a last-modified timestamp
- If either is missing, the implementation adds it (cloud API response type + local file stat)

---

## 6. Scope & Constraints

- **No changes to annotation editing logic** — GuideEditor internals are out of scope
- **No backend API changes for featured guides** — Workshop source stays; visual styling only
- **Font files** must be self-hosted (bundled in the app), not loaded from Google CDN, since the app runs offline
- **Map icons** — the `/map-icons/` folder exists in the web app's `public/`. The same PNGs need to be copied into `apps/desktop/resources/map-icons/` (or `public/`) and served via Vite's static asset handling
- **`mapColors.ts`** lives in `apps/web/src/lib/`. It should be moved to `packages/shared/src/` so both desktop and web can import it without duplication
- **Tailwind** — desktop uses Tailwind v4 via `@tailwindcss/vite`; violet brand values should be added as CSS custom properties in `index.css`, not via Tailwind config, to keep parity with the web approach

---

## 7. Out of Scope

- Serving featured/essential guides from the app's own cloud (future task)
- Curation workflow for map essentials
- Any changes to GuideEditor internals
- Push/pull conflict resolution UI (existing behavior is retained)
