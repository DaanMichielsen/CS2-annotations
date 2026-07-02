import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'

// Deviation from brief: apps/desktop-tauri's package.json has "type":
// "module", so this config runs as ESM (via ts-node/esm) and `__dirname`
// is not defined. Derive it from import.meta.url instead.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

let tauriDriver: ChildProcess | undefined

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
