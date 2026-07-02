# Tauri Desktop Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/desktop-tauri`, a Tauri 2.x rewrite of the Electron desktop app (`apps/desktop`), reaching feature parity (minus native keystroke injection) while `apps/desktop` and `master` stay untouched and shippable.

**Architecture:** Rust (`src-tauri`) is a thin OS/filesystem layer — raw file I/O, file watching, Windows registry reads, CS2 cfg writes, and plugin registration (store, shell, clipboard, deep-link, single-instance). All KV3 domain parsing, guide CRUD orchestration, and cloud API calls stay in TypeScript in the webview, reusing `@cs2ann/shared` exactly as the web app does. A new `TauriAdapter` implements the existing `GuideAdapter` interface from `packages/shared`, so `packages/ui` (`Guides`, `Settings`, `TopNav`, `GuideEditor`) is reused unmodified.

**Tech Stack:** Tauri 2.x, Rust (`tauri-plugin-store`, `tauri-plugin-shell`, `tauri-plugin-clipboard-manager`, `tauri-plugin-deep-link`, `tauri-plugin-single-instance`, `notify`, `winreg`), React 18 + Vite (matching `apps/desktop`'s existing renderer setup), Vitest, `@tauri-apps/api/mocks`, `tauri-driver` + WebdriverIO for E2E.

## Global Constraints

- Every task in this plan must leave `apps/desktop` (Electron) and its tests passing unchanged — never edit `apps/desktop/electron/**` or `apps/desktop/src/**` except where a task explicitly says so (only Task 3 touches Electron files, and only to route through the fixed `GuideAdapter` interface, not to change behavior).
- KV3 parsing/serialization/merge logic (`parseKv3Text`, `serializeKv3Text`, `kv3ToNodes`, `extractNodesKey`, `setNodesInRoot` from `@cs2ann/shared`) must run in TypeScript in the webview — never ported to Rust.
- No native keystroke injection ("Run in CS2" / `keysender` equivalent) — out of scope for this plan.
- No auto-updater / signing infra in this plan — deferred to a later cutover plan.
- Tauri app identity: productName `CS2 Annotations Manager (Tauri)`, identifier `com.cs2ann.desktop.tauri`, deep-link scheme `cs2ann-tauri://` — must never collide with the Electron app's `com.cs2ann.desktop` / `cs2ann://`.
- Package manager is `pnpm` (workspace-wide) — never `npm`/`yarn`.
- New workspace package lives at `apps/desktop-tauri/`, added to `pnpm-workspace.yaml`'s existing `apps/*` glob automatically (no change needed there).

---

## File Structure

```
apps/desktop-tauri/
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  vitest.config.ts
  index.html
  src/
    main.tsx
    App.tsx
    index.css
    vite-env.d.ts
    adapters/
      TauriAdapter.ts
      TauriAdapter.test.ts
    lib/
      guideScan.ts          # listGuides scanning logic (ported from Electron main)
      guideScan.test.ts
      guideNaming.ts         # toLocalGuideName equivalent
      guideNaming.test.ts
      settingsStore.ts       # tauri-plugin-store wrapper
      authBridge.ts          # auth state, deep-link handling
      cloudApi.ts            # cloud push/pull/sync-state/delete/featured/saved/media
    components/
      AuthButton.tsx
      CloudPanel.tsx
    hooks/
      useCloudStatus.ts
      useFeaturedGuides.ts
      useSavedGuides.ts
  e2e/
    wdio.conf.ts
    smoke.spec.ts
  src-tauri/
    Cargo.toml
    build.rs
    tauri.conf.json
    capabilities/
      default.json
    icons/                  # copied from apps/desktop/resources
    src/
      main.rs
      lib.rs
      commands/
        mod.rs
        fs_ops.rs            # read_text_file, write_text_file, copy_file, delete_file, list_dir, path_exists
        watcher.rs           # watch_file / unwatch_file
        steam.rs             # detect_steam_path + pure path-derivation functions (unit tested)
        cs2.rs                # write_cs2_cfg

.github/workflows/desktop-tauri.yml

packages/shared/src/kv3/parser.test.ts       # NEW — round-trip tests
packages/shared/src/adapter.ts                # MODIFIED — extended GuideAdapter (Task 3)
apps/desktop/src/adapters/LocalAdapter.ts     # MODIFIED — implements extended interface (Task 3)
packages/ui/src/Guides.tsx                    # MODIFIED — routes through adapter (Task 3)
packages/ui/src/GuideEditor.tsx               # MODIFIED — routes through adapter (Task 3)
apps/web/src/app/auth/desktop-callback/...    # MODIFIED — supports both deep-link schemes (Task 12)
```

---

### Task 1: Scaffold `apps/desktop-tauri`

**Files:**
- Create: `apps/desktop-tauri/package.json`
- Create: `apps/desktop-tauri/tsconfig.json`
- Create: `apps/desktop-tauri/tsconfig.node.json`
- Create: `apps/desktop-tauri/vite.config.ts`
- Create: `apps/desktop-tauri/index.html`
- Create: `apps/desktop-tauri/src/main.tsx`
- Create: `apps/desktop-tauri/src/App.tsx`
- Create: `apps/desktop-tauri/src/index.css`
- Create: `apps/desktop-tauri/src/vite-env.d.ts`
- Create: `apps/desktop-tauri/src-tauri/Cargo.toml`
- Create: `apps/desktop-tauri/src-tauri/build.rs`
- Create: `apps/desktop-tauri/src-tauri/tauri.conf.json`
- Create: `apps/desktop-tauri/src-tauri/capabilities/default.json`
- Create: `apps/desktop-tauri/src-tauri/src/main.rs`
- Create: `apps/desktop-tauri/src-tauri/src/lib.rs`
- Copy: `apps/desktop/resources/icon.png` → `apps/desktop-tauri/src-tauri/icons/icon.png`

**Interfaces:**
- Produces: a bootable Tauri app (`pnpm --filter @cs2ann/desktop-tauri tauri dev` opens a window) that later tasks add commands/adapters to. No `GuideAdapter` wiring yet — `App.tsx` renders a placeholder.

- [ ] **Step 1: Create the frontend package manifest**

`apps/desktop-tauri/package.json`:
```json
{
  "name": "@cs2ann/desktop-tauri",
  "version": "0.1.0",
  "private": true,
  "description": "CS2 Annotations Manager desktop app (Tauri)",
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tsc -b && vite build",
    "tauri": "tauri",
    "test": "vitest run"
  },
  "dependencies": {
    "@fontsource/ibm-plex-sans": "^5.2.8",
    "@fontsource/rajdhani": "^5.2.7",
    "@tailwindcss/vite": "^4.2.0",
    "@tauri-apps/api": "^2.1.1",
    "@tauri-apps/plugin-clipboard-manager": "^2.1.0",
    "@tauri-apps/plugin-deep-link": "^2.0.1",
    "@tauri-apps/plugin-opener": "^2.2.4",
    "@tauri-apps/plugin-shell": "^2.2.0",
    "@tauri-apps/plugin-store": "^2.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^4.2.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.1.0",
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create TypeScript configs (mirroring `apps/desktop`'s, minus the `electron` include)**

`apps/desktop-tauri/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@cs2ann/shared": ["../../packages/shared/src/index.ts"],
      "@cs2ann/ui": ["../../packages/ui/src/index.ts"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`apps/desktop-tauri/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3: Create the Vite config**

`apps/desktop-tauri/vite.config.ts`:
```ts
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const sharedEntry = resolve(__dirname, '../../packages/shared/src/index.ts')
const uiEntry = resolve(__dirname, '../../packages/ui/src/index.ts')

export default defineConfig(async () => ({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@cs2ann/shared': sharedEntry,
      '@cs2ann/ui': uiEntry,
    },
  },
  clearScreen: false,
  server: {
    port: 5183,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}))
```

- [ ] **Step 4: Create `index.html`, `main.tsx`, `index.css`, `vite-env.d.ts`, placeholder `App.tsx`**

`apps/desktop-tauri/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CS2 Annotations Manager (Tauri)</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/desktop-tauri/src/main.tsx`:
```tsx
import '@fontsource/rajdhani/400.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`apps/desktop-tauri/src/App.tsx` (placeholder — replaced in Task 14):
```tsx
export default function App() {
  return (
    <div className="h-full flex items-center justify-center text-zinc-200">
      <p>CS2 Annotations Manager (Tauri) — scaffold OK</p>
    </div>
  )
}
```

`apps/desktop-tauri/src/index.css`:
```css
@import "tailwindcss";

html, body, #root {
  height: 100%;
}
```

`apps/desktop-tauri/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 5: Create the Rust crate**

`apps/desktop-tauri/src-tauri/Cargo.toml`:
```toml
[package]
name = "cs2ann-desktop-tauri"
version = "0.1.0"
description = "CS2 Annotations Manager desktop app (Tauri)"
edition = "2021"

[lib]
name = "cs2ann_desktop_tauri_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-store = "2"
tauri-plugin-shell = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-deep-link = "2"
tauri-plugin-single-instance = "2"
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
notify = "6"

[target.'cfg(windows)'.dependencies]
winreg = "0.52"
```

`apps/desktop-tauri/src-tauri/build.rs`:
```rust
fn main() {
    tauri_build::build()
}
```

`apps/desktop-tauri/src-tauri/tauri.conf.json`:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "CS2 Annotations Manager (Tauri)",
  "version": "0.1.0",
  "identifier": "com.cs2ann.desktop.tauri",
  "build": {
    "beforeDevCommand": "pnpm vite dev",
    "beforeBuildCommand": "pnpm vite build",
    "devUrl": "http://localhost:5183",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "CS2 Annotations Manager (Tauri)",
        "width": 1000,
        "height": 700
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": ["icons/icon.png"],
    "windows": {
      "nsis": {
        "installMode": "currentUser"
      }
    }
  },
  "plugins": {
    "deep-link": {
      "desktop": {
        "schemes": ["cs2ann-tauri"]
      }
    }
  }
}
```

`apps/desktop-tauri/src-tauri/capabilities/default.json`:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capabilities for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "store:default",
    "shell:allow-open",
    "clipboard-manager:allow-write-text",
    "opener:allow-reveal-item-in-dir",
    "deep-link:default"
  ]
}
```

`apps/desktop-tauri/src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cs2ann_desktop_tauri_lib::run();
}
```

`apps/desktop-tauri/src-tauri/src/lib.rs`:
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 6: Install dependencies and verify the app boots**

Run:
```bash
pnpm install
pnpm --filter @cs2ann/desktop-tauri tauri dev
```
Expected: a window titled "CS2 Annotations Manager (Tauri)" opens showing "CS2 Annotations Manager (Tauri) — scaffold OK". Close the window (Ctrl+C in terminal) once confirmed.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop-tauri
git commit -m "feat(desktop-tauri): scaffold Tauri app skeleton"
```

---

### Task 2: KV3 round-trip tests in `packages/shared`

**Files:**
- Create: `packages/shared/src/kv3/parser.test.ts`

**Interfaces:**
- Consumes: `parseKv3Text(source: string): Kv3Value` from `packages/shared/src/kv3/parser.ts`; `serializeKv3Text(value: Kv3Value): string` from `packages/shared/src/kv3/serializer.ts`.
- Produces: regression coverage for the format both apps depend on. No behavior change.

- [ ] **Step 1: Write the failing round-trip test**

`packages/shared/src/kv3/parser.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseKv3Text } from './parser'
import { serializeKv3Text } from './serializer'
import type { Kv3Object } from './types'

const SAMPLE_KV3 = `<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->
{
  MapName = "de_dust2"
  ScreenText = {}
  Nodes = [
    {
      main = { pos = "100 200 300" }
    }
  ]
}
`

describe('parseKv3Text / serializeKv3Text round trip', () => {
  it('parses a KV3 document into a plain object tree', () => {
    const root = parseKv3Text(SAMPLE_KV3) as Kv3Object
    expect(root.MapName).toBe('de_dust2')
    expect(Array.isArray(root.Nodes)).toBe(true)
  })

  it('round-trips: parse -> serialize -> parse yields the same data', () => {
    const root = parseKv3Text(SAMPLE_KV3) as Kv3Object
    const serialized = serializeKv3Text(root)
    const reparsed = parseKv3Text(serialized) as Kv3Object
    expect(reparsed).toEqual(root)
  })

  it('strips a UTF-8 BOM before parsing', () => {
    const withBom = '﻿' + SAMPLE_KV3
    const stripped = withBom.charCodeAt(0) === 0xfeff ? withBom.slice(1) : withBom
    const root = parseKv3Text(stripped) as Kv3Object
    expect(root.MapName).toBe('de_dust2')
  })

  it('handles an empty Nodes array', () => {
    const empty = `<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->
{
  MapName = ""
  ScreenText = {}
  Nodes = []
}
`
    const root = parseKv3Text(empty) as Kv3Object
    expect(root.Nodes).toEqual([])
    const reparsed = parseKv3Text(serializeKv3Text(root)) as Kv3Object
    expect(reparsed.Nodes).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it passes (this exercises existing, already-correct code)**

Run: `cd packages/shared && pnpm test -- parser.test.ts`
Expected: PASS, 4 tests. If any assertion about the exact KV3 header/shape fails, adjust the sample fixture to match the real format used by `packages/shared/src/kv3/parser.ts` (do not weaken the assertions — fix the fixture).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/kv3/parser.test.ts
git commit -m "test(shared): add KV3 parse/serialize round-trip coverage"
```

