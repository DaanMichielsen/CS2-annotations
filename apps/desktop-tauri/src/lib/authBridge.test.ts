import { describe, it, expect, beforeEach, vi } from 'vitest'

// authBridge talks to settings through `./settingsStore` (same convention as
// TauriAdapter — see TauriAdapter.test.ts), not the plugin-store IPC wire
// protocol directly, so mock that module instead of `mockIPC`.
const { settings } = vi.hoisted(() => ({ settings: new Map<string, unknown>() }))

vi.mock('./settingsStore', () => ({
  getSetting: vi.fn((key: string) => Promise.resolve(settings.get(key))),
  setSetting: vi.fn((key: string, value: unknown) => {
    settings.set(key, value)
    return Promise.resolve()
  }),
  deleteSetting: vi.fn((key: string) => Promise.resolve(settings.delete(key))),
}))

// `@tauri-apps/plugin-deep-link` talks over Tauri's IPC (`invoke`/`listen`),
// which isn't available under jsdom/vitest, so mock it wholesale. Tests below
// override `getCurrentMock`'s resolved value per-case; `onOpenUrlMock`
// defaults to a no-op "never fires" listener like the real one would be for
// a cold-started process (no live deep-link event, only the argv snapshot).
const { getCurrentMock, onOpenUrlMock } = vi.hoisted(() => ({
  getCurrentMock: vi.fn(() => Promise.resolve<string[] | null>(null)),
  onOpenUrlMock: vi.fn(() => Promise.resolve(() => {})),
}))

vi.mock('@tauri-apps/plugin-deep-link', () => ({
  getCurrent: getCurrentMock,
  onOpenUrl: onOpenUrlMock,
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(() => Promise.resolve()),
}))

// Note: the cold-start test below deliberately does NOT use this static
// import — see the comment on that test.
import { getAuthState, signOut } from './authBridge'

beforeEach(() => {
  settings.clear()
  getCurrentMock.mockReset().mockResolvedValue(null)
  onOpenUrlMock.mockReset().mockResolvedValue(() => {})
})

describe('authBridge', () => {
  it('returns an empty auth state when no token is stored', async () => {
    const state = await getAuthState()
    expect(state).toEqual({ token: null, name: '', avatar: '' })
  })

  it('clears the stored token on signOut', async () => {
    settings.set('authToken', 'abc123')
    settings.set('authName', 'Player')
    settings.set('authAvatar', 'https://example.com/a.png')
    await signOut()
    const state = await getAuthState()
    expect(state.token).toBeNull()
  })

  // Cold start: the OS launched this process *because of* the deep link, so
  // there's no live `deep-link://new-url` event for `onOpenUrl` to catch —
  // the URL only exists as this process's own argv, exposed via `getCurrent`.
  //
  // CONSTRAINT: authBridge keeps a module-level `deepLinkRegistered` flag
  // that never resets between tests — only the *first* `onAuthStateChanged`
  // call on a given module instance registers the deep-link handlers and
  // replays `getCurrent()`. Any other test that called `onAuthStateChanged`
  // on the statically-imported instance before this test would silently
  // consume that one-shot registration. To stay order-independent, this test
  // resets the module registry and imports a fresh authBridge instance whose
  // flag is guaranteed to be false. (The `vi.mock` factories re-run on the
  // fresh import but return the same hoisted mock objects, so the settings
  // map and getCurrent/onOpenUrl mocks are shared with the rest of the file.)
  it('persists the token from getCurrent() on cold start', async () => {
    vi.resetModules()
    const { getAuthState: freshGetAuthState, onAuthStateChanged } = await import('./authBridge')

    getCurrentMock.mockResolvedValue([
      'cs2ann-tauri://auth/callback?token=cold-start-tok&name=Cold&avatar=',
    ])

    const received: Array<{ token: string | null; name: string; avatar: string }> = []
    onAuthStateChanged((state) => {
      received.push(state)
    })

    // handleUrls() runs off the getCurrent() promise chain (several chained
    // awaits: getCurrent() itself, then one per setSetting call), so flush
    // past it with a macrotask tick rather than guessing a microtask count.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(received).toEqual([{ token: 'cold-start-tok', name: 'Cold', avatar: '' }])
    const state = await freshGetAuthState()
    expect(state).toEqual({ token: 'cold-start-tok', name: 'Cold', avatar: '' })
  })
})
