import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// cloudApi talks to settings through `./settingsStore` (same convention as
// TauriAdapter and authBridge — see their test files), not the plugin-store
// IPC wire protocol directly, so mock that module instead of `mockIPC`.
const { settings } = vi.hoisted(() => ({ settings: new Map<string, unknown>() }))

vi.mock('./settingsStore', () => ({
  getSetting: vi.fn((key: string) => Promise.resolve(settings.get(key))),
  setSetting: vi.fn((key: string, value: unknown) => {
    settings.set(key, value)
    return Promise.resolve()
  }),
  deleteSetting: vi.fn((key: string) => Promise.resolve(settings.delete(key))),
}))

import { cloudGetSyncState } from './cloudApi'

beforeEach(() => {
  settings.clear()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cloudGetSyncState', () => {
  it('reports not_in_cloud when no cloudId is stored for the file', async () => {
    const result = await cloudGetSyncState('C:\\guides\\foo.txt')
    expect(result.synced).toBe(false)
  })

  it('sends the bearer token from stored auth state', async () => {
    settings.set('authToken', 'tok-123')
    settings.set('cloudId:C:\\guides\\foo.txt', 'cloud-abc')
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ guide: { version: 2 } }),
    })

    await cloudGetSyncState('C:\\guides\\foo.txt')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/guides/cloud-abc'),
      expect.objectContaining({ headers: { Authorization: 'Bearer tok-123' } })
    )
  })
})