---

### Task 3: Fix the `GuideAdapter` abstraction leak

**Files:**
- Modify: `packages/shared/src/adapter.ts`
- Modify: `apps/desktop/src/adapters/LocalAdapter.ts`
- Modify: `packages/ui/src/Guides.tsx:206,221`
- Modify: `packages/ui/src/GuideEditor.tsx:575-588`

**Interfaces:**
- Produces: `GuideAdapter` gains `cloudPushGuide`, `cloudPullGuide`, `cloudGetSyncState`, `getAuthState`, `cloudDeleteGuide` as optional methods — the exact shape the new `TauriAdapter` (Task 13) must implement.

- [ ] **Step 1: Extend the `GuideAdapter` interface**

In `packages/shared/src/adapter.ts`, add these types and extend the interface (insert after the existing `media?` block, before the closing `}`):
```ts
export interface CloudPushPayload {
  filePath: string
  title: string
  map: string
  nodeCount?: number
  cloudId?: string
  cloudVersion?: number
}

export interface CloudPushResult {
  error?: string
  conflict?: boolean
  cloudVersion?: number
  guide?: { id: string; version: number }
}

export interface CloudSyncStateResult {
  synced: boolean
  cloudId?: string
  localVersion?: number
  cloudVersion?: number
  behind?: boolean
  cloudAuthorId?: string | null
}

export interface AuthState {
  token: string | null
  name: string
  avatar: string
}
```

Then extend `GuideAdapter` (add alongside the existing `media?` block):
```ts
  cloudPushGuide?(payload: CloudPushPayload): Promise<CloudPushResult>
  cloudPullGuide?(payload: { cloudId: string; filePath: string }): Promise<{ ok?: boolean; error?: string }>
  cloudGetSyncState?(filePath: string): Promise<CloudSyncStateResult>
  cloudDeleteGuide?(cloudId: string): Promise<{ error?: string }>
  getAuthState?(): Promise<AuthState>
```

- [ ] **Step 2: Export the new types**

In `packages/shared/src/index.ts`, extend the existing adapter re-export:
```ts
export type {
  GuideAdapter,
  GuideSummary,
  LoadedGuide,
  SaveGuidePayload,
  AppendNodesPayload,
  CreateGuidePayload,
  CloudPushPayload,
  CloudPushResult,
  CloudSyncStateResult,
  AuthState,
} from './adapter'
```

- [ ] **Step 3: Implement the new methods in `LocalAdapter`**

In `apps/desktop/src/adapters/LocalAdapter.ts`, add before the closing `}` of the returned object (after the `media` block):
```ts
    async cloudPushGuide(payload) {
      return window.electronAPI.cloudPushGuide(payload)
    },
    async cloudPullGuide(payload) {
      return window.electronAPI.cloudPullGuide(payload)
    },
    async cloudGetSyncState(filePath: string) {
      return window.electronAPI.cloudGetSyncState(filePath)
    },
    async cloudDeleteGuide(cloudId: string) {
      return window.electronAPI.cloudDeleteGuide(cloudId)
    },
    async getAuthState() {
      return window.electronAPI.getAuthState()
    },
```
This is a pure passthrough — behavior is unchanged, it now just satisfies the interface instead of being invisible to it.

- [ ] **Step 4: Route `packages/ui/src/Guides.tsx` through the adapter**

Read `packages/ui/src/Guides.tsx` around line 206 and 221 first to confirm the surrounding function signatures (they call `useGuideAdapter()` elsewhere in the same file — reuse that same hook result, do not create a new import). Replace:
```ts
await (window as any).electronAPI.cloudPushGuide({ ... })
```
with:
```ts
await adapter.cloudPushGuide?.({ ... })
```
and:
```ts
await (window as any).electronAPI.cloudPullGuide({ cloudId: state.cloudId, filePath: openGuide.filePath })
```
with:
```ts
await adapter.cloudPullGuide?.({ cloudId: state.cloudId, filePath: openGuide.filePath })
```
(`adapter` here is whatever local variable name the file already uses for the result of `useGuideAdapter()` — match the existing convention in that file rather than introducing a new name.)

- [ ] **Step 5: Route `packages/ui/src/GuideEditor.tsx` through the adapter**

Read `packages/ui/src/GuideEditor.tsx` around lines 575-588 first. Replace:
```ts
const electronAPI = (window as any).electronAPI
if (electronAPI && cloudStatus?.cloudId) {
  ...
    electronAPI.cloudGetSyncState(filePath),
    electronAPI.getAuthState(),
  ...
      const cloudResult = await electronAPI.cloudDeleteGuide(cloudStatus.cloudId)
```
with the adapter-based equivalent, guarding on the adapter methods being present instead of `window.electronAPI`:
```ts
if (adapter.cloudGetSyncState && cloudStatus?.cloudId) {
  ...
    adapter.cloudGetSyncState(filePath),
    adapter.getAuthState?.(),
  ...
      const cloudResult = await adapter.cloudDeleteGuide?.(cloudStatus.cloudId)
```
(Again, use whatever the file's existing `useGuideAdapter()` result variable is named — do not introduce `electronAPI` as a name anywhere in this file.)

- [ ] **Step 6: Verify the Electron app still builds and behaves identically**

Run:
```bash
cd apps/desktop
pnpm build
pnpm test
```
Expected: build succeeds, existing tests pass (there are none yet beyond `passWithNoTests`, so this just confirms no compile errors). Then manually smoke-test: `pnpm dev`, open a guide with cloud sync state, confirm push/pull/delete-from-cloud still work exactly as before (no behavior change expected — this step routes the same calls through one more layer of indirection).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/adapter.ts packages/shared/src/index.ts apps/desktop/src/adapters/LocalAdapter.ts packages/ui/src/Guides.tsx packages/ui/src/GuideEditor.tsx
git commit -m "fix(ui): route cloud-sync calls through GuideAdapter instead of window.electronAPI"
```

---

### Task 4: Test infrastructure for `apps/desktop-tauri`

**Files:**
- Create: `apps/desktop-tauri/vitest.config.ts`
- Create: `apps/desktop-tauri/e2e/wdio.conf.ts`
- Create: `apps/desktop-tauri/e2e/smoke.spec.ts`
- Modify: `apps/desktop-tauri/package.json` (add E2E deps/scripts)
- Modify: `apps/desktop-tauri/src-tauri/Cargo.toml` (nothing new needed — `cargo test` works out of the box on the crate from Task 1)

**Interfaces:**
- Produces: `pnpm --filter @cs2ann/desktop-tauri test` (vitest), `cargo test` (from `src-tauri/`), and `pnpm --filter @cs2ann/desktop-tauri e2e` (WebDriver smoke suite) all runnable locally — wired into CI in Task 5.

- [ ] **Step 1: Add vitest config**

`apps/desktop-tauri/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
  },
})
```

- [ ] **Step 2: Add `jsdom` and E2E dependencies to `package.json`**

Add to `devDependencies` in `apps/desktop-tauri/package.json`:
```json
    "jsdom": "^24.0.0",
    "@wdio/cli": "^8.39.0",
    "@wdio/local-runner": "^8.39.0",
    "@wdio/mocha-framework": "^8.39.0",
    "@wdio/spec-reporter": "^8.39.0"
```
Add scripts:
```json
    "e2e": "wdio run ./e2e/wdio.conf.ts"
```

- [ ] **Step 3: Add `tauri-driver` as a Rust dev tool (documented, not a package.json dep)**

`tauri-driver` is installed via `cargo install tauri-driver` (it's a Rust binary, not an npm package). Add a note by creating `apps/desktop-tauri/e2e/README.md`:
```markdown
# E2E smoke suite

Requires `tauri-driver` on PATH: `cargo install tauri-driver --locked`.
On Windows this also requires Microsoft Edge WebDriver matching the
installed WebView2 runtime version (download from
https://developer.microsoft.com/microsoft-edge/tools/webdriver/ and
ensure it's on PATH before running `pnpm e2e`).

Run: `pnpm build` (produces the release binary tauri-driver launches),
then `pnpm e2e`.
```

- [ ] **Step 4: Write the WebDriver config**

`apps/desktop-tauri/e2e/wdio.conf.ts`:
```ts
import path from 'node:path'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'

let tauriDriver: ChildProcess | undefined

const APP_BINARY = path.resolve(
  __dirname,
  '../src-tauri/target/release/cs2ann-desktop-tauri.exe'
)

export const config: WebdriverIO.Config = {
  specs: ['./e2e/*.spec.ts'],
  maxInstances: 1,
  capabilities: [
    {
      // @ts-expect-error tauri:options is a custom WebDriver capability
      'tauri:options': { application: APP_BINARY },
      browserName: 'wry',
    },
  ],
  reporters: ['spec'],
  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 60000 },

  beforeSession: () => {
    spawnSync('cargo', ['build', '--release'], {
      cwd: path.resolve(__dirname, '../src-tauri'),
      stdio: 'inherit',
    })
    tauriDriver = spawn('tauri-driver', [], { stdio: [null, process.stdout, process.stderr] })
  },

  afterSession: () => {
    tauriDriver?.kill()
  },
}
```

- [ ] **Step 5: Write the first real smoke test**

`apps/desktop-tauri/e2e/smoke.spec.ts`:
```ts
describe('CS2 Annotations Manager (Tauri) — smoke', () => {
  it('launches and shows the scaffold placeholder', async () => {
    const text = await $('body').getText()
    expect(text).toContain('CS2 Annotations Manager')
  })
})
```
(This scenario is intentionally tied to the current `App.tsx` placeholder from Task 1. Task 9 replaces it with a real "create guide" scenario once `App.tsx` renders the actual UI.)

- [ ] **Step 6: Run everything locally to confirm the harness works**

Run:
```bash
pnpm install
cd apps/desktop-tauri && pnpm test
cd src-tauri && cargo test
cd .. && pnpm build && pnpm e2e
```
Expected: vitest reports "no tests found, passing" (Task 6+ adds real ones); `cargo test` reports 0 tests passing (Task 7 adds real ones); the E2E suite launches the built app and the smoke spec passes.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop-tauri/vitest.config.ts apps/desktop-tauri/e2e apps/desktop-tauri/package.json pnpm-lock.yaml
git commit -m "test(desktop-tauri): add vitest, cargo test, and WebDriver E2E harness"
```

---

### Task 5: CI workflow for `desktop-tauri`

**Files:**
- Create: `.github/workflows/desktop-tauri.yml`

**Interfaces:**
- Consumes: `pnpm test`, `cargo test`, `pnpm e2e`, `pnpm tauri build` from Tasks 1 and 4.
- Produces: a downloadable installer artifact on every push to the feature branch, gated on tests passing.

- [ ] **Step 1: Write the workflow**

`.github/workflows/desktop-tauri.yml`:
```yaml
name: Desktop (Tauri) — Build and Test

on:
  push:
    branches:
      - 'tauri-desktop-rewrite'
  workflow_dispatch: {}

jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: apps/desktop-tauri/src-tauri

      - name: Install dependencies
        run: pnpm install --no-frozen-lockfile

      - name: TypeScript unit tests
        run: pnpm --filter @cs2ann/shared test
      - run: pnpm --filter @cs2ann/desktop-tauri test

      - name: Rust unit tests
        working-directory: apps/desktop-tauri/src-tauri
        run: cargo test

      - name: Install tauri-driver
        run: cargo install tauri-driver --locked

      - name: Install Edge WebDriver
        run: |
          $edgeVersion = (Get-Item "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe").VersionInfo.FileVersion
          Invoke-WebRequest -Uri "https://msedgedriver.azureedge.net/$edgeVersion/edgedriver_win64.zip" -OutFile edgedriver.zip
          Expand-Archive edgedriver.zip -DestinationPath edgedriver
          echo "$PWD\edgedriver" | Out-File -FilePath $env:GITHUB_PATH -Encoding utf8 -Append
        shell: pwsh

      - name: E2E smoke suite
        working-directory: apps/desktop-tauri
        run: pnpm e2e

  build:
    needs: test
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: apps/desktop-tauri/src-tauri

      - name: Install dependencies
        run: pnpm install --no-frozen-lockfile

      - name: Build installer
        working-directory: apps/desktop-tauri
        run: pnpm tauri build

      - name: Upload installer artifact
        uses: actions/upload-artifact@v4
        with:
          name: cs2ann-desktop-tauri-installer
          path: apps/desktop-tauri/src-tauri/target/release/bundle/nsis/*.exe
          retention-days: 30
```

- [ ] **Step 2: Verify the branch name matches**

Confirm the actual feature branch name (`git branch --show-current`) matches the `branches:` filter above. If it differs, edit the `on.push.branches` value to match exactly before committing.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/desktop-tauri.yml
git commit -m "ci(desktop-tauri): add test + build workflow for the Tauri app"
```

- [ ] **Step 4: Push and confirm the workflow runs**

```bash
git push -u origin HEAD
gh run watch
```
Expected: the `test` job passes, then `build` runs and uploads `cs2ann-desktop-tauri-installer` as a downloadable artifact. If `test` fails on something environmental (e.g. Edge WebDriver version mismatch), fix the workflow step, not the app code, then push again.

---

### Task 6: Rust file I/O commands

**Files:**
- Create: `apps/desktop-tauri/src-tauri/src/commands/mod.rs`
- Create: `apps/desktop-tauri/src-tauri/src/commands/fs_ops.rs`
- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs`

