# Phase 1 — Electron Packaging & Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the flat repo to a Turborepo monorepo, move the Electron app to `apps/desktop/`, extract shared code to `packages/shared/`, and ship a self-signed Windows NSIS installer with auto-update via GitHub Releases.

**Architecture:** The current root becomes the Turborepo workspace root. `apps/desktop/` holds the Electron app with all its existing dependencies. `packages/shared/` holds annotation types, the KV3 parser, and all utilities currently in `src/annotation/` and `src/kv3/`. The `apps/desktop/` package imports from `@cs2ann/shared` via pnpm workspace linking. electron-builder wraps the electron-vite output into an NSIS installer; electron-updater checks GitHub Releases for updates on startup.

**Tech Stack:** pnpm 9, Turborepo, electron-vite 2, electron-builder, electron-updater, GitHub Actions

---

## File Map

**Created:**
- `pnpm-workspace.yaml` — pnpm workspace config
- `turbo.json` — Turborepo pipeline
- `apps/desktop/` — entire current app moved here
- `apps/desktop/package.json` — desktop-specific deps (moved from root)
- `apps/desktop/electron-builder.yml` — packaging config
- `apps/web/package.json` — stub only (empty Next.js placeholder)
- `packages/shared/package.json` — shared package manifest
- `packages/shared/src/index.ts` — barrel export for all shared code
- `packages/ui/package.json` — stub only (filled in Phase 2)
- `.github/workflows/release.yml` — CI/CD for GitHub Releases

**Moved into `apps/desktop/`:**
- `electron/` → `apps/desktop/electron/`
- `src/` → `apps/desktop/src/`
- `index.html` → `apps/desktop/index.html`
- `electron.vite.config.ts` → `apps/desktop/electron.vite.config.ts`
- `tsconfig.json` → `apps/desktop/tsconfig.json`

**Moved into `packages/shared/src/`:**
- `src/annotation/types.ts` → `packages/shared/src/annotation/types.ts`
- `src/annotation/mapData.ts` → `packages/shared/src/annotation/mapData.ts`
- `src/annotation/kv3Mapping.ts` → `packages/shared/src/annotation/kv3Mapping.ts`
- `src/annotation/inferUtils.ts` → `packages/shared/src/annotation/inferUtils.ts`
- `src/annotation/groupUtils.ts` → `packages/shared/src/annotation/groupUtils.ts`
- `src/annotation/index.ts` → `packages/shared/src/annotation/index.ts`
- `src/annotation/groupUtils.test.ts` → `packages/shared/src/annotation/groupUtils.test.ts`
- `src/kv3/index.ts` → `packages/shared/src/kv3/index.ts`
- `src/kv3/parser.ts` → `packages/shared/src/kv3/parser.ts`
- `src/kv3/serializer.ts` → `packages/shared/src/kv3/serializer.ts`
- `src/kv3/types.ts` → `packages/shared/src/kv3/types.ts`

**Modified:**
- `apps/desktop/electron/main/index.ts` — update imports to `@cs2ann/shared`
- `apps/desktop/src/vite-env.d.ts` — update import to `@cs2ann/shared`
- `apps/desktop/src/components/*.tsx` — update annotation imports to `@cs2ann/shared`
- `apps/desktop/src/annotation/` — delete after move (contents now in packages/shared)
- `apps/desktop/src/kv3/` — delete after move

---

## Task 1: Set up pnpm and Turborepo workspace root

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Modify: `package.json` (root — strip to workspace root only)

- [ ] **Step 1: Install pnpm globally if not present**

```bash
npm install -g pnpm@9
pnpm --version
```

