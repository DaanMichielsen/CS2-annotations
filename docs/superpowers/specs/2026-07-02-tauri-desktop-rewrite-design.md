# Tauri Desktop Rewrite — Design

## Goal

Rewrite `apps/desktop` (Electron 28) as a Tauri app to improve performance (startup time, memory, install size). The end goal is to **fully replace Electron** once the Tauri app reaches feature parity and is validated — this is not a permanent side-by-side offering, but the migration is staged: build in parallel, compare, then cut over.

## Success criteria

- Every IPC-backed feature of `apps/desktop` has an equivalent in the Tauri app (except "Run in CS2" keystroke injection — see Non-goals).
- The Tauri app installs and runs side-by-side with the Electron app on the same Windows machine without collision.
- `apps/desktop` and `master` remain untouched and shippable throughout development.
- Every push to the feature branch produces a downloadable, tested installer via GitHub Actions.

## Non-goals (this phase)

- Auto-update signing infrastructure (`tauri-plugin-updater` + minisign keypair) — deferred to a later cutover milestone.
- "Run in CS2" native keystroke injection (`keysender` → Rust equivalent) — dropped. The real working mechanism is `writeCS2Cfg` writing to `annotation_manager.cfg`, bound to an in-game key; direct console injection was never a reliably-used feature.
- macOS/Linux support — the existing app is Windows-primary; Tauri app follows the same scope.
- Automated E2E coverage of cloud/auth flows — production (`cs2annotations.com`) is the only real test target for cloud sync (no staging environment), so hitting it from CI on every push is out of scope. Cloud sync is validated manually.

## Architecture split: Rust (thin) vs TypeScript (domain logic)

The Electron main process today parses and manipulates KV3 files directly (`parseKv3Text`, `serializeKv3Text`, `kv3ToNodes`, `setNodesInRoot` from `@cs2ann/shared`, run in Node). Tauri's backend is Rust, which cannot run this TS code. Decision: **do not port KV3 domain logic to Rust.**