**Interfaces:**
- Produces: Tauri commands `read_text_file(path: String) -> Result<String, String>`, `write_text_file(path: String, content: String) -> Result<(), String>`, `copy_file(from: String, to: String) -> Result<(), String>`, `delete_file(path: String) -> Result<(), String>`, `delete_dir_if_empty(path: String) -> Result<(), String>`, `list_dir(path: String) -> Result<Vec<DirEntryInfo>, String>`, `path_exists(path: String) -> bool` — the exact names Task 9's `TauriAdapter` invokes.

- [ ] **Step 1: Write the commands module**

`apps/desktop-tauri/src-tauri/src/commands/mod.rs`:
```rust
pub mod fs_ops;
pub mod steam;
pub mod watcher;
pub mod cs2;
```

`apps/desktop-tauri/src-tauri/src/commands/fs_ops.rs`:
```rust
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct DirEntryInfo {
    pub name: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_file(from: String, to: String) -> Result<(), String> {
    fs::copy(&from, &to).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_dir_if_empty(path: String) -> Result<(), String> {
    let dir = Path::new(&path);
    if dir.is_dir() && fs::read_dir(dir).map_err(|e| e.to_string())?.next().is_none() {
        fs::remove_dir(dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<DirEntryInfo>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        out.push(DirEntryInfo {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: file_type.is_dir(),
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}
```

- [ ] **Step 2: Register the commands in `lib.rs`**

Modify `apps/desktop-tauri/src-tauri/src/lib.rs` — add `mod commands;` at the top and an `invoke_handler`:
```rust
mod commands;

use commands::fs_ops::{copy_file, delete_dir_if_empty, delete_file, list_dir, path_exists, read_text_file, write_text_file};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            copy_file,
            delete_file,
            delete_dir_if_empty,
            list_dir,
            path_exists,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Add placeholder modules so the crate compiles before Tasks 7-8 fill them in — `apps/desktop-tauri/src-tauri/src/commands/steam.rs` and `.../watcher.rs` and `.../cs2.rs` each start as:
```rust
// filled in by a later task
```

- [ ] **Step 3: Grant filesystem-adjacent capability (none needed — commands are custom, not the fs plugin)**

No change to `capabilities/default.json` is required here: these are hand-written `#[tauri::command]`s, not the generic `tauri-plugin-fs` JS API, so they're covered by `core:default` already present from Task 1. Confirm by grepping the capabilities file — if `core:default` is missing, add it.

- [ ] **Step 4: Verify with a manual round-trip via the dev console**

Run: `pnpm --filter @cs2ann/desktop-tauri tauri dev`
In the app's DevTools console (right-click → Inspect), run:
```js
const { invoke } = window.__TAURI__.core
await invoke('write_text_file', { path: 'C:\\Temp\\cs2ann-test.txt', content: 'hello' })
await invoke('path_exists', { path: 'C:\\Temp\\cs2ann-test.txt' })   // true
await invoke('read_text_file', { path: 'C:\\Temp\\cs2ann-test.txt' }) // "hello"
await invoke('list_dir', { path: 'C:\\Temp' })
await invoke('delete_file', { path: 'C:\\Temp\\cs2ann-test.txt' })
```
Expected: each call resolves with the expected value/no error. This manual pass is intentional — these are thin `std::fs` wrappers with no branching logic worth a contrived unit test; real coverage comes from the E2E suite once Task 9 exercises them through `TauriAdapter`.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-tauri/src-tauri/src/commands apps/desktop-tauri/src-tauri/src/lib.rs
git commit -m "feat(desktop-tauri): add Rust file I/O commands"
```

---

### Task 7: Steam path detection (Rust, with unit-tested pure logic)

**Files:**
- Modify: `apps/desktop-tauri/src-tauri/src/commands/steam.rs`
- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs`

**Interfaces:**
- Produces: Tauri command `detect_steam_path() -> DetectSteamPathResult` where
  ```rust
  #[derive(serde::Serialize)]
  #[serde(untagged)]
  pub enum DetectSteamPathResult {
      Ok { path: String, annotations_root: String, workshop_content_path: String },
      Err { error: String },
  }
  ```
  serializing to the same JSON shape as the Electron IPC handler: `{ path, annotationsRoot, workshopContentPath }` or `{ error }`. Task 9's `TauriAdapter.detectSteamPath()` consumes this.

- [ ] **Step 1: Write the failing unit tests for the pure path-derivation functions**

`apps/desktop-tauri/src-tauri/src/commands/steam.rs` — start with just the test module (compiles but fails since the functions don't exist yet):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_annotations_root_from_steam_path() {
        let result = derive_annotations_root(r"C:\Program Files (x86)\Steam");
        assert_eq!(
            result,
            r"C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\annotations\local"
        );
    }

    #[test]
    fn derives_workshop_content_path_from_steam_path() {
        let result = derive_workshop_content_path(r"C:\Program Files (x86)\Steam");
        assert_eq!(
            result,
            r"C:\Program Files (x86)\Steam\steamapps\workshop\content\730"
        );
    }

    #[test]
    fn strips_trailing_backslash_before_joining() {
        let result = derive_annotations_root(r"C:\Steam\");
        assert!(!result.contains(r"Steam\\steamapps"));
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail to compile**

Run: `cd apps/desktop-tauri/src-tauri && cargo test steam::`
Expected: compile error — `derive_annotations_root`/`derive_workshop_content_path` not found.

- [ ] **Step 3: Implement the module**

Prepend to `apps/desktop-tauri/src-tauri/src/commands/steam.rs` (above the `#[cfg(test)]` block):
```rust
use serde::Serialize;

const CS2_ANNOTATIONS_RELATIVE: &str =
    r"steamapps\common\Counter-Strike Global Offensive\game\csgo\annotations\local";
const CS2_WORKSHOP_CONTENT_RELATIVE: &str = r"steamapps\workshop\content\730";

fn derive_annotations_root(steam_path: &str) -> String {
    format!("{}\\{}", steam_path.trim_end_matches('\\'), CS2_ANNOTATIONS_RELATIVE)
}

fn derive_workshop_content_path(steam_path: &str) -> String {
    format!("{}\\{}", steam_path.trim_end_matches('\\'), CS2_WORKSHOP_CONTENT_RELATIVE)
}

#[cfg(windows)]
fn read_steam_path_from_registry() -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey(r"Software\Valve\Steam") {
        if let Ok(path) = key.get_value::<String, _>("SteamPath") {
            return Some(path);
        }
    }

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(key) = hklm.open_subkey(r"SOFTWARE\WOW6432Node\Valve\Steam") {
        if let Ok(path) = key.get_value::<String, _>("InstallPath") {
            return Some(path);
        }
    }

    None
}

#[cfg(not(windows))]
fn read_steam_path_from_registry() -> Option<String> {
    None
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum DetectSteamPathResult {
    Ok {
        path: String,
        #[serde(rename = "annotationsRoot")]
        annotations_root: String,
        #[serde(rename = "workshopContentPath")]
        workshop_content_path: String,
    },
    Err {
        error: String,
    },
}

#[tauri::command]
pub fn detect_steam_path() -> DetectSteamPathResult {
    let steam_path = match read_steam_path_from_registry() {
        Some(p) => p,
        None => {
            let fallback = r"C:\Program Files (x86)\Steam";
            if std::path::Path::new(fallback).exists() {
                fallback.to_string()
            } else {
                return DetectSteamPathResult::Err {
                    error: "Steam path not found in registry. Set the folders manually.".into(),
                };
            }
        }
    };

    DetectSteamPathResult::Ok {
        annotations_root: derive_annotations_root(&steam_path),
        workshop_content_path: derive_workshop_content_path(&steam_path),
        path: steam_path,
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cargo test steam::`
Expected: PASS, 3 tests.

- [ ] **Step 5: Register the command in `lib.rs`**

In `apps/desktop-tauri/src-tauri/src/lib.rs`, add to the `use commands::...` imports and `invoke_handler![...]` list:
```rust
use commands::steam::detect_steam_path;
```
and add `detect_steam_path,` to the `tauri::generate_handler![...]` array.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-tauri/src-tauri/src/commands/steam.rs apps/desktop-tauri/src-tauri/src/lib.rs
git commit -m "feat(desktop-tauri): add Steam path detection command with tested path derivation"
```

---

### Task 8: File watcher command

**Files:**
- Modify: `apps/desktop-tauri/src-tauri/src/commands/watcher.rs`
- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs`

**Interfaces:**
- Produces: Tauri commands `watch_file(path: String) -> Result<(), String>`, `unwatch_file() -> Result<(), String>`, emitting a debounced `guide-file-changed` window event with the changed path as payload — matching Electron's `onGuideFileChanged` semantics. Task 9's `TauriAdapter.cs2.watchFile/unwatchFile/onFileChanged` consume this.

- [ ] **Step 1: Implement the watcher module**

`apps/desktop-tauri/src-tauri/src/commands/watcher.rs`:
```rust
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

pub struct WatcherState(pub Mutex<Option<RecommendedWatcher>>);

impl Default for WatcherState {
    fn default() -> Self {
        WatcherState(Mutex::new(None))
    }
}

const DEBOUNCE: Duration = Duration::from_millis(400);

#[tauri::command]
pub fn watch_file(
    path: String,
    app: AppHandle,
    state: State<WatcherState>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = None; // drop any existing watcher first, mirroring Electron's "one watcher at a time"

    let last_emit = Mutex::new(Instant::now() - DEBOUNCE);
    let emit_path = path.clone();
    let app_handle = app.clone();

    let mut watcher: RecommendedWatcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        if res.is_err() {
            return;
        }
        let mut last = last_emit.lock().unwrap();
        if last.elapsed() < DEBOUNCE {
            return;
        }
        *last = Instant::now();
        let _ = app_handle.emit("guide-file-changed", emit_path.clone());
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(std::path::Path::new(&path), RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    *guard = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn unwatch_file(state: State<WatcherState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}
```

- [ ] **Step 2: Register the watcher state and commands in `lib.rs`**

In `apps/desktop-tauri/src-tauri/src/lib.rs`:
```rust
use commands::watcher::{unwatch_file, watch_file, WatcherState};
```
Add `.manage(WatcherState::default())` to the builder chain (before `.invoke_handler`), and add `watch_file, unwatch_file,` to the `generate_handler!` list.

- [ ] **Step 3: Verify manually**

Run: `pnpm --filter @cs2ann/desktop-tauri tauri dev`. In DevTools console:
```js
const { invoke } = window.__TAURI__.core
const { listen } = window.__TAURI__.event
await listen('guide-file-changed', (e) => console.log('changed:', e.payload))
await invoke('write_text_file', { path: 'C:\\Temp\\watch-test.txt', content: 'a' })
await invoke('watch_file', { path: 'C:\\Temp\\watch-test.txt' })
await invoke('write_text_file', { path: 'C:\\Temp\\watch-test.txt', content: 'b' })
```
Expected: the console logs `changed: C:\Temp\watch-test.txt` within ~400ms of the second write. This is integration behavior (real OS file events) not worth a `cargo test` unit test — the debounce logic is exercised here and later by the E2E suite (Task 9).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop-tauri/src-tauri/src/commands/watcher.rs apps/desktop-tauri/src-tauri/src/lib.rs
git commit -m "feat(desktop-tauri): add debounced file watcher command"
```

---

### Task 9: `TauriAdapter` — guide CRUD

**Files:**
- Create: `apps/desktop-tauri/src/lib/guideNaming.ts`
- Create: `apps/desktop-tauri/src/lib/guideNaming.test.ts`
- Create: `apps/desktop-tauri/src/lib/guideScan.ts`
- Create: `apps/desktop-tauri/src/lib/guideScan.test.ts`
- Create: `apps/desktop-tauri/src/adapters/TauriAdapter.ts`
- Create: `apps/desktop-tauri/src/adapters/TauriAdapter.test.ts`
- Modify: `apps/desktop-tauri/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `read_text_file`, `write_text_file`, `copy_file`, `delete_file`, `delete_dir_if_empty`, `list_dir`, `path_exists`, `detect_steam_path`, `watch_file`, `unwatch_file` Rust commands (Tasks 6-8); `parseKv3Text`, `serializeKv3Text`, `kv3ToNodes`, `extractNodesKey`, `setNodesInRoot` from `@cs2ann/shared`; `@tauri-apps/plugin-store`'s `load()`.
- Produces: `createTauriAdapter(): GuideAdapter` — the full local-file half of the interface (cloud/media/CS2 methods land in Tasks 10-13).

- [ ] **Step 1: Write the failing test for guide-name sanitization**

`apps/desktop-tauri/src/lib/guideNaming.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { toLocalGuideName } from './guideNaming'

describe('toLocalGuideName', () => {
  it('replaces whitespace with underscores', () => {
    expect(toLocalGuideName('my cool guide')).toBe('my_cool_guide')
  })
  it('strips invalid characters', () => {
    expect(toLocalGuideName('a/b\\c:d')).toBe('a_b_c_d')
  })
  it('collapses repeated underscores', () => {
    expect(toLocalGuideName('a   b')).toBe('a_b')
  })
  it('trims leading/trailing underscores', () => {
    expect(toLocalGuideName('  _weird_  ')).toBe('weird')
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd apps/desktop-tauri && pnpm test -- guideNaming.test.ts`
Expected: FAIL — `./guideNaming` has no export `toLocalGuideName`.

- [ ] **Step 3: Implement `guideNaming.ts`**

`apps/desktop-tauri/src/lib/guideNaming.ts`:
```ts
export function toLocalGuideName(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm test -- guideNaming.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing test for guide scanning**

`apps/desktop-tauri/src/lib/guideScan.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fileIsAnnotation, readMapName } from './guideScan'

describe('fileIsAnnotation', () => {
  it('returns true when content starts with the KV3 header', () => {
    expect(fileIsAnnotation('<!-- kv3 encoding:text:version{abc} -->\n{}')).toBe(true)
  })
  it('returns false for unrelated text content', () => {
    expect(fileIsAnnotation('not a kv3 file')).toBe(false)
  })
  it('ignores a leading BOM', () => {
    expect(fileIsAnnotation('﻿<!-- kv3 encoding:text:version{abc} -->\n{}')).toBe(true)
  })
})

describe('readMapName', () => {
  it('extracts MapName from the first lines of the file', () => {
    const content = '<!-- kv3 -->\n{\n  MapName = "de_inferno"\n  Nodes = []\n}\n'
    expect(readMapName(content)).toBe('de_inferno')
  })
  it('returns undefined when MapName is absent', () => {
    expect(readMapName('<!-- kv3 -->\n{\n  Nodes = []\n}\n')).toBeUndefined()
  })
})
```

- [ ] **Step 6: Run it, confirm it fails**

Run: `pnpm test -- guideScan.test.ts`
Expected: FAIL — module has no such exports yet.

- [ ] **Step 7: Implement `guideScan.ts`**

`apps/desktop-tauri/src/lib/guideScan.ts`:
```ts
import { invoke } from '@tauri-apps/api/core'

const KV3_HEADER_PREFIX = '<!-- kv3 encoding:text:version{'

export function fileIsAnnotation(content: string): boolean {
  const stripped = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  const firstLine = stripped.split('\n')[0]
  return firstLine.trimEnd().startsWith(KV3_HEADER_PREFIX)
}

export function readMapName(content: string): string | undefined {
  const stripped = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  const lines = stripped.split('\n').slice(0, 10)
  for (const line of lines) {
    const m = line.match(/MapName\s*=\s*"([^"]*)"/)
    if (m) return m[1] || undefined
  }
  return undefined
}

