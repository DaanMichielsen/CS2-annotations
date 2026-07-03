import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'

// Deviation from brief: apps/desktop-tauri's package.json has "type":
// "module", so this config runs as ESM (via ts-node/esm) and `__dirname`
// is not defined. Derive it from import.meta.url instead.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

let tauriDriver: ChildProcess | undefined

// Scratch annotations root the "creates a guide" E2E scenario points the
// app at via the Settings UI (smoke.spec.ts). Defined here (not just in the
// spec) so onPrepare below can guarantee a clean, pre-existing empty
// directory before every run — the Tauri `write_text_file` command does
// `create_dir_all` on write, so the directory would get created lazily
// anyway, but starting from a clean slate makes the "create guide" scenario
// idempotent across repeated local runs (a leftover E2E_Smoke_Guide folder
// from a prior run would otherwise make `createGuide` fail with "already
// exists").
export const E2E_ANNOTATIONS_ROOT = 'C:\\Temp\\cs2ann-tauri-e2e\\annotations'

const APP_BINARY = path.resolve(
  __dirname,
  '../src-tauri/target/release/cs2ann-desktop-tauri.exe'
)

// Deviation from brief: on Windows, tauri-driver shells out to
// msedgedriver.exe via PATH lookup. Rather than requiring a global PATH
// edit, prepend the project-local driver directory (see e2e/README.md)
// to the PATH used for the tauri-driver child process only.
const DRIVERS_DIR = path.resolve(__dirname, './.drivers')

export const config: WebdriverIO.Config = {
  // Deviation from brief: wdio resolves spec globs relative to this
  // config file's own directory (e2e/), not the package root, so the
  // brief's './e2e/*.spec.ts' matched nothing. Use './*.spec.ts'.
  specs: ['./*.spec.ts'],
  maxInstances: 1,
  // Deviation from brief: newer @wdio/local-runner (8.24+) tries to
  // auto-manage a known browser driver (Chrome/Edge/Firefox/Safari) via
  // its own startWebDriver logic and rejects the custom "wry"
  // browserName before ever talking to tauri-driver. Setting
  // hostname/port explicitly tells wdio to connect directly to the
  // already-running tauri-driver server (spawned in beforeSession
  // below) instead of trying to launch/manage a driver itself.
  hostname: '127.0.0.1',
  port: 4444,
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

  onPrepare: () => {
    // Clean slate for the "sets the annotations folder" / "creates a guide"
    // scenario in smoke.spec.ts — remove any guide left over from a
    // previous local run, then recreate the empty directory.
    fs.rmSync(E2E_ANNOTATIONS_ROOT, { recursive: true, force: true })
    fs.mkdirSync(E2E_ANNOTATIONS_ROOT, { recursive: true })
  },

  beforeSession: () => {
    // Deviation from brief: a plain `cargo build --release` compiles the
    // binary in "dev" mode as far as Tauri's runtime is concerned —
    // whether the app loads the embedded frontendDist or reaches for the
    // Vite devUrl (http://localhost:5183) is gated by the `tauri` crate's
    // `custom-protocol` cargo feature, which the `tauri` CLI's `build`
    // command passes automatically and a raw `cargo build` does not.
    // Without it the packaged app tries to load the dev server (which
    // isn't running under `pnpm e2e`) and shows ERR_CONNECTION_REFUSED.
    spawnSync('cargo', ['build', '--release', '--features', 'tauri/custom-protocol'], {
      cwd: path.resolve(__dirname, '../src-tauri'),
      stdio: 'inherit',
    })
    tauriDriver = spawn('tauri-driver', [], {
      stdio: [null, process.stdout, process.stderr],
      env: {
        ...process.env,
        PATH: `${DRIVERS_DIR}${path.delimiter}${process.env.PATH ?? ''}`,
      },
    })
  },

  afterSession: () => {
    tauriDriver?.kill()
  },
}
