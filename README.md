# CS2 Annotations Manager

A Windows desktop app (Electron + TypeScript + React) to manage Counter-Strike 2 nade guide annotation files locally. Edit annotations in a UI instead of editing KV3 text files by hand.

## Features

- **Settings**: Set the annotations folder (local guides) and/or the Workshop content folder (CS2 map guides under `workshop/content/730`). Auto-detect from Steam or choose manually.
- **Guides**: List local guides (`annotations/local/<name>/`) and workshop guides (folders under 730 that contain only `.txt` files). Create new local guides; open any guide to edit.
- **Editor**: View nodes, add (grenade, position, text, line, spot), edit (position, angles, title/desc, grenade type, etc.), delete (single node or entire grenade set). **Toggle visibility (Enabled)** per node from the list or the edit form to hide lineups you don’t want in game. Save with optional backup; copy reload command for CS2 console.

## Requirements

- Node.js 18+
- Windows (Steam path detection is Windows-only; you can still set the folder manually on other platforms)

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The main process output is in `out/main/`, preload in `out/preload/`, renderer in `out/renderer/`. Run Electron with `out/main/index.js` as main and load `out/renderer/index.html` (or use `electron-vite preview` if configured).

## Where annotation files live

- **Local guides**:  
  `<Steam>\steamapps\common\Counter-Strike Global Offensive\game\csgo\annotations\local\<guide_name>\<guide_name>.txt`  
  Create in CS2 with `annotation_save <name>`, then edit here.

- **Workshop map guides**:  
  `<Steam>\steamapps\workshop\content\730\<workshop_id>\<filename>.txt`  
  Subscribed map guides appear in these folders. The app only lists folders that contain **only** `.txt` files (so map/skin assets are ignored). You can open and edit those `.txt` files to toggle visibility (Enabled) or change labels.

After saving, run `annotation_reload` (or `annotation_load <name>` for local) in the CS2 console to see changes.

## File format

Annotation files are KV3 text (key = value, blocks, arrays). The app parses and serializes this format and maps the `Nodes` array to/from in-memory node objects (grenade, position, text, line, spot) with the fields documented in Valve’s annotation API.