export interface FeaturedGuideRef {
  id: string
  name: string
}

export const FEATURED_GUIDES: FeaturedGuideRef[] = [
  { id: '3387810001', name: 'inferno_essential' },
  { id: '3387870747', name: 'ancient_essential' },
  { id: '3388581972', name: 'anubis_essential' },
  { id: '3388611848', name: 'overpass_essential' },
  { id: '3388638091', name: 'nuke_essential' },
  { id: '3388681214', name: 'dust2_essential' },
  { id: '3388737112', name: 'mirage_essential' },
  { id: '3388761697', name: 'vertigo_essential' },
]

export type GuideSource = 'local' | 'workshop'

export interface GuideItem {
  name: string
  path: string
  source: GuideSource
  mapName?: string
  workshopId?: string
  installed: boolean
}

async function tryReadTextFile(path: string): Promise<string | null> {
  try {
    return await invoke<string>('read_text_file', { path })
  } catch {
    return null
  }
}

export async function scanLocalGuides(annotationsRoot: string): Promise<GuideItem[]> {
  const guides: GuideItem[] = []
  if (!annotationsRoot || !(await invoke<boolean>('path_exists', { path: annotationsRoot }))) {
    return guides
  }
  const entries = await invoke<{ name: string; is_dir: boolean }[]>('list_dir', { path: annotationsRoot })
  for (const e of entries) {
    if (!e.is_dir) continue
    const txtPath = `${annotationsRoot}\\${e.name}\\${e.name}.txt`
    const content = await tryReadTextFile(txtPath)
    if (content === null) continue
    guides.push({
      name: e.name,
      path: txtPath,
      source: 'local',
      mapName: readMapName(content),
      installed: true,
    })
  }
  return guides
}

export async function scanFeaturedWorkshopGuides(workshopPath: string): Promise<GuideItem[]> {
  const guides: GuideItem[] = []
  for (const fg of FEATURED_GUIDES) {
    const folderPath = workshopPath ? `${workshopPath}\\${fg.id}` : ''
    const exists = folderPath && (await invoke<boolean>('path_exists', { path: folderPath }))
    if (!exists) {
      guides.push({ name: fg.name, path: '', source: 'workshop', workshopId: fg.id, installed: false })
      continue
    }
    const files = await invoke<{ name: string; is_dir: boolean }[]>('list_dir', { path: folderPath })
    let found = false
    for (const f of files) {
      if (f.is_dir || !f.name.toLowerCase().endsWith('.txt')) continue
      const fullPath = `${folderPath}\\${f.name}`
      const content = await tryReadTextFile(fullPath)
      if (content === null || !fileIsAnnotation(content)) continue
      guides.push({
        name: fg.name,
        path: fullPath,
        source: 'workshop',
        mapName: readMapName(content),
        workshopId: fg.id,
        installed: true,
      })
      found = true
      break
    }
    if (!found) {
      guides.push({ name: fg.name, path: '', source: 'workshop', workshopId: fg.id, installed: false })
    }
  }
  return guides
}

export async function scanUserWorkshopGuides(workshopPath: string): Promise<GuideItem[]> {
  const guides: GuideItem[] = []
  if (!workshopPath || !(await invoke<boolean>('path_exists', { path: workshopPath }))) return guides
  const featuredIds = new Set(FEATURED_GUIDES.map((g) => g.id))
  const dirs = await invoke<{ name: string; is_dir: boolean }[]>('list_dir', { path: workshopPath })
  for (const d of dirs) {
    if (!d.is_dir || featuredIds.has(d.name)) continue
    const folderPath = `${workshopPath}\\${d.name}`
    const files = await invoke<{ name: string; is_dir: boolean }[]>('list_dir', { path: folderPath })
    for (const f of files) {
      if (f.is_dir || !f.name.toLowerCase().endsWith('.txt')) continue
      const fullPath = `${folderPath}\\${f.name}`
      const content = await tryReadTextFile(fullPath)
      if (content === null || !fileIsAnnotation(content)) continue
      const baseName = f.name.replace(/\.txt$/i, '')
      guides.push({
        name: `${d.name} - ${baseName}`,
        path: fullPath,
        source: 'workshop',
        mapName: readMapName(content),
        workshopId: d.name,
        installed: true,
      })
      break
    }
  }
  return guides
}
```

- [ ] **Step 8: Run the tests to confirm they pass**

Run: `pnpm test -- guideScan.test.ts`
Expected: PASS, 5 tests. (`scan*` functions are exercised by `TauriAdapter.test.ts` in Step 10 and the E2E suite, not unit-tested directly here since they're thin `invoke()` orchestration.)

- [ ] **Step 9: Write the failing `TauriAdapter` test for the core CRUD path**

`apps/desktop-tauri/src/adapters/TauriAdapter.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks'
import { createTauriAdapter } from './TauriAdapter'

const files = new Map<string, string>()
const settings = new Map<string, unknown>()

beforeEach(() => {
  files.clear()
  settings.clear()
  // createGuide/saveAsLocal/deleteGuide all read `annotationsRoot` from the
  // settings store before touching the filesystem — seed it so CRUD tests
  // don't need Task 10's setAnnotationsRoot() (not implemented yet at this
  // point in the plan).
  settings.set('annotationsRoot', 'C:\\annotations')

  mockIPC((cmd, args) => {
    const a = args as Record<string, unknown>
    switch (cmd) {
      case 'read_text_file':
        if (!files.has(a.path as string)) throw new Error('not found')
        return files.get(a.path as string)
      case 'write_text_file':
        files.set(a.path as string, a.content as string)
        return null
      case 'path_exists':
        return files.has(a.path as string)
      case 'copy_file':
        files.set(a.to as string, files.get(a.from as string) ?? '')
        return null
      case 'delete_file':
        files.delete(a.path as string)
        return null
      case 'delete_dir_if_empty':
        return null
      case 'list_dir':
        return []
      case 'plugin:store|get':
        return settings.get(a.key as string) ?? null
      case 'plugin:store|set':
        settings.set(a.key as string, a.value)
        return null
      case 'plugin:store|delete':
        return settings.delete(a.key as string)
      case 'plugin:store|save':
      case 'plugin:store|load':
        return null
      default:
        throw new Error(`unmocked command: ${cmd}`)
    }
  })
})

afterEach(() => {
  clearMocks()
})

describe('createTauriAdapter — guide CRUD', () => {
  it('creates a guide with the KV3 header and an empty node list', async () => {
    const adapter = createTauriAdapter()
    const result = await adapter.createGuide({ filename: 'My Guide', mapName: 'de_dust2' })
    expect(result.error).toBeUndefined()
    expect(result.loadName).toBe('My_Guide')

    const saved = [...files.values()][0]
    expect(saved).toContain('<!-- kv3 encoding:text:version{')
    expect(saved.charCodeAt(0)).toBe(0xfeff)
  })

  it('round-trips loadGuide -> saveGuide -> loadGuide with the same nodes', async () => {
    const adapter = createTauriAdapter()
    const created = await adapter.createGuide({ filename: 'RoundTrip', mapName: 'de_mirage' })
    const path = [...files.keys()][0]

    const loaded = await adapter.loadGuide(path)
    if ('error' in loaded) throw new Error(loaded.error)

    await adapter.saveGuide({
      id: path,
      root: loaded.root,
      nodes: loaded.nodes,
      nodesKey: loaded.nodesKey,
      createBackup: false,
    })

    const reloaded = await adapter.loadGuide(path)
    if ('error' in reloaded) throw new Error(reloaded.error)
    expect(reloaded.nodes).toEqual(loaded.nodes)
    expect(created.loadName).toBe('RoundTrip')
  })

  it('reports an error creating a guide with only invalid-character characters', async () => {
    const adapter = createTauriAdapter()
    const result = await adapter.createGuide({ filename: '///', mapName: '' })
    expect(result.error).toMatch(/invalid guide name/i)
  })
})
```

- [ ] **Step 10: Run it, confirm it fails**

Run: `pnpm test -- TauriAdapter.test.ts`
Expected: FAIL — `./TauriAdapter` doesn't exist yet.

- [ ] **Step 11: Implement `TauriAdapter.ts` (guide CRUD portion)**

`apps/desktop-tauri/src/adapters/TauriAdapter.ts`:
```ts
import { invoke } from '@tauri-apps/api/core'
import { load } from '@tauri-apps/plugin-store'
import {
  parseKv3Text,
  serializeKv3Text,
  kv3ToNodes,
  extractNodesKey,
  setNodesInRoot,
} from '@cs2ann/shared'
import type {
  AnnotationNode,
  AppendNodesPayload,
  CreateGuidePayload,
  GuideAdapter,
  GuideSummary,
  Kv3Object,
  LoadedGuide,
  SaveGuidePayload,
} from '@cs2ann/shared'
import { toLocalGuideName } from '../lib/guideNaming'
import { scanLocalGuides, scanFeaturedWorkshopGuides, scanUserWorkshopGuides } from '../lib/guideScan'

const UTF8_BOM = '﻿'

async function settingsStore() {
  return load('settings.json', { autoSave: true })
}

function stripBom(raw: string): string {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
}

async function writeAnnotationFile(filePath: string, content: string): Promise<void> {
  await invoke('write_text_file', { path: filePath, content: UTF8_BOM + content })
}

async function getAnnotationsRootOrThrow(): Promise<string> {
  const store = await settingsStore()
  const root = (await store.get<string>('annotationsRoot')) ?? ''
  if (!root) throw new Error('Annotations folder not set. Set it in Settings.')
  return root
}

