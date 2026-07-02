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

import { getAuthState, signOut } from './authBridge'

beforeEach(() => {
  settings.clear()
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
})
