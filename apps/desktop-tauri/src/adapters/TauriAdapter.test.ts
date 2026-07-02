import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks'

// `@tauri-apps/plugin-store`'s real wire protocol is resource-id (rid) based:
// `load()` calls `plugin:store|load` and gets back a rid, then every
// `get`/`set`/`delete` call is `invoke('plugin:store|...', { rid, ... })` —
// `get` even replies with a `[value, exists]` tuple rather than the bare
// value (verified against `node_modules/@tauri-apps/plugin-store/dist-js/index.js`).
// That's brittle to hand-mock at the `mockIPC` level, so the adapter talks to
// settings through `src/lib/settingsStore.ts`, and this suite mocks that
// module directly instead of mocking the store plugin's IPC commands.
const { settings } = vi.hoisted(() => ({ settings: new Map<string, unknown>() }))

vi.mock('../lib/settingsStore', () => ({
  getSetting: vi.fn((key: string) => Promise.resolve(settings.get(key))),
  setSetting: vi.fn((key: string, value: unknown) => {
    settings.set(key, value)
    return Promise.resolve()
  }),
  deleteSetting: vi.fn((key: string) => Promise.resolve(settings.delete(key))),
}))

import { createTauriAdapter } from './TauriAdapter'

const files = new Map<string, string>()

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
      case 'unwatch_file':
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