export function createTauriAdapter(): GuideAdapter {
  return {
    async listGuides(): Promise<GuideSummary[]> {
      const store = await settingsStore()
      const annotationsRoot = (await store.get<string>('annotationsRoot')) ?? ''
      const workshopContentPath = (await store.get<string>('workshopContentPath')) ?? ''

      const [local, featured, userWorkshop] = await Promise.all([
        scanLocalGuides(annotationsRoot),
        scanFeaturedWorkshopGuides(workshopContentPath),
        scanUserWorkshopGuides(workshopContentPath),
      ])

      return [...local, ...featured, ...userWorkshop].map((g) => ({
        id: g.path,
        name: g.name,
        mapName: g.mapName,
        source: g.source,
        installed: g.installed,
        workshopId: g.workshopId,
      }))
    },

    async createGuide(payload: CreateGuidePayload) {
      const rootPath = await getAnnotationsRootOrThrow()
      const safeName = toLocalGuideName(payload.filename)
      if (!safeName) {
        return { error: 'Invalid guide name. Use letters, numbers, underscores or hyphens (no spaces).' }
      }
      const dirPath = `${rootPath}\\${safeName}`
      const filePath = `${dirPath}\\${safeName}.txt`
      if (await invoke<boolean>('path_exists', { path: filePath })) {
        return { error: `Guide "${safeName}" already exists.` }
      }

      const root: Kv3Object = { MapName: payload.mapName ?? '', ScreenText: {}, Nodes: [] }
      if (payload.nodes && payload.nodesKey) {
        setNodesInRoot(root, payload.nodes, payload.nodesKey)
      }
      await writeAnnotationFile(filePath, serializeKv3Text(root))
      return { loadName: safeName, id: filePath }
    },

    async loadGuide(id: string): Promise<LoadedGuide | { error: string }> {
      try {
        if (!(await invoke<boolean>('path_exists', { path: id }))) {
          return { error: `File not found: ${id}` }
        }
        const raw = await invoke<string>('read_text_file', { path: id })
        const hadBom = raw.charCodeAt(0) === 0xfeff
        const content = stripBom(raw)
        const hasKv3Header = content.trimStart().startsWith('<!--')
        const root = parseKv3Text(content) as Kv3Object
        const nodesKey = extractNodesKey(root)
        const nodes = kv3ToNodes(root, nodesKey)

        if (!hadBom || !hasKv3Header) {
          await writeAnnotationFile(id, serializeKv3Text(root))
        }
        return { nodes, nodesKey, root }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },

    async saveGuide(payload: SaveGuidePayload) {
      try {
        if (payload.createBackup !== false && (await invoke<boolean>('path_exists', { path: payload.id }))) {
          await invoke('copy_file', { from: payload.id, to: `${payload.id}.bak` })
        }
        const root = payload.root as Kv3Object
        setNodesInRoot(root, payload.nodes, payload.nodesKey)
        await writeAnnotationFile(payload.id, serializeKv3Text(root))
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },

    async saveAsLocal(payload) {
      try {
        const rootPath = await getAnnotationsRootOrThrow()
        const safeName = toLocalGuideName(payload.localName)
        if (!safeName) {
          return { error: 'Invalid guide name. Use letters, numbers, underscores or hyphens (no spaces).' }
        }
        const filePath = `${rootPath}\\${safeName}\\${safeName}.txt`
        if (await invoke<boolean>('path_exists', { path: filePath })) {
          return { error: `A local guide named "${safeName}" already exists.` }
        }
        const root = payload.root as Kv3Object
        setNodesInRoot(root, payload.nodes, payload.nodesKey)
        await writeAnnotationFile(filePath, serializeKv3Text(root))
        return { id: filePath, loadName: safeName }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },

    async deleteGuide(id: string) {
      try {
        const store = await settingsStore()
        const annotationsRoot = (await store.get<string>('annotationsRoot')) ?? ''
        if (!annotationsRoot) return { error: 'Annotations folder not set.' }
        if (!id.toLowerCase().startsWith(annotationsRoot.toLowerCase())) {
          return { error: 'Can only delete local annotation files from the configured annotations folder.' }
        }
        if (!(await invoke<boolean>('path_exists', { path: id }))) return { error: 'File not found.' }
        await invoke('unwatch_file')
        await invoke('delete_file', { path: id })
        const dirPath = id.slice(0, id.lastIndexOf('\\'))
        await invoke('delete_dir_if_empty', { path: dirPath })
        await store.delete(`cloudId:${id}`)
        await store.delete(`cloudVersion:${id}`)
        await store.delete(`lastPushed:${id}`)
        await store.delete(`cloudAuthorId:${id}`)
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },

    async appendNodes(payload: AppendNodesPayload) {
      try {
        const targetFilePath = payload.targetId
        if (!(await invoke<boolean>('path_exists', { path: targetFilePath }))) {
          return { error: `File not found: ${targetFilePath}` }
        }
        const bakPath = `${targetFilePath}.bak`
        await invoke('copy_file', { from: targetFilePath, to: bakPath })

        const raw = stripBom(await invoke<string>('read_text_file', { path: targetFilePath }))
        const root = parseKv3Text(raw) as Kv3Object
        const nodesKey = extractNodesKey(root)
        const existingNodes = kv3ToNodes(root, nodesKey)
        const merged: AnnotationNode[] = [...existingNodes, ...payload.nodes]
        setNodesInRoot(root, merged, nodesKey)
        await writeAnnotationFile(targetFilePath, serializeKv3Text(root))

        try {
          const written = stripBom(await invoke<string>('read_text_file', { path: targetFilePath }))
          parseKv3Text(written)
        } catch {
          await invoke('copy_file', { from: bakPath, to: targetFilePath })
          return { error: 'Copy failed: file could not be validated after write. The original file has been restored.' }
        }

        await invoke('delete_file', { path: bakPath })
        return { finalNodeCount: merged.length }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },
  }
}
```

Note: this step intentionally implements only the file-CRUD subset of `GuideAdapter` — `createGuideWithNodes`-equivalent behavior is covered by `createGuide` accepting `payload.nodes`/`payload.nodesKey` (matching `CreateGuidePayload`'s shape from `packages/shared/src/adapter.ts`); settings/detectSteamPath/cs2/clipboard/media/cloud methods are added in Tasks 10-13.

- [ ] **Step 12: Run the tests to confirm they pass**

Run: `pnpm test -- TauriAdapter.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 13: Add a real E2E scenario for the file loop, replacing the placeholder smoke test**

Replace the contents of `apps/desktop-tauri/e2e/smoke.spec.ts` (the placeholder text assertion from Task 4 no longer applies once `App.tsx` renders the real UI in Task 14 — for now, add a second `describe` block alongside the existing one, since `App.tsx` is still a placeholder until Task 14):
```ts
describe('CS2 Annotations Manager (Tauri) — smoke', () => {
  it('launches and shows the scaffold placeholder', async () => {
    const text = await $('body').getText()
    expect(text).toContain('CS2 Annotations Manager')
  })
})

// NOTE: a "create guide -> save -> reload from disk" scenario belongs here,
// but requires App.tsx to render the real Guides UI (Task 14) and a way to
// point the app at a scratch annotations folder (Task 10's Settings UI).
// Added in Task 14, Step "extend E2E coverage", not here — TauriAdapter's
// behavior is already covered by the vitest suite above.
```

- [ ] **Step 14: Commit**

```bash
git add apps/desktop-tauri/src/lib apps/desktop-tauri/src/adapters apps/desktop-tauri/e2e/smoke.spec.ts
git commit -m "feat(desktop-tauri): implement TauriAdapter guide CRUD with TDD coverage"
```

---

### Task 10: Settings + Steam detection in `TauriAdapter`

**Files:**
- Modify: `apps/desktop-tauri/src/adapters/TauriAdapter.ts`
- Modify: `apps/desktop-tauri/src/adapters/TauriAdapter.test.ts`

**Interfaces:**
- Produces: `getAnnotationsRoot`, `setAnnotationsRoot`, `getWorkshopContentPath`, `setWorkshopContentPath`, `getAutoCopyLoadCommandsOnOpen`, `setAutoCopyLoadCommandsOnOpen`, `getCfgKeybind`, `setCfgKeybind`, `detectSteamPath` on the object returned by `createTauriAdapter()`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/desktop-tauri/src/adapters/TauriAdapter.test.ts` — the `settings` map and `plugin:store|*` cases already exist in `beforeEach` (added in Task 9, Step 9, since `createGuide` already depended on the store). If the real `@tauri-apps/plugin-store` command names turn out to differ from `plugin:store|get`/`plugin:store|set`/`plugin:store|delete`/`plugin:store|save`/`plugin:store|load` once this runs against the actual package, adjust both this file's mock and `guideScan.ts`/`TauriAdapter.ts`'s usage together — they must agree, but the exact wire names are an implementation detail:
```ts
describe('createTauriAdapter — settings', () => {
  it('round-trips the annotations root setting', async () => {
    const adapter = createTauriAdapter()
    await adapter.setAnnotationsRoot?.('C:\\CS2\\annotations')
    expect(await adapter.getAnnotationsRoot?.()).toBe('C:\\CS2\\annotations')
  })

  it('defaults autoCopyLoadCommandsOnOpen to false', async () => {
    const adapter = createTauriAdapter()
    expect(await adapter.getAutoCopyLoadCommandsOnOpen?.()).toBe(false)
  })

  it('defaults cfgKeybind to f8', async () => {
    const adapter = createTauriAdapter()
    expect(await adapter.getCfgKeybind?.()).toBe('f8')
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm test -- TauriAdapter.test.ts`
Expected: FAIL — `setAnnotationsRoot`/`getAnnotationsRoot`/etc. are `undefined`.

- [ ] **Step 3: Implement the settings methods**

Add to the object returned by `createTauriAdapter()` in `apps/desktop-tauri/src/adapters/TauriAdapter.ts` (after `appendNodes`):
```ts
    async getAnnotationsRoot() {
      const store = await settingsStore()
      return (await store.get<string>('annotationsRoot')) ?? ''
    },
    async setAnnotationsRoot(root: string) {
      const store = await settingsStore()
      await store.set('annotationsRoot', root)
    },
    async getWorkshopContentPath() {
      const store = await settingsStore()
      return (await store.get<string>('workshopContentPath')) ?? ''
    },
    async setWorkshopContentPath(path: string) {
      const store = await settingsStore()
      await store.set('workshopContentPath', path)
    },
    async getAutoCopyLoadCommandsOnOpen() {
      const store = await settingsStore()
      return (await store.get<boolean>('autoCopyLoadCommandsOnOpen')) ?? false
    },
    async setAutoCopyLoadCommandsOnOpen(value: boolean) {
      const store = await settingsStore()
      await store.set('autoCopyLoadCommandsOnOpen', value)
    },
    async getCfgKeybind() {
      const store = await settingsStore()
      return (await store.get<string>('cfgKeybind')) ?? 'f8'
    },
    async setCfgKeybind(key: string) {
      const store = await settingsStore()
      await store.set('cfgKeybind', key)
    },
    async detectSteamPath() {
      return invoke<
        | { path: string; annotationsRoot: string; workshopContentPath: string }
        | { error: string }
      >('detect_steam_path')
    },
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `pnpm test -- TauriAdapter.test.ts`
Expected: PASS, all tests including the new 3.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-tauri/src/adapters/TauriAdapter.ts apps/desktop-tauri/src/adapters/TauriAdapter.test.ts
git commit -m "feat(desktop-tauri): add settings and Steam detection to TauriAdapter"
```

---

### Task 11: CS2 integration — cfg writing, launch, file watch wiring

**Files:**
- Create: `apps/desktop-tauri/src-tauri/src/commands/cs2.rs`
- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs`
- Modify: `apps/desktop-tauri/src/adapters/TauriAdapter.ts`
- Modify: `apps/desktop-tauri/src/adapters/TauriAdapter.test.ts`

**Interfaces:**
- Produces: Rust command `write_cs2_cfg(annotations_root: String, command: String) -> Result<CfgWriteResult, String>`; `GuideAdapter.launchCS2()` (via `@tauri-apps/plugin-shell`'s `open()`, no Rust command needed); `GuideAdapter.cs2.{writeCommand, watchFile, unwatchFile, onFileChanged}`; `GuideAdapter.clipboard.{write, showInFolder}` (via `@tauri-apps/plugin-clipboard-manager` and `@tauri-apps/plugin-opener`).

- [ ] **Step 1: Implement the Rust cfg-writing command**

`apps/desktop-tauri/src-tauri/src/commands/cs2.rs`:
```rust
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct CfgWriteResult {
    #[serde(rename = "cfgPath")]
    cfg_path: String,
    content: String,
}

#[tauri::command]
pub fn write_cs2_cfg(annotations_root: String, command: String) -> Result<CfgWriteResult, String> {
    if annotations_root.is_empty() {
        return Err("Annotations folder not configured in Settings.".into());
    }
    // Mirrors Electron: path.resolve(path.join(annotationsRoot, '../../cfg'))
    let mut cfg_dir = PathBuf::from(&annotations_root);
    cfg_dir.pop(); // .../annotations
    cfg_dir.pop(); // .../csgo
    cfg_dir.push("cfg");

    if !cfg_dir.exists() {
        return Err(format!("CS2 cfg folder not found at: {}", cfg_dir.display()));
    }

    let cfg_file = cfg_dir.join("annotation_manager.cfg");
    fs::write(&cfg_file, format!("{}\n", command)).map_err(|e| e.to_string())?;

    Ok(CfgWriteResult {
        cfg_path: cfg_file.to_string_lossy().to_string(),
        content: command,
    })
}
```

- [ ] **Step 2: Register the command**

In `apps/desktop-tauri/src-tauri/src/lib.rs`:
```rust
use commands::cs2::write_cs2_cfg;
```
Add `write_cs2_cfg,` to `generate_handler!`.

- [ ] **Step 3: Grant shell/clipboard/opener capabilities**

Confirm `apps/desktop-tauri/src-tauri/capabilities/default.json`'s `permissions` array (from Task 1) already includes `"shell:allow-open"`, `"clipboard-manager:allow-write-text"`, `"opener:allow-reveal-item-in-dir"` — it does, from Task 1's Step 5. No change needed; this step is a verification, not an edit.

- [ ] **Step 4: Write the failing test for `writeCommand`**

Add to `apps/desktop-tauri/src/adapters/TauriAdapter.test.ts` (add a `write_cs2_cfg` case to the `mockIPC` switch in `beforeEach`, returning `{ cfgPath: 'C:\\fake\\cfg\\annotation_manager.cfg', content: a.command }`):
```ts
describe('createTauriAdapter — cs2', () => {
  it('writes the command to the cfg file via the Rust command', async () => {
    const adapter = createTauriAdapter()
    await adapter.setAnnotationsRoot?.('C:\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\annotations\\local')
    const result = await adapter.cs2?.writeCommand('sv_cheats 1')
    expect(result?.error).toBeUndefined()
    expect(result?.cfgPath).toContain('annotation_manager.cfg')
  })
})
```

- [ ] **Step 5: Run it, confirm it fails**

Run: `pnpm test -- TauriAdapter.test.ts`
Expected: FAIL — `adapter.cs2` is `undefined`.

- [ ] **Step 6: Implement the `cs2` and `clipboard` sub-objects**

Add imports to the top of `apps/desktop-tauri/src/adapters/TauriAdapter.ts`:
```ts
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { open } from '@tauri-apps/plugin-shell'
import { listen } from '@tauri-apps/api/event'
```
Add to the returned object (after `detectSteamPath`):
```ts
    async launchCS2() {
      try {
        await open('steam://run/730')
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },

    cs2: {
      async writeCommand(command: string) {
        const store = await settingsStore()
        const annotationsRoot = (await store.get<string>('annotationsRoot')) ?? ''
        try {
          const result = await invoke<{ cfgPath: string; content: string }>('write_cs2_cfg', {
            annotationsRoot,
            command,
          })
          await writeText(command)
          return result
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) }
        }
      },
      watchFile(filePath: string) {
        void invoke('watch_file', { path: filePath })
      },
      unwatchFile() {
        void invoke('unwatch_file')
      },
      onFileChanged(callback: (filePath: string) => void) {
        let unlisten: (() => void) | undefined
        void listen<string>('guide-file-changed', (event) => callback(event.payload)).then((fn) => {
          unlisten = fn
        })
        return () => unlisten?.()
      },
    },

    clipboard: {
      async write(text: string) {
        try {
          await writeText(text)
          return {}
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) }
        }
      },
      async showInFolder(path: string) {
        await revealItemInDir(path)
      },
    },
```

- [ ] **Step 7: Run the tests to confirm they pass**

Run: `pnpm test -- TauriAdapter.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop-tauri/src-tauri/src/commands/cs2.rs apps/desktop-tauri/src-tauri/src/lib.rs apps/desktop-tauri/src/adapters/TauriAdapter.ts apps/desktop-tauri/src/adapters/TauriAdapter.test.ts
git commit -m "feat(desktop-tauri): add CS2 cfg writing, launch, clipboard, and file-watch wiring"
```

---

### Task 12: Deep-link auth + web app callback change

**Files:**
- Create: `apps/desktop-tauri/src/lib/authBridge.ts`
- Create: `apps/desktop-tauri/src/lib/authBridge.test.ts`
- Modify: `apps/web/src/app/auth/desktop-callback/page.tsx` (or equivalent — locate via Step 1 before editing)

**Interfaces:**
- Produces: `getAuthState(): Promise<AuthState>`, `signOut(): Promise<void>`, `openSteamSignIn(): Promise<void>`, `onAuthStateChanged(cb: (state: AuthState) => void): () => void` in `authBridge.ts` — consumed by Task 14's `AuthButton.tsx`/hooks and wired into `TauriAdapter.getAuthState` in Task 13.

- [ ] **Step 1: Locate the existing desktop-callback page and its scheme logic**

Run: `grep -rn "cs2ann://" apps/web/src/app/auth`
Read the matched file in full before editing — it currently redirects unconditionally to `cs2ann://callback?token=...`.

- [ ] **Step 2: Add a `client` query param to distinguish which desktop app initiated sign-in**

In `apps/desktop-tauri/src/lib/authBridge.ts` (created in Step 4 below), `openSteamSignIn` will open `https://cs2annotations.com/auth/signin?callbackUrl=/auth/desktop-callback&client=tauri` (note the `client=tauri` param, vs. Electron's existing URL with no `client` param, meaning "default to `cs2ann://`").

In the web app's desktop-callback page found in Step 1, change the deep-link redirect to branch on that param — read the file's current redirect-building code first, then change only the scheme selection, e.g.:
```ts
const client = searchParams.get('client')
const scheme = client === 'tauri' ? 'cs2ann-tauri' : 'cs2ann'
const deepLinkUrl = `${scheme}://callback?token=${token}&name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}`
```
(Match this to the file's actual existing variable names for `token`/`name`/`avatar` — read the file first, don't guess field names.)

- [ ] **Step 3: Verify the web app still builds**

Run: `cd apps/web && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Write the failing test for `authBridge`'s state shape**

`apps/desktop-tauri/src/lib/authBridge.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks'
import { getAuthState, signOut } from './authBridge'

const store = new Map<string, unknown>()

beforeEach(() => {
  store.clear()
  mockIPC((cmd, args) => {
    const a = args as Record<string, unknown>
    if (cmd === 'plugin:store|get') return store.get(a.key as string) ?? null
    if (cmd === 'plugin:store|set') {
      store.set(a.key as string, a.value)
      return null
    }
    if (cmd === 'plugin:store|delete') {
      store.delete(a.key as string)
      return true
    }
    if (cmd === 'plugin:store|save') return null
    throw new Error(`unmocked command: ${cmd}`)
  })
})

afterEach(() => clearMocks())

describe('authBridge', () => {
  it('returns an empty auth state when no token is stored', async () => {
    const state = await getAuthState()
    expect(state).toEqual({ token: null, name: '', avatar: '' })
  })

  it('clears the stored token on signOut', async () => {
    store.set('authToken', 'abc123')
    store.set('authName', 'Player')
    store.set('authAvatar', 'https://example.com/a.png')
    await signOut()
    const state = await getAuthState()
    expect(state.token).toBeNull()
  })
})
```

- [ ] **Step 5: Run it, confirm it fails**

Run: `cd apps/desktop-tauri && pnpm test -- authBridge.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 6: Implement `authBridge.ts`**

`apps/desktop-tauri/src/lib/authBridge.ts`:
```ts
import { load } from '@tauri-apps/plugin-store'
import { open } from '@tauri-apps/plugin-shell'
import { onOpenUrl } from '@tauri-apps/plugin-deep-link'
import type { AuthState } from '@cs2ann/shared'

async function store() {
  return load('settings.json', { autoSave: true })
}

export async function getAuthState(): Promise<AuthState> {
  const s = await store()
  return {
    token: (await s.get<string>('authToken')) ?? null,
    name: (await s.get<string>('authName')) ?? '',
    avatar: (await s.get<string>('authAvatar')) ?? '',
  }
}

export async function signOut(): Promise<void> {
  const s = await store()
  await s.delete('authToken')
  await s.delete('authName')
  await s.delete('authAvatar')
}

export async function openSteamSignIn(): Promise<void> {
  await open('https://cs2annotations.com/auth/signin?callbackUrl=/auth/desktop-callback&client=tauri')
}

type AuthListener = (state: AuthState) => void
const listeners = new Set<AuthListener>()
let deepLinkRegistered = false

function parseCallbackUrl(url: string): AuthState | null {
  try {
    const parsed = new URL(url)
    if (parsed.pathname !== '/callback') return null
    const token = parsed.searchParams.get('token')
    if (!token) return null
    return {
      token,
      name: parsed.searchParams.get('name') ?? '',
      avatar: parsed.searchParams.get('avatar') ?? '',
    }
  } catch {
    return null
  }
}

export function onAuthStateChanged(callback: AuthListener): () => void {
  listeners.add(callback)

  if (!deepLinkRegistered) {
    deepLinkRegistered = true
    void onOpenUrl(async (urls) => {
      for (const url of urls) {
        const state = parseCallbackUrl(url)
        if (!state) continue
        const s = await store()
        await s.set('authToken', state.token)
        await s.set('authName', state.name)
        await s.set('authAvatar', state.avatar)
        listeners.forEach((l) => l(state))
      }
    })
  }

  return () => listeners.delete(callback)
}
```

- [ ] **Step 7: Run the tests to confirm they pass**

Run: `pnpm test -- authBridge.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 8: Add the deep-link permission and verify manually**

Confirm `apps/desktop-tauri/src-tauri/capabilities/default.json` includes `"deep-link:default"` (added in Task 1). Run `pnpm --filter @cs2ann/desktop-tauri tauri dev`, then from a terminal: `start cs2ann-tauri://callback?token=test123&name=Tester&avatar=`. Expected: no crash (full UI wiring lands in Task 14 — this step only confirms the OS hands the URL to the running app without erroring; check the DevTools console for the `onOpenUrl` callback firing if you add a temporary `console.log`).

- [ ] **Step 9: Commit**

```bash
git add apps/desktop-tauri/src/lib/authBridge.ts apps/desktop-tauri/src/lib/authBridge.test.ts apps/web/src/app/auth/desktop-callback
git commit -m "feat(desktop-tauri): add deep-link auth bridge; web callback supports both desktop schemes"
```

---

### Task 13: Cloud API + media + `TauriAdapter` cloud methods

**Files:**
- Create: `apps/desktop-tauri/src/lib/cloudApi.ts`
- Create: `apps/desktop-tauri/src/lib/cloudApi.test.ts`
- Modify: `apps/desktop-tauri/src/adapters/TauriAdapter.ts`

**Interfaces:**
- Consumes: `getAuthState` from `authBridge.ts` (Task 12); the extended `GuideAdapter` cloud methods from Task 3.
- Produces: `cloudApi.ts` exporting `cloudListGuides`, `cloudPushGuide`, `cloudPullGuide`, `cloudGetSyncState`, `cloudGetAllSyncStates`, `cloudDeleteGuide`, `openCommunity`, `featuredFork`, `savedPullGuide`, and a `media` object (`list`, `createLink`, `createUpload`, `update`, `remove`) — all calling `cs2annotations.com/api` directly via `fetch`. `TauriAdapter` gains `cloudPushGuide`, `cloudPullGuide`, `cloudGetSyncState`, `cloudDeleteGuide`, `getAuthState`, `media`.

- [ ] **Step 1: Write the failing test for the sync-state shape**

`apps/desktop-tauri/src/lib/cloudApi.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks'

const authStore = new Map<string, unknown>()

beforeEach(() => {
  authStore.clear()
  mockIPC((cmd, args) => {
    const a = args as Record<string, unknown>
    if (cmd === 'plugin:store|get') return authStore.get(a.key as string) ?? null
    if (cmd === 'plugin:store|set') {
      authStore.set(a.key as string, a.value)
      return null
    }
    if (cmd === 'plugin:store|save') return null
    throw new Error(`unmocked command: ${cmd}`)
  })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  clearMocks()
  vi.unstubAllGlobals()
})

describe('cloudGetSyncState', () => {
  it('reports not_in_cloud when no cloudId is stored for the file', async () => {
    const { cloudGetSyncState } = await import('./cloudApi')
    const result = await cloudGetSyncState('C:\\guides\\foo.txt')
    expect(result.synced).toBe(false)
  })

  it('sends the bearer token from stored auth state', async () => {
    authStore.set('authToken', 'tok-123')
    authStore.set('cloudId:C:\\guides\\foo.txt', 'cloud-abc')
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ guide: { version: 2 } }),
    })
    const { cloudGetSyncState } = await import('./cloudApi')
    await cloudGetSyncState('C:\\guides\\foo.txt')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/guides/cloud-abc'),
      expect.objectContaining({ headers: { Authorization: 'Bearer tok-123' } })
    )
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm test -- cloudApi.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `cloudApi.ts`**

`apps/desktop-tauri/src/lib/cloudApi.ts`:
```ts
import { load } from '@tauri-apps/plugin-store'
import { open } from '@tauri-apps/plugin-shell'
import type {
  AnnotationMedia,
  CreateMediaPayload,
  UpdateMediaPayload,
  CloudPushPayload,
  CloudPushResult,
  CloudSyncStateResult,
} from '@cs2ann/shared'

const WEB_API = 'https://cs2annotations.com/api'

async function store() {
  return load('settings.json', { autoSave: true })
}

async function authHeaders(): Promise<Record<string, string>> {
  const s = await store()
  const token = await s.get<string>('authToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function cloudListGuides() {
  const res = await fetch(`${WEB_API}/guides`, { headers: await authHeaders() })
  if (!res.ok) return { error: 'Request failed' }
  return res.json()
}

export async function cloudPushGuide(payload: CloudPushPayload & { content: string }): Promise<CloudPushResult> {
  const s = await store()
  const jsonHeaders = { ...(await authHeaders()), 'Content-Type': 'application/json' }

  const apiError = async (res: Response): Promise<string> => {
    if (res.status === 401) return 'Not signed in — sign out and back in'
    const body = await res.json().catch(() => ({}))
    return body.error ?? `Push failed (${res.status})`
  }

  const persistCloudState = async (guide: { id: string; version: number }) => {
    await s.set(`cloudVersion:${payload.filePath}`, guide.version)
    await s.set(`lastPushed:${payload.filePath}`, Date.now())
    await s.set(`cloudId:${payload.filePath}`, guide.id)
  }

  const createGuide = async (): Promise<CloudPushResult> => {
    const res = await fetch(`${WEB_API}/guides`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ title: payload.title, map: payload.map, nodeCount: payload.nodeCount ?? 0, content: payload.content }),
    })
    if (!res.ok) return { error: await apiError(res) }
    const { guide } = await res.json()
    await persistCloudState(guide)
    return { guide }
  }

  if (!payload.cloudId) return createGuide()

  const res = await fetch(`${WEB_API}/guides/${payload.cloudId}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({
      title: payload.title,
      map: payload.map,
      nodeCount: payload.nodeCount ?? 0,
      version: payload.cloudVersion ?? 1,
      content: payload.content,
    }),
  })
  if (res.status === 409) {
    const data = await res.json()
    return { conflict: true, cloudVersion: data.cloudVersion }
  }
  if (res.status === 404) {
    await s.delete(`cloudId:${payload.filePath}`)
    await s.delete(`cloudVersion:${payload.filePath}`)
    return createGuide()
  }
  if (!res.ok) return { error: await apiError(res) }
  const { guide } = await res.json()
  await persistCloudState(guide)
  return { guide }
}

export async function cloudPullGuide(payload: { cloudId: string; filePath: string }) {
  const res = await fetch(`${WEB_API}/guides/${payload.cloudId}`, { headers: await authHeaders() })
  if (!res.ok) return { error: 'Pull failed' }
  const { guide, downloadUrl } = await res.json()
  const kv3Res = await fetch(downloadUrl)
  const content = await kv3Res.text()
  const { invoke } = await import('@tauri-apps/api/core')
  if (await invoke<boolean>('path_exists', { path: payload.filePath })) {
    await invoke('copy_file', { from: payload.filePath, to: `${payload.filePath}.bak` })
  }
  await invoke('write_text_file', { path: payload.filePath, content })
  const s = await store()
  await s.set(`cloudVersion:${payload.filePath}`, guide.version)
  return { ok: true }
}

export async function cloudGetSyncState(filePath: string): Promise<CloudSyncStateResult> {
  const s = await store()
  const cloudId = await s.get<string>(`cloudId:${filePath}`)
  const localVersion = (await s.get<number>(`cloudVersion:${filePath}`)) ?? 0
  const cloudAuthorId = await s.get<string>(`cloudAuthorId:${filePath}`)
  if (!cloudId) return { synced: false, cloudAuthorId: cloudAuthorId ?? null }
  try {
    const res = await fetch(`${WEB_API}/guides/${cloudId}`, { headers: await authHeaders() })
    if (!res.ok) return { synced: false, cloudId, localVersion, cloudAuthorId: cloudAuthorId ?? null }
    const { guide } = await res.json()
    return {
      synced: true,
      cloudId,
      localVersion,
      cloudVersion: guide.version,
      behind: guide.version > localVersion,
      cloudAuthorId: cloudAuthorId ?? null,
    }
  } catch {
    return { synced: false, cloudId, localVersion, cloudAuthorId: cloudAuthorId ?? null }
  }
}

export async function cloudGetAllSyncStates(filePaths: string[]) {
  const s = await store()
  const token = await s.get<string>('authToken')
  if (!token) return { states: {} }

  const localStates: Record<string, { status: string; cloudId?: string; cloudVersion?: number }> = {}
  for (const filePath of filePaths) {
    const cloudId = await s.get<string>(`cloudId:${filePath}`)
    localStates[filePath] = cloudId
      ? { status: 'local_ahead', cloudId, cloudVersion: (await s.get<number>(`cloudVersion:${filePath}`)) ?? 0 }
      : { status: 'not_in_cloud' }
  }

  try {
    const res = await fetch(`${WEB_API}/guides`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return { states: localStates }
    const { guides } = (await res.json()) as { guides: Array<{ id: string; version: number }> }
    const cloudById = new Map(guides.map((g) => [g.id, g]))
    const states: Record<string, { status: string; cloudId?: string; cloudVersion?: number }> = {}
    const { invoke } = await import('@tauri-apps/api/core')

    for (const filePath of filePaths) {
      const cloudId = await s.get<string>(`cloudId:${filePath}`)
      const localVersion = (await s.get<number>(`cloudVersion:${filePath}`)) ?? 0
      const lastPushed = (await s.get<number>(`lastPushed:${filePath}`)) ?? 0
      if (!cloudId) {
        states[filePath] = { status: 'not_in_cloud' }
        continue
      }
      const cloudGuide = cloudById.get(cloudId)
      if (!cloudGuide) {
        states[filePath] = { status: 'not_in_cloud' }
        continue
      }
      if (cloudGuide.version > localVersion) {
        states[filePath] = { status: 'cloud_ahead', cloudId, cloudVersion: cloudGuide.version }
        continue
      }
      // Rust has no `stat` command yet — approximate "local_ahead" via lastPushed only.
      void invoke // keep import used if the mtime check below is skipped
      states[filePath] = { status: lastPushed > 0 ? 'synced' : 'local_ahead', cloudId, cloudVersion: cloudGuide.version }
    }
    return { states }
  } catch {
    return { states: localStates }
  }
}

export async function cloudDeleteGuide(cloudId: string) {
  const s = await store()
  const token = await s.get<string>('authToken')
  if (!token) return { error: 'Not signed in' }
  const res = await fetch(`${WEB_API}/guides/${cloudId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error ?? `Cloud delete failed (${res.status})` }
  }
  return {}
}

export async function openCommunity() {
  await open('https://cs2annotations.com/guides')
}

export async function featuredFork(guideId: string, title: string) {
  const { invoke } = await import('@tauri-apps/api/core')
  const { toLocalGuideName } = await import('./guideNaming')
  const s = await store()
  const annotationsRoot = (await s.get<string>('annotationsRoot')) ?? ''
  if (!annotationsRoot) return { error: 'Annotations folder not configured. Set it in Settings first.' }

  const res = await fetch(`${WEB_API}/featured-guides/${guideId}/blob`, { redirect: 'follow' })
  if (!res.ok) return { error: `Failed to fetch guide content (${res.status})` }
  const content = await res.text()

  const safeName = toLocalGuideName(title) || 'featured_guide'
  const filePath = `${annotationsRoot}\\${safeName}\\${safeName}.txt`
  if (await invoke<boolean>('path_exists', { path: filePath })) {
    return { error: `A guide named "${safeName}" already exists in your annotations folder.` }
  }
  const cleanContent = content.startsWith('﻿') ? content.slice(1) : content
  await invoke('write_text_file', { path: filePath, content: '﻿' + cleanContent })
  await s.set(`cloudId:${filePath}`, guideId)
  await s.set(`cloudVersion:${filePath}`, 1)
  return { ok: true, filePath }
}

export async function savedPullGuide(payload: { guideId: string; title: string; downloadUrl: string }) {
  const { invoke } = await import('@tauri-apps/api/core')
  const { toLocalGuideName } = await import('./guideNaming')
  const s = await store()
  const annotationsRoot = (await s.get<string>('annotationsRoot')) ?? ''
  if (!annotationsRoot) return { error: 'Annotations folder not configured. Set it in Settings first.' }

  const res = await fetch(payload.downloadUrl, { redirect: 'follow' })
  if (!res.ok) return { error: `Failed to fetch guide content (${res.status})` }
  const content = await res.text()
  const safeName = toLocalGuideName(payload.title) || 'saved_guide'
  const filePath = `${annotationsRoot}\\${safeName}\\${safeName}.txt`
  const cleanContent = content.startsWith('﻿') ? content.slice(1) : content
  await invoke('write_text_file', { path: filePath, content: '﻿' + cleanContent })
  return { ok: true, filePath }
}

export const media = {
  async list(guideId: string, nodeId?: string): Promise<AnnotationMedia[]> {
    const s = await store()
    const token = await s.get<string>('authToken')
    if (!token) return []
    const url = nodeId ? `${WEB_API}/guides/${guideId}/media?nodeId=${nodeId}` : `${WEB_API}/guides/${guideId}/media`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    return res.ok ? res.json() : []
  },
  async createLink(guideId: string, payload: CreateMediaPayload): Promise<AnnotationMedia> {
    const res = await fetch(`${WEB_API}/guides/${guideId}/media`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async createUpload(guideId: string, formData: FormData): Promise<AnnotationMedia> {
    const res = await fetch(`${WEB_API}/guides/${guideId}/media`, {
      method: 'POST',
      headers: await authHeaders(),
      body: formData,
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async update(guideId: string, mediaId: string, payload: UpdateMediaPayload): Promise<AnnotationMedia> {
    const res = await fetch(`${WEB_API}/guides/${guideId}/media/${mediaId}`, {
      method: 'PUT',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async remove(guideId: string, mediaId: string): Promise<void> {
    await fetch(`${WEB_API}/guides/${guideId}/media/${mediaId}`, { method: 'DELETE', headers: await authHeaders() })
  },
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `pnpm test -- cloudApi.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Wire `cloudApi` and `authBridge` into `TauriAdapter`**

`GuideAdapter.cloudPushGuide` (Task 3) is typed to take `CloudPushPayload` — no `content` field, matching Electron's `LocalAdapter` where the main process reads the file itself. `cloudApi.cloudPushGuide` (this task, Step 3) requires `content` explicitly, since there's no privileged process to read it silently. Reconcile this with a thin wrapper in `TauriAdapter.ts` that reads the file before delegating — `cloudPullGuide`/`cloudGetSyncState`/`cloudDeleteGuide`/`getAuthState` have no such mismatch and pass through directly.

Add to the top of `apps/desktop-tauri/src/adapters/TauriAdapter.ts`:
```ts
import { getAuthState } from '../lib/authBridge'
import { cloudPushGuide as cloudPushGuideImpl, cloudPullGuide, cloudGetSyncState, cloudDeleteGuide, media } from '../lib/cloudApi'
import type { CloudPushPayload } from '@cs2ann/shared'
```
Add to the returned object (after `clipboard`):
```ts
    async cloudPushGuide(payload: CloudPushPayload) {
      const raw = await invoke<string>('read_text_file', { path: payload.filePath })
      const content = stripBom(raw)
      return cloudPushGuideImpl({ ...payload, content })
    },
    cloudPullGuide,
    cloudGetSyncState,
    cloudDeleteGuide,
    getAuthState,
    media,
```

- [ ] **Step 6: Run the full `TauriAdapter` test suite to confirm nothing regressed**

Run: `pnpm test`
Expected: PASS, all suites.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop-tauri/src/lib/cloudApi.ts apps/desktop-tauri/src/lib/cloudApi.test.ts apps/desktop-tauri/src/adapters/TauriAdapter.ts
git commit -m "feat(desktop-tauri): add cloud API, media, and wire cloud methods into TauriAdapter"
```

---

### Task 14: App assembly — full UI parity

**Files:**
- Modify: `apps/desktop-tauri/src/App.tsx`
- Create: `apps/desktop-tauri/src/components/AuthButton.tsx`
- Create: `apps/desktop-tauri/src/components/CloudPanel.tsx`
- Create: `apps/desktop-tauri/src/hooks/useCloudStatus.ts`
- Create: `apps/desktop-tauri/src/hooks/useFeaturedGuides.ts`
- Create: `apps/desktop-tauri/src/hooks/useSavedGuides.ts`
- Modify: `apps/desktop-tauri/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `createTauriAdapter` (Tasks 9-13), `getAuthState`/`onAuthStateChanged`/`signOut`/`openSteamSignIn` from `authBridge.ts`, `featuredFork`/`savedPullGuide` from `cloudApi.ts`, `GuideAdapterProvider`/`Guides`/`Settings`/`TopNav` from `@cs2ann/ui`.
- Produces: a fully wired app — this is the integration point where every prior task's output gets exercised end-to-end.

- [ ] **Step 1: Port `useFeaturedGuides.ts` (no changes needed — it already only uses `fetch`, no Electron API)**

Copy `apps/desktop/src/hooks/useFeaturedGuides.ts` to `apps/desktop-tauri/src/hooks/useFeaturedGuides.ts` verbatim — read the source first, then write an identical copy (it has zero `window.electronAPI` references, confirmed during design research).

- [ ] **Step 2: Port `useSavedGuides.ts`, replacing `window.electronAPI.getAuthState`/`onAuthStateChanged`**

Read `apps/desktop/src/hooks/useSavedGuides.ts` first. Write `apps/desktop-tauri/src/hooks/useSavedGuides.ts` as the same structure, with:
```ts
import { useState, useEffect } from 'react'
import { getAuthState, onAuthStateChanged } from '../lib/authBridge'

export interface SavedGuide {
  savedId: string
  id: string
  title: string
  map: string | null
  nodeCount: number
  version: number
  isPublic: boolean
  authorName: string | null
  downloadUrl: string | null
}

const WEB_API = 'https://cs2annotations.com/api'

export function useSavedGuides(): { guides: SavedGuide[]; loading: boolean; refresh: () => void } {
  const [guides, setGuides] = useState<SavedGuide[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGuides = () => {
    getAuthState().then((authState) => {
      if (!authState.token) {
        setGuides([])
        setLoading(false)
        return
      }
      setLoading(true)
      fetch(`${WEB_API}/saved-guides`, { headers: { Authorization: `Bearer ${authState.token}` } })
        .then((r) => (r.ok ? (r.json() as Promise<{ guides: SavedGuide[] }>) : { guides: [] }))
        .then((data) => setGuides(data.guides ?? []))
        .catch(() => setGuides([]))
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => {
    fetchGuides()
    const interval = setInterval(fetchGuides, 2 * 60 * 1000)
    const unsub = onAuthStateChanged(() => {
      setGuides([])
      setLoading(true)
      fetchGuides()
    })
    return () => {
      clearInterval(interval)
      unsub()
    }
  }, [])

  return { guides, loading, refresh: fetchGuides }
}
```

- [ ] **Step 3: Port `useCloudStatus.ts`, replacing `window.electronAPI` calls with the adapter and `cloudApi`**

Read `apps/desktop/src/hooks/useCloudStatus.ts` first. Write `apps/desktop-tauri/src/hooks/useCloudStatus.ts`:
```ts
import { useState, useEffect, useCallback } from 'react'
import type { GuideSummary, GuideSyncState } from '@cs2ann/shared'
import { getAuthState, onAuthStateChanged } from '../lib/authBridge'
import { cloudGetAllSyncStates } from '../lib/cloudApi'
import { createTauriAdapter } from '../adapters/TauriAdapter'

const adapter = createTauriAdapter()

export interface CloudStatusResult {
  guides: GuideSummary[]
  statuses: Record<string, GuideSyncState>
  loading: boolean
  refresh: () => void
}

export function useCloudStatus(): CloudStatusResult {
  const [guides, setGuides] = useState<GuideSummary[]>([])
  const [statuses, setStatuses] = useState<Record<string, GuideSyncState>>({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const authState = await getAuthState()
    if (!authState.token) {
      setStatuses({})
      return
    }
    setLoading(true)
    try {
      const allGuides = await adapter.listGuides()
      setGuides(allGuides)
      const localGuides = allGuides.filter((g) => g.source === 'local')
      const filePaths = localGuides.map((g) => g.id)
      if (filePaths.length === 0) {
        setStatuses({})
        return
      }
      const { states } = await cloudGetAllSyncStates(filePaths)
      const resolved: Record<string, GuideSyncState> = {}
      for (const [filePath, state] of Object.entries(states as Record<string, { status: string; cloudId?: string; cloudVersion?: number }>)) {
        resolved[filePath] = { status: state.status as GuideSyncState['status'], cloudId: state.cloudId, cloudVersion: state.cloudVersion }
      }
      setStatuses(resolved)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const unsub = onAuthStateChanged(() => void refresh())
    return unsub
  }, [refresh])

  return { guides, statuses, loading, refresh }
}
```

- [ ] **Step 4: Port `AuthButton.tsx`, replacing `window.electronAPI` calls**

Read `apps/desktop/src/components/AuthButton.tsx` first. Write `apps/desktop-tauri/src/components/AuthButton.tsx` with the identical JSX/markup, replacing only the three call sites:
- `window.electronAPI.getAuthState()` → `getAuthState()` (imported from `'../lib/authBridge'`)
- `window.electronAPI.onAuthStateChanged((state) => {...})` → `onAuthStateChanged((state) => {...})`
- `window.electronAPI.signOut()` → `signOut()`
- `window.electronAPI.openSteamSignIn()` → `openSteamSignIn()`

- [ ] **Step 5: Port `CloudPanel.tsx`**

Copy `apps/desktop/src/components/CloudPanel.tsx` (345 lines) to `apps/desktop-tauri/src/components/CloudPanel.tsx` verbatim, then make exactly these substitutions (everything else — the `GuideRow`/`SectionHeader` subcomponents, all JSX, all Tailwind classes, the behind/not-pushed/synced grouping logic — is unchanged):

1. Add near the top: `import { getAuthState, onAuthStateChanged } from '../lib/authBridge'` and `import { cloudPushGuide, cloudPullGuide } from '../lib/cloudApi'`. Remove the local `interface AuthState { ... }` and instead `import type { AuthState } from '@cs2ann/shared'` (it's exported from Task 3's `adapter.ts` changes).
2. Line 100: `window.electronAPI.getAuthState().then(setAuthState)` → `getAuthState().then(setAuthState)`
3. Line 101: `window.electronAPI.onAuthStateChanged(setAuthState)` → `onAuthStateChanged(setAuthState)`
4. Line 124: `const res = await window.electronAPI.cloudPushGuide({` → `const res = await cloudPushGuide({` — and since `cloudPushGuide` (Task 13) additionally requires the guide's raw KV3 `content` (Electron's main process read the file itself; the Tauri version doesn't), add a `content` field to the call by reading the file first via the adapter:
   ```ts
   const { invoke } = await import('@tauri-apps/api/core')
   const rawContent = await invoke<string>('read_text_file', { path: guide.id })
   const content = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent
   const res = await cloudPushGuide({
     filePath: guide.id,
     title: guide.name,
     map: guide.mapName ?? '',
     nodeCount: 0,
     cloudId: state?.cloudId,
     cloudVersion: state?.cloudVersion,
     content,
   })
   ```
5. Line 152: `const res = await window.electronAPI.cloudPullGuide({ cloudId: state.cloudId, filePath: guide.id })` → `const res = await cloudPullGuide({ cloudId: state.cloudId, filePath: guide.id })`

Everything else in the file (the `!authState`/`!authState.token` early returns, `pushAll`/`pullAll`, the three collapsible sections, the empty state) stays byte-for-byte identical.

- [ ] **Step 6: Assemble `App.tsx`**

Copy `apps/desktop/src/App.tsx` (120 lines) to `apps/desktop-tauri/src/App.tsx` verbatim, then make exactly these substitutions (the JSX layout — `TopNav`, the sidebar wrapper div, the "Browse community" button, the Settings modal wrapper — is unchanged):

1. Replace `import { createLocalAdapter } from './adapters/LocalAdapter'` with `import { createTauriAdapter } from './adapters/TauriAdapter'` and `import { openCommunity } from './lib/cloudApi'`.
2. Replace `const adapter = createLocalAdapter()` with `const adapter = createTauriAdapter()`.
3. The `onFeaturedFork` callback: replace `const result = await (window.electronAPI as any).featuredFork(guideId, title)` with `const result = await featuredFork(guideId, title)` (import `featuredFork` from `'./lib/cloudApi'` alongside `openCommunity`).
4. The `onSavedPull` callback: replace `const result = await (window.electronAPI as any).savedPullGuide({...})` with `const result = await savedPullGuide({...})` (same import, same argument shape — `{ guideId: guide.id, title: guide.title, downloadUrl: guide.downloadUrl }`).
5. The "Browse community" button's `onClick`: replace `() => void window.electronAPI.openCommunity()` with `() => void openCommunity()`.

Everything else — `AppInner`'s state (`showSettings`, `sidebarOpen`, `syncDotColor`, `syncStatusText`), the `TopNav`/`Guides`/`CloudPanel`/`Settings` JSX tree and all their props, the modal wrapper markup — stays byte-for-byte identical to `apps/desktop/src/App.tsx`. `Settings` and `CloudPanel` continue to take the exact same props they do today (`CloudPanel` needs `guides`, `statuses`, `loading`, `onRefresh`, `onStatusChange` from `cloudStatus`; `Settings` takes no props — its modal wrapper's own ✕ button and backdrop click handle closing).

- [ ] **Step 7: Boot the app and manually verify parity against Electron**

Run: `pnpm --filter @cs2ann/desktop-tauri tauri dev`. Using a scratch folder as the annotations root (Settings → set folder to e.g. `C:\Temp\cs2ann-tauri-test\annotations`), verify: create a guide, add a node via the guide editor, save, close and reopen the guide, confirm the node persists. Sign in via Steam (real flow — this hits production, per the design doc's accepted constraint), confirm `AuthButton` shows your name/avatar, confirm `CloudPanel` lists your cloud guides. Push a local guide to the cloud, confirm it appears on `cs2annotations.com`. This is the first true end-to-end validation of everything built in Tasks 1-13.

- [ ] **Step 8: Extend the E2E suite with a real "create guide" scenario**

Replace `apps/desktop-tauri/e2e/smoke.spec.ts` in full:
```ts
describe('CS2 Annotations Manager (Tauri) — smoke', () => {
  it('launches and shows the guides UI', async () => {
    const heading = await $('body')
    await heading.waitForExist({ timeout: 15000 })
    const text = await heading.getText()
    expect(text).not.toBe('')
  })

  it('creates a guide and it appears in the guide list', async () => {
    const newGuideButton = await $('button=New Guide')
    await newGuideButton.waitForExist({ timeout: 15000 })
    await newGuideButton.click()

    const nameInput = await $('input[type="text"]')
    await nameInput.waitForExist()
    await nameInput.setValue('E2E_Smoke_Guide')

    const createButton = await $('button=Create')
    await createButton.click()

    const guideEntry = await $('*=E2E_Smoke_Guide')
    await guideEntry.waitForExist({ timeout: 10000 })
    expect(await guideEntry.isExisting()).toBe(true)
  })
})
```
Note: the exact selectors (`button=New Guide`, `button=Create`) must match `packages/ui/src/Guides.tsx`'s actual button text — read that file's JSX before finalizing these selectors, and adjust to match verbatim. Also requires the annotations root to be set before this spec runs; add a `before()` hook in `wdio.conf.ts`'s `onPrepare` or as a first spec step that opens Settings and sets a scratch folder — implement this by reading `packages/ui/src/Settings.tsx` for its actual form field selectors and adding the equivalent `it('sets the annotations folder', ...)` as the suite's first test.

- [ ] **Step 9: Run the full test suite (unit + E2E) to confirm everything passes**

Run:
```bash
pnpm test
cargo test --manifest-path apps/desktop-tauri/src-tauri/Cargo.toml
pnpm --filter @cs2ann/desktop-tauri build
pnpm --filter @cs2ann/desktop-tauri e2e
```
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop-tauri/src/App.tsx apps/desktop-tauri/src/components apps/desktop-tauri/src/hooks apps/desktop-tauri/e2e/smoke.spec.ts
git commit -m "feat(desktop-tauri): assemble full app UI, reaching feature parity with Electron"
```

---

### Task 15: App identity finalization and side-by-side install verification

**Files:**
- Modify: `apps/desktop-tauri/src-tauri/tauri.conf.json` (verification/finalization only — identity fields were set in Task 1)

**Interfaces:**
- Produces: a verified, installable side-by-side setup. No new code interfaces — this task is a build-and-install verification pass.

- [ ] **Step 1: Confirm identity fields are final**

Open `apps/desktop-tauri/src-tauri/tauri.conf.json` and confirm `productName: "CS2 Annotations Manager (Tauri)"`, `identifier: "com.cs2ann.desktop.tauri"`, and `plugins.deep-link.desktop.schemes: ["cs2ann-tauri"]` are unchanged from Task 1 (they should be — this step is a guard against drift, not a rewrite).

- [ ] **Step 2: Build the release installer**

Run: `pnpm --filter @cs2ann/desktop-tauri tauri build`
Expected: produces `apps/desktop-tauri/src-tauri/target/release/bundle/nsis/CS2 Annotations Manager (Tauri)_0.1.0_x64-setup.exe`.

- [ ] **Step 3: Build the Electron installer for comparison**

Run: `cd apps/desktop && pnpm dist:local`
Expected: produces `apps/desktop/release-dist/win-unpacked/CS2 Annotations Manager.exe` (unpacked, per the existing `dist:local` script).

- [ ] **Step 4: Install both on the same machine and verify no collisions**

Run the Tauri NSIS installer from Step 2. Confirm: it installs to a distinct folder (not overwriting the Electron app's install location), creates a Start Menu entry titled "CS2 Annotations Manager (Tauri)" distinct from "CS2 Annotations Manager", and both apps can be launched simultaneously without either crashing or stealing the other's window focus unexpectedly.

- [ ] **Step 5: Verify both deep-link schemes resolve independently**

With both apps installed and running, from a terminal run `start cs2ann://callback?token=electron-test` — confirm only the Electron app receives it (check its console/log or observe `AuthButton` state change). Then run `start cs2ann-tauri://callback?token=tauri-test` — confirm only the Tauri app receives it. If either scheme is handled by the wrong app, check the Windows registry (`HKEY_CLASSES_ROOT\cs2ann` and `...\cs2ann-tauri`) for a stale registration from a prior install and reinstall the affected app to re-register it correctly.

- [ ] **Step 6: Document the outcome**

No commit needed for this task (it's a verification pass, not a code change) — record the result (pass/fail, and any deviations from Steps 4-5) in the plan-tracking mechanism your execution approach uses (e.g. a comment on the tracking issue, or a note in the PR description once this branch is proposed for merge).

---

## Milestone 7 (manual, not a task): Parity validation

Not encoded as a plan task since it's unstructured manual QA, not code — once Task 15 passes, walk every Electron feature against the Tauri build side-by-side: guide CRUD (local + workshop), Steam path auto-detect, CS2 cfg write + keybind, file watch (edit the file externally, confirm the app notices), Steam sign-in, cloud push/pull/conflict (409) handling, featured-guide fork, saved-guide pull, media upload/link/update/remove, delete-guide (including cloud cleanup). Record any parity gap found as a new task appended to this plan before considering the rewrite complete.

## Deferred (out of scope for this plan, per the design doc)

Auto-updater signing infra, `tauri-plugin-updater` wiring, and eventual retirement of `apps/desktop` are milestone 8 in the design doc — write a follow-up plan for that once Task 15 and manual parity validation both pass.