Expected output: `9.x.x`

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["out/**", "dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    }
  }
}
```

- [ ] **Step 4: Replace root `package.json` with workspace root manifest**

```json
{
  "name": "cs2-annotations",
  "private": true,
  "scripts": {
    "dev": "turbo dev --filter=@cs2ann/desktop",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 5: Install turbo at workspace root**

```bash
pnpm install
```

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml turbo.json package.json
git commit -m "chore: init turborepo workspace root"
```

---

## Task 2: Move the Electron app into `apps/desktop/`

**Files:**
- Create: `apps/desktop/` directory structure
- Create: `apps/desktop/package.json`
- Move: all current app files into `apps/desktop/`

- [ ] **Step 1: Create directory and write `apps/desktop/package.json`**

```json
{
  "name": "@cs2ann/desktop",
  "version": "1.0.0",
  "private": true,
  "description": "CS2 Annotations Manager desktop app",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "dependencies": {
    "@cs2ann/shared": "workspace:*",
    "@tailwindcss/vite": "^4.2.0",
    "electron-store": "^8.1.0",
    "electron-updater": "^6.1.0",
    "tailwindcss": "^4.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "electron-vite": "^2.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.3",
    "vite": "^5.0.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Move app files into `apps/desktop/`**

```bash
# Run from repo root
mkdir -p apps/desktop
mv electron apps/desktop/electron
mv src apps/desktop/src
mv index.html apps/desktop/index.html
mv electron.vite.config.ts apps/desktop/electron.vite.config.ts
mv tsconfig.json apps/desktop/tsconfig.json
mv tsconfig.node.json apps/desktop/tsconfig.node.json 2>/dev/null || true
mv resources apps/desktop/resources 2>/dev/null || true
```

- [ ] **Step 3: Fix the `electron.vite.config.ts` — paths are now relative to `apps/desktop/`**

Open `apps/desktop/electron.vite.config.ts`. The `resolve(__dirname, ...)` calls already use `__dirname` so paths remain correct after the move. Verify the file still references `electron/main/index.ts` and `electron/preload/index.ts` (not `../../electron/...`). No changes needed if they already use relative paths from `__dirname`.

- [ ] **Step 4: Create stub placeholder packages**

```bash
mkdir -p apps/web packages/shared/src packages/ui/src
```

Write `apps/web/package.json`:

```json
{
  "name": "@cs2ann/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  }
}
```

Write `packages/ui/package.json`:

```json
{
  "name": "@cs2ann/ui",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

Write `packages/ui/src/index.ts`:

```ts
// Components moved here in Phase 2
export {}
```

- [ ] **Step 5: Install workspace deps from root**

```bash
pnpm install
```

- [ ] **Step 6: Verify dev still starts**

```bash
pnpm dev
```

Expected: Electron app opens normally (same as before the move).

- [ ] **Step 7: Commit**

```bash
git add apps/ packages/ .gitignore
git commit -m "chore: move electron app to apps/desktop, add package stubs"
```

---

## Task 3: Create `packages/shared/` and move shared code

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/index.ts`
- Move: all annotation + kv3 source files into `packages/shared/src/`

- [ ] **Step 1: Write `packages/shared/package.json`**

```json
{
  "name": "@cs2ann/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Move annotation and kv3 files**

```bash
mkdir -p packages/shared/src/annotation packages/shared/src/kv3

# Move annotation files
mv apps/desktop/src/annotation/types.ts packages/shared/src/annotation/
mv apps/desktop/src/annotation/mapData.ts packages/shared/src/annotation/
mv apps/desktop/src/annotation/kv3Mapping.ts packages/shared/src/annotation/
mv apps/desktop/src/annotation/inferUtils.ts packages/shared/src/annotation/
mv apps/desktop/src/annotation/groupUtils.ts packages/shared/src/annotation/
mv apps/desktop/src/annotation/groupUtils.test.ts packages/shared/src/annotation/
mv apps/desktop/src/annotation/index.ts packages/shared/src/annotation/

# Move kv3 files
mv apps/desktop/src/kv3/types.ts packages/shared/src/kv3/
mv apps/desktop/src/kv3/parser.ts packages/shared/src/kv3/
mv apps/desktop/src/kv3/serializer.ts packages/shared/src/kv3/
mv apps/desktop/src/kv3/index.ts packages/shared/src/kv3/

# Remove now-empty dirs
rmdir apps/desktop/src/annotation
rmdir apps/desktop/src/kv3
```

- [ ] **Step 3: Create `packages/shared/src/index.ts` barrel export**

```ts
export * from './annotation/index'
export * from './annotation/types'
export * from './annotation/mapData'
export * from './annotation/kv3Mapping'
export * from './annotation/inferUtils'
export * from './annotation/groupUtils'
export * from './kv3/index'
export * from './kv3/types'
```

- [ ] **Step 4: Add `@cs2ann/shared` to the desktop tsconfig paths**

Open `apps/desktop/tsconfig.json`. Add or merge:

```json
{
  "compilerOptions": {
    "paths": {
      "@cs2ann/shared": ["../../packages/shared/src/index.ts"]
    }
  }
}
```

- [ ] **Step 5: Re-install to link workspace packages**

```bash
pnpm install
```

- [ ] **Step 6: Run tests from packages/shared to verify moved files compile**

```bash
pnpm --filter @cs2ann/shared test
```

Expected: groupUtils tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/ apps/desktop/src/ apps/desktop/tsconfig.json
git commit -m "chore: extract shared annotation types and KV3 parser to packages/shared"
```

---

## Task 4: Update all imports in `apps/desktop/` to use `@cs2ann/shared`

**Files:**
- Modify: `apps/desktop/electron/main/index.ts`
- Modify: `apps/desktop/src/vite-env.d.ts`
- Modify: `apps/desktop/src/components/GuideEditor.tsx`
- Modify: `apps/desktop/src/components/MapOverlay.tsx`
- Modify: any other `apps/desktop/src/components/*.tsx` files with annotation imports

- [ ] **Step 1: Update `apps/desktop/electron/main/index.ts` imports**

Find the lines:
```ts
import { parseKv3Text, serializeKv3Text } from '../../src/kv3'
import { kv3ToNodes, extractNodesKey, setNodesInRoot } from '../../src/annotation/kv3Mapping'
import type { Kv3Object } from '../../src/kv3/types'
import type { AnnotationNode } from '../../src/annotation/types'
```

Replace with:
```ts
import { parseKv3Text, serializeKv3Text, kv3ToNodes, extractNodesKey, setNodesInRoot } from '@cs2ann/shared'
import type { Kv3Object, AnnotationNode } from '@cs2ann/shared'
```

- [ ] **Step 2: Update `apps/desktop/src/vite-env.d.ts`**

Find:
```ts
import type { AnnotationNode } from './annotation/types'
```

Replace with:
```ts
import type { AnnotationNode } from '@cs2ann/shared'
```

- [ ] **Step 3: Update annotation imports in all component files**

Run this to find all remaining local annotation/kv3 imports:
```bash
grep -rn "from '.*annotation\|from '.*kv3" apps/desktop/src/components/
```

For each match, change the import path from the relative `'../annotation/...'` or `'../../annotation/...'` form to `'@cs2ann/shared'`. For example:

```ts
// Before
import type { AnnotationNode, GrenadeNode } from '../annotation/types'
import { inferGrenadeCategory } from '../annotation/inferUtils'
import { MAP_DATA } from '../annotation/mapData'

// After
import type { AnnotationNode, GrenadeNode } from '@cs2ann/shared'
import { inferGrenadeCategory, MAP_DATA } from '@cs2ann/shared'
```

- [ ] **Step 4: Build the desktop app to catch any remaining import errors**

```bash
pnpm --filter @cs2ann/desktop build
```

Expected: build succeeds with no TypeScript errors. Fix any remaining import paths that the build flags.

- [ ] **Step 5: Run dev and verify the app works**

```bash
pnpm dev
```

Expected: Electron app opens, guide list loads, editor works as before.

- [ ] **Step 6: Run all tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/
git commit -m "chore: update all desktop imports to @cs2ann/shared"
```

---

## Task 5: Configure electron-builder for Windows NSIS installer

**Files:**
- Create: `apps/desktop/electron-builder.yml`
- Create: `resources/icon.ico` (use existing icon or placeholder)

- [ ] **Step 1: Create `apps/desktop/electron-builder.yml`**

```yaml
appId: com.cs2ann.desktop
productName: CS2 Annotations Manager
copyright: Copyright © 2026

directories:
  output: dist
  buildResources: resources

files:
  - out/**/*
  - node_modules/**/*
  - package.json

win:
  icon: resources/icon.ico
  target:
    - target: nsis
      arch: x64

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: CS2 Annotations Manager

publish:
  provider: github
  owner: DaanMichielsen
  repo: CS2-annotations
```

- [ ] **Step 2: Ensure an icon exists at `apps/desktop/resources/icon.ico`**

If `resources/` was already moved to `apps/desktop/resources/`, check it contains an `icon.ico`. If not, place any 256×256 `.ico` file there. electron-builder will fail without it.

```bash
ls apps/desktop/resources/
```

- [ ] **Step 3: Add `build` script using electron-builder to `apps/desktop/package.json`**

The `dist` script is already added in Task 2. Verify it reads:
```json
"dist": "electron-vite build && electron-builder"
```

Update if needed.

- [ ] **Step 4: Run a local build to verify the installer is produced**

```bash
pnpm --filter @cs2ann/desktop dist
```

Expected: `apps/desktop/dist/CS2 Annotations Manager Setup 1.0.0.exe` is created (or similar). Build may take 1-3 minutes.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/electron-builder.yml
git commit -m "build: configure electron-builder NSIS installer"
```

---

## Task 6: Add electron-updater for auto-update

**Files:**
- Modify: `apps/desktop/electron/main/index.ts`

- [ ] **Step 1: Add auto-updater import and startup call in `apps/desktop/electron/main/index.ts`**

At the top of the file, add:
```ts
import { autoUpdater } from 'electron-updater'
```

Inside the `app.whenReady()` block (after the main window is created), add:
```ts
autoUpdater.checkForUpdatesAndNotify()
```

- [ ] **Step 2: Add update event handlers for user feedback**

Still in `apps/desktop/electron/main/index.ts`, after the `checkForUpdatesAndNotify()` call:

```ts
autoUpdater.on('update-available', () => {
  // Renderer will be notified via the default electron-updater notification
})

autoUpdater.on('update-downloaded', () => {
  const { dialog } = require('electron')
  dialog.showMessageBox({
    type: 'info',
    title: 'Update ready',
    message: 'A new version has been downloaded. Restart the app to apply the update.',
    buttons: ['Restart now', 'Later']
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall()
  })
})
```

- [ ] **Step 3: Verify the build still succeeds**

```bash
pnpm --filter @cs2ann/desktop build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/electron/main/index.ts
git commit -m "feat: add electron-updater auto-update on startup"
```

---

## Task 7: Add GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create `.github/workflows/release.yml`**

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build shared package
        run: pnpm --filter @cs2ann/shared build --if-present

      - name: Build and package desktop app
        run: pnpm --filter @cs2ann/desktop dist
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Add `GITHUB_TOKEN` permissions to the workflow (needed to publish releases)**

Add at the top level of the workflow file, after `on:`:

```yaml
permissions:
  contents: write
```

- [ ] **Step 3: Commit and push the workflow**

```bash
git add .github/
git commit -m "ci: add GitHub Actions release workflow on v* tags"
git push origin master
```

- [ ] **Step 4: Test the workflow by pushing a test tag**

```bash
git tag v1.0.0-test
git push origin v1.0.0-test
```

Then check the Actions tab on GitHub. The workflow should trigger, build, and publish a draft release with the `.exe` installer attached. Delete the test tag afterward:

```bash
git push --delete origin v1.0.0-test
git tag -d v1.0.0-test
```

---

## Task 8: Add "Reload map in CS2" button

**Files:**
- Modify: `apps/desktop/src/components/Guides.tsx` (or whichever component renders the guide list header)
- Modify: `apps/desktop/electron/preload/index.ts` — no changes needed (`writeCS2Cfg` already exposed)

- [ ] **Step 1: Locate where the guide list header is rendered**

The guide selector/list lives in `apps/desktop/src/components/Guides.tsx`. Open it and find the section that renders the currently selected guide name and the action buttons near the top.

- [ ] **Step 2: Add a "Reload map" button next to the existing load/save controls**

Find the JSX block that renders the action bar (near `annotation_load` button calls). Add:

```tsx
{selectedGuide?.mapName && (
  <button
    onClick={async () => {
      const confirmed = window.confirm(
        `This will run "map ${selectedGuide.mapName}" in CS2, restarting the current round. Continue?`
      )
      if (!confirmed) return
      await window.electronAPI.writeCS2Cfg(`map ${selectedGuide.mapName}`)
    }}
    className="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 text-white rounded"
    title="Forces CS2 to reload the map, making newly created guide files visible in the dropdown"
  >
    Reload map in CS2
  </button>
)}
```

`selectedGuide.mapName` comes from the `listGuides` IPC result which already includes a `mapName` field.

- [ ] **Step 3: Run dev and verify the button appears and works**

```bash
pnpm dev
```

1. Open a guide that has a known map (e.g. Mirage)
2. The "Reload map in CS2" button should appear in the header
3. Clicking it shows a confirm dialog
4. Confirming writes `map de_mirage` to the `annotation_manager.cfg` file

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/Guides.tsx
git commit -m "feat: add reload map in CS2 button for new guide detection"
```

---

## Task 9: Test cold install on Windows

- [ ] **Step 1: Build the final installer**

```bash
pnpm --filter @cs2ann/desktop dist
```

- [ ] **Step 2: Copy the `.exe` from `apps/desktop/dist/` to a clean Windows machine or VM with no Node.js installed**

- [ ] **Step 3: Run the installer**

Expected: NSIS installer runs, installs to `C:\Program Files\CS2 Annotations Manager\`, creates desktop shortcut.

- [ ] **Step 4: Launch the app from the desktop shortcut**

Expected: App opens. Windows SmartScreen may show "Unknown publisher" — click "More info → Run anyway". This is expected for self-signed builds.

- [ ] **Step 5: Verify core functionality**

- Settings → detect Steam path works
- Guide list loads
- Opening a guide loads nodes
- Saving a guide writes back to disk

- [ ] **Step 6: Tag and publish the first real release**

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions builds and publishes the installer to the v1.0.0 release automatically.
