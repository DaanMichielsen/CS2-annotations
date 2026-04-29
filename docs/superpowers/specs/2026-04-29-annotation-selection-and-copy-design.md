# Annotation Selection & Cross-File Copy Design

**Date**: 2026-04-29
**Status**: Approved

## Overview

Two related changes to the GuideEditor:

1. **Node list row redesign** — repurpose the visibility checkbox into a selection checkbox, replace the visibility toggle with an eye icon.
2. **Bulk actions** — when annotations are selected, expose "Copy to file" and "Delete selected" operations with a safe, atomic copy pipeline and pre-flight duplicate detection.

---

## Section 1 — Node list row redesign

### Current state

Each annotation row has a checkbox on the left that toggles `Enabled` + `VisiblePfx` (visibility in CS2), and a main button that opens the node in the edit panel.

### New layout

```text
[☐ select]  [main button → opens node editor]  [👁 eye icon]
```

Three distinct interactive zones per row:

| Zone | Element | Behaviour |
| --- | --- | --- |
| Left | Checkbox | Selects/deselects the annotation for bulk actions |
| Centre | Button | Opens node in edit panel (unchanged) |
| Right | Eye icon button | Toggles `Enabled` + `VisiblePfx` on all nodes in group |

**Grenade groups and line groups** are treated as units — checking the group row selects all underlying nodes together. Individual position/text/spot rows select one node each.

**Eye icon states**:

- Filled eye — annotation visible in CS2
- Dimmed / struck-through eye — annotation hidden in CS2
- Implemented as small inline SVG (~14×14px); no icon library needed.

Both the checkbox and the eye button call `stopPropagation` so they don't accidentally activate the main row button.

---

## Section 2 — Bulk action bar

Appears between the filter controls and the scrollable node list whenever at least one annotation is selected. Uses a fixed-height reserved slot (always occupies the same vertical space, hidden when empty) so the node list does not jump when selection changes.

### Layout

```text
[N selected]  [Select all]  [Deselect all]  ──  [Copy to file…]  [Delete selected]
```

**Select all / Deselect all** — operates on currently visible items (respects active filters).

**Copy to file…** — opens the Copy to File modal (Section 3).

**Delete selected** — shows an inline confirmation inside the action bar:

```text
Delete N annotations? [Confirm]  [Cancel]
```

On confirm: removes all nodes belonging to selected groups from in-memory state. Does **not** auto-save — the user must click **Save** in the top bar, consistent with single-node delete behaviour.

The bar disappears automatically when selection count reaches zero. The currently open node in the edit panel is unaffected by selection state.

---

## Section 3 — Copy to file modal

### Trigger

"Copy to file…" button in the bulk action bar.

### Modal layout

```text
┌─ Copy N annotations to… ──────────────────────────┐
│                                                     │
│  Existing files for {MapName}                       │
│  ○ mirage_smokes          47 nodes                  │
│  ○ mirage_flashes         ⚠ 268 nodes               │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  + Create new file for this map                     │
│    Name: [________________]  Map: {MapName} (fixed) │
│                                                     │
│  Pre-flight summary (shown after target selected):  │
│  3 annotations will be copied                       │
│  2 already exist and will be skipped                │
│                                                     │
│              [Cancel]  [Copy to selected file]      │
└─────────────────────────────────────────────────────┘
```

### Existing files list

- Populated by calling `loadGuide` for each local guide that shares the same `MapName` as the current guide when the modal opens (infrequent operation, acceptable cost).
- The current guide itself is excluded.
- Node count shown next to each entry.
- Files with >250 nodes show an amber `⚠ N nodes` warning — approaching the 300-node CS2 limit.
- If no other files share the same map name, the section reads "No other files for this map yet" and the create option is pre-expanded.

### Create new file option

- Name field: pre-filled with `{currentGuideName}_2` (or next available suffix).
- Map name: locked to the current `MapName` — creating a guide for a different map is done from the Guides screen, not here.
- On success: the action bar shows a success message "Copied to {name}" with an **Open** button the user can click to navigate to the new guide. No automatic navigation — the user may have unsaved edits in the current guide.

### Selecting vs creating

Selecting an existing file and filling in the create-new form are mutually exclusive. Selecting a file radio clears the create form; typing in the create field deselects any chosen file.

### Pre-flight duplicate check

Computed as soon as a target is selected. Displayed before confirm. Rules per annotation type:

| Type             | Fields compared                                                                       |
| ---------------- | ------------------------------------------------------------------------------------- |
| Grenade group    | Main `Position` + `Angles`, aim_target `Position` + `Angles`, destination `Position` |
| Line group       | All waypoint `Position` values in order                                               |
| Position / text / spot | `Position` + `Angles`                                                           |

Comparison is **exact float equality** — engine-produced coordinates are bitwise identical for the same lineup.

If all selected annotations are duplicates: confirm button is replaced with "All selected annotations already exist in this file."

---

## Section 4 — Copy safety: file integrity & duplicate detection

### Write pipeline

The copy operation always follows the same pipeline used for normal saves — never raw string manipulation:

```text
loadGuide(targetFilePath)
  → append incoming nodes to nodes array
  → setNodesInRoot(root, nodes, nodesKey)
  → serializeKv3Text(root)
  → writeAnnotationFile(targetFilePath)
  → parseKv3Text(written content)   ← post-write validation
```

### Backup & rollback

1. Before writing, copy target file to `{targetFilePath}.bak`.
2. After writing, re-parse the written file with `parseKv3Text`.
3. If re-parse throws: restore from `.bak` automatically and return an error to the renderer.
4. User sees: "Copy failed: file could not be validated after write. The original file has been restored."
5. If re-parse succeeds: keep the `.bak` — consistent with existing backup behaviour in `saveGuide`.

### New IPC handler: `appendNodesToGuide`

```ts
ipcMain.handle('appendNodesToGuide', async (_event, payload: {
  targetFilePath: string
  nodes: AnnotationNode[]  // already de-duplicated by renderer
}): Promise<{ error?: string; finalNodeCount?: number }>
```

Renderer is responsible for duplicate filtering before calling this handler. The handler is responsible for backup, write, and post-write validation.

### New IPC handler: `createGuideWithNodes`

Combines existing `createGuide` + `appendNodesToGuide` into a single atomic operation. Returns `{ loadName, filePath }` on success.

---

## Out of scope

- Moving annotations (remove from source file) — copy only for now.
- Copying across different maps (different `MapName`) — must use Guides screen to create a target file manually.
- Context-menu / right-click selection — may be added in a future iteration.
- Bulk enable/disable via selection — the eye icon on each row handles per-annotation visibility; no bulk visibility toggle is added here.

---

## Files affected

| File                                  | Change                                                              |
| ------------------------------------- | ------------------------------------------------------------------- |
| `src/components/GuideEditor.tsx`      | Row layout, eye icon, selection state, action bar, delete-selected  |
| `src/components/CopyToFileModal.tsx`  | New component                                                       |
| `electron/main/index.ts`              | `appendNodesToGuide` and `createGuideWithNodes` IPC handlers        |
| `electron/preload/index.ts`           | Expose new IPC calls                                                |