- **Rust (`apps/desktop-tauri/src-tauri`) owns:** raw file read/write/delete/copy, directory listing, file watching (emits events to frontend), Windows registry read for Steam path, CS2 cfg file writing, clipboard write, "show in folder"/"open external", deep-link URL capture, single-instance enforcement, local settings persistence (replaces `electron-store`).
- **TypeScript (`apps/desktop-tauri/src`, webview) owns:** KV3 parsing/serialization/merge (reusing `@cs2ann/shared` exactly as the web app does), guide CRUD orchestration (read raw text via a Rust command → parse → mutate → serialize → write raw text via a Rust command), backup-file (`.bak`) safety and post-write re-parse validation, all cloud API calls (`fetch` directly to `cs2annotations.com/api` — these aren't privileged, they just need the bearer token, which is retrieved via a Rust command), and the `TauriAdapter` implementing `GuideAdapter`.

Rationale: avoids maintaining two parallel implementations of the KV3 format (TS for web, Rust for desktop) that can drift, and there is no performance case for parsing small text files in Rust — the actual performance win from Tauri comes from the runtime (no bundled Chromium/Node, native webview), not from moving parsing to a different language.

## IPC → Tauri command/event mapping

Every channel in `electron/preload/index.ts` needs an equivalent. Grouped by the architecture split above:

**Rust commands (dumb I/O):** `read_file`, `write_file`, `copy_file`, `delete_file`, `list_dir`, `detect_steam_path` (registry read), `watch_file` / `unwatch_file` (emits `guide-file-changed` event, replacing `onGuideFileChanged`), `write_cs2_cfg`, `show_item_in_folder`, `launch_cs2` (opens `steam://run/730` via shell plugin), `copy_to_clipboard`, settings get/set (`annotationsRoot`, `workshopContentPath`, `autoCopyLoadCommandsOnOpen`, `cfgKeybind`), auth token get/set/clear, per-file sync metadata get/set (`cloudId:{path}`, `cloudVersion:{path}`, `lastPushed:{path}`, `cloudAuthorId:{path}`).

**Frontend logic (was main-process logic, moves to TS):** `listGuides` (directory scan + KV3 header sniff — scan can still be a Rust `list_dir` call, but the "is this an annotation file" and map-name sniffing logic move to TS since they read file content), `loadGuide`, `createGuide`, `saveGuide`, `saveAsLocalGuide`, `deleteGuide` (safety check that the path is inside `annotationsRoot` moves to TS, delete itself is a Rust command), `appendNodesToGuide`, `createGuideWithNodes`.

**Frontend `fetch` calls (was main-process `fetch`, moves to TS, token fetched via Rust command):** `cloudListGuides`, `cloudPushGuide`, `cloudPullGuide`, `cloudGetSyncState`, `cloudGetAllSyncStates`, `cloudDeleteGuide`, `openCommunity`, `featuredFork`, `savedPullGuide`, all `media:*` channels.

**Deep link / auth:** `getAuthState`, `signOut`, `openSteamSignIn` stay as Rust commands (token storage is privileged local state); `authStateChanged` event replaces the Electron `authStateChanged` IPC event, fired from the Rust deep-link handler.

## Native dependency replacements

| Electron piece | Tauri replacement | Notes |
|---|---|---|
| `electron-store` | `tauri-plugin-store` | Official plugin, backed by a JSON file — supports the same dynamic per-file keys (`cloudId:{path}`, `cloudVersion:{path}`, `lastPushed:{path}`, `cloudAuthorId:{path}`) as a flat key-value map, no fixed struct needed. |
| `electron-updater` | `tauri-plugin-updater` | Deferred — not wired up in this phase. |
| Custom protocol (`cs2ann://`) + `open-url`/`second-instance` | `tauri-plugin-deep-link` + `tauri-plugin-single-instance` | Tauri app uses a **distinct scheme, `cs2ann-tauri://`**, to coexist with the Electron app's `cs2ann://` registration. |
| `fs.watch` | `notify` crate, wrapped in a Tauri command emitting a debounced (~400ms) `guide-file-changed` event | Same debounce behavior as today. |
| `reg query` via `execFile` | `winreg` crate | Same registry paths (`HKEY_CURRENT_USER\Software\Valve\Steam` → fallback `HKEY_LOCAL_MACHINE\...\WOW6432Node\Valve\Steam`) and hardcoded-path fallback logic. |
| `clipboard.writeText` | `tauri-plugin-clipboard-manager` | Direct swap. |
| `shell.openExternal`, `shell.showItemInFolder` | `tauri-plugin-shell` / `tauri-plugin-opener` | Direct swap. |
| `dialog.showMessageBox` (update-ready prompt) | `tauri-plugin-dialog` | Only needed once the updater is wired up (later phase). |
| `keysender` (native keystroke injection) | **Dropped** | See Non-goals. |

## Known bug fixed during the port

`packages/ui` (shared between both apps) has direct `window.electronAPI` calls that **bypass the `GuideAdapter` interface**, found at:
- `Guides.tsx:206,221` — `cloudPushGuide`, `cloudPullGuide`
- `GuideEditor.tsx:575-588` — `cloudGetSyncState`, `getAuthState`, `cloudDeleteGuide`

These would silently break in a Tauri webview (no `window.electronAPI` global exists there). Fix: extend the `GuideAdapter` interface (`packages/shared/src/adapter.ts`) with these methods, implement them in both `LocalAdapter` (Electron — no behavior change, just routes through the interface instead of a raw cast) and the new `TauriAdapter`, and update the two `packages/ui` call sites to use `useGuideAdapter()` instead of casting `window`.

## App identity (side-by-side coexistence)

| | Electron (`apps/desktop`) | Tauri (`apps/desktop-tauri`) |
|---|---|---|
| Product name | CS2 Annotations Manager | CS2 Annotations Manager (Tauri) |
| App/bundle id | `com.cs2ann.desktop` | `com.cs2ann.desktop.tauri` |
| Deep-link scheme | `cs2ann://` | `cs2ann-tauri://` |
| Install location | Default NSIS location under existing product name | Distinct folder under its own product name |

The distinct deep-link scheme requires a small change to the web app's `/auth/desktop-callback` redirect logic so it can hand the token back to whichever app initiated sign-in (e.g. a `client` query param threaded through the OpenID flow, or two distinct callback query params).

## Repo and CI strategy

- New workspace package `apps/desktop-tauri/`, developed on a long-lived feature branch. Shares `packages/shared` and `packages/ui` (with the adapter fix above). `apps/desktop` and `master` are not touched by this work.
- New GitHub Actions workflow (e.g. `.github/workflows/desktop-tauri.yml`) triggered on push to the feature branch (and/or `workflow_dispatch`):
  1. **Test job:** `pnpm test` (vitest across `packages/shared` and `apps/desktop-tauri`), `cargo test` in `src-tauri`, WebDriver smoke E2E suite (see Testing strategy). Must pass before the next job runs.
  2. **Build job:** `tauri-apps/tauri-action` produces a Windows installer (NSIS or MSI), uploaded as a workflow artifact or draft release — downloadable without merging to master.
- The existing `.github/workflows/release.yml` (tag-triggered, `apps/desktop` via `electron-builder`) is untouched.

## Testing strategy

No automated tests exist today for `apps/desktop` (vitest is configured but `passWithNoTests: true`, zero test files). `packages/shared` has unit tests for a few utils but **no KV3 parse/serialize round-trip test** — a gap regardless of this rewrite.

Three layers, matched to the architecture split:

1. **TypeScript unit tests (vitest).** Add to `packages/shared`: KV3 round-trip tests (`parseKv3Text` → `serializeKv3Text` → re-parse, BOM handling, missing-header repair). Add to `apps/desktop-tauri`: `TauriAdapter` tests using `@tauri-apps/api/mocks` to mock `invoke()`, covering guide CRUD, backup-on-save, and post-write validation (logic that now lives in the frontend).
2. **Rust unit tests (`cargo test`).** Small surface: registry-output parsing against fixture strings (no real registry needed in CI), filename sanitization, settings-store read/write round-trip.
3. **WebDriver E2E smoke suite.** `tauri-driver` (wraps WebView2's native WebDriver) + WebdriverIO, driving the actual compiled binary. Scenarios: launch → set annotations folder → create guide → save → reload from disk → verify content; settings round-trip. Cloud/auth flows are excluded (see Non-goals) — those are covered by manual parity validation.

CI wiring: the test job blocks the build job — a failing test prevents a broken installer from reaching the download link.

## Milestones

1. **Scaffold** — `apps/desktop-tauri` workspace package, Tauri init, Vite+React renderer wired to `packages/shared`/`packages/ui`, blank window boots, CI produces a downloadable installer (unsigned, no tests yet).
2. **Adapter fix** — extend `GuideAdapter` with the cloud-sync methods currently leaking through `window.electronAPI`; update `LocalAdapter` and `packages/ui` call sites; verify the Electron app still works unchanged.
3. **Testing scaffolding** — KV3 round-trip tests in `packages/shared`, vitest config for `apps/desktop-tauri`, `cargo test` scaffold, WebDriver smoke suite skeleton, CI test job wired as a blocking step.
4. **Core file loop** — Rust commands for raw file I/O/watch/registry read; `TauriAdapter` guide CRUD with KV3 parse/serialize/backup/validate in the frontend; Steam path detection; settings persistence (replacing electron-store, including per-file dynamic keys).
5. **CS2 integration** — `writeCS2Cfg`, `launchCS2`, keybind settings. (No keystroke injection.)
6. **Auth + cloud sync** — deep-link (`cs2ann-tauri://`) + single-instance, token storage, cloud push/pull/sync-state/delete, media list/upload/link/update/remove.
7. **Parity validation** — manual side-by-side test pass against every Electron feature; performance/startup/size comparison against Electron.
8. **Cutover prep** *(deferred, out of scope for this plan)* — updater signing keypair, `tauri-plugin-updater` wiring, production release strategy, eventual retirement of `apps/desktop`.

## Risks / open questions

- `winreg` Steam-path detection and `notify`-based file watching need real hardware validation on Windows — behavior differences from the Node equivalents (`reg` shell-out, `fs.watch`) are the main unknowns.
- The `cs2ann-tauri://` deep-link scheme requires a coordinated change to the web app's `/auth/desktop-callback` redirect logic.
- WebView2 must be present on the target machine (bundled or auto-installed by the Tauri installer) — verify the installer handles WebView2 bootstrapping correctly, since this is a new runtime dependency Electron doesn't have.
