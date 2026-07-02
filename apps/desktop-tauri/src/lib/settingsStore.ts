import { load, type Store } from '@tauri-apps/plugin-store'

const STORE_PATH = 'settings.json'

let storePromise: Promise<Store> | null = null

// `@tauri-apps/plugin-store`'s `load()` talks to the Rust side through a
// resource-id (rid) protocol: `plugin:store|load` returns a rid, and every
// subsequent `get`/`set`/`delete` call is `invoke('plugin:store|...', { rid, ... })`.
// `get` even replies with a `[value, exists]` tuple rather than the bare value.
// That wire protocol is an internal implementation detail of the plugin (and
// is annoying/brittle to hand-mock via `mockIPC`), so the rest of the app
// talks to settings through this module instead of calling `load()` directly.
// Tests mock this module wholesale with `vi.mock('../lib/settingsStore', ...)`.
function getStore(): Promise<Store> {
  if (!storePromise) {
    // The installed `StoreOptions` type marks `defaults` as required even
    // though the plugin treats it as optional at runtime; pass an empty
    // object so we don't seed any keys while still satisfying the type.
    storePromise = load(STORE_PATH, { autoSave: true, defaults: {} })
  }
  return storePromise
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const store = await getStore()
  return store.get<T>(key)
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const store = await getStore()
  await store.set(key, value)
}

export async function deleteSetting(key: string): Promise<boolean> {
  const store = await getStore()
  return store.delete(key)
}
