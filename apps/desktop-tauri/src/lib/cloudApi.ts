import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'
import { toLocalGuideName } from './guideNaming'
import { getSetting, setSetting, deleteSetting } from './settingsStore'
import type {
  AnnotationMedia,
  CreateMediaPayload,
  UpdateMediaPayload,
  CloudPushPayload,
  CloudPushResult,
  CloudSyncStateResult,
} from '@cs2ann/shared'

const WEB_API = 'https://cs2annotations.com/api'

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getSetting<string>('authToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function cloudListGuides() {
  try {
    const res = await fetch(`${WEB_API}/guides`, { headers: await authHeaders() })
    if (!res.ok) return { error: 'Request failed' }
    return res.json()
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function cloudPushGuide(payload: CloudPushPayload & { content: string }): Promise<CloudPushResult> {
  try {
    const jsonHeaders = { ...(await authHeaders()), 'Content-Type': 'application/json' }

    const apiError = async (res: Response): Promise<string> => {
      if (res.status === 401) return 'Not signed in — sign out and back in'
      const body = await res.json().catch(() => ({}))
      return body.error ?? `Push failed (${res.status})`
    }

    const persistCloudState = async (guide: { id: string; version: number }) => {
      await setSetting(`cloudVersion:${payload.filePath}`, guide.version)
      await setSetting(`lastPushed:${payload.filePath}`, Date.now())
      await setSetting(`cloudId:${payload.filePath}`, guide.id)
      // Matches Electron's main process: `cloudAuthorId:{path}` is set to the
      // *pusher's* auth token (not the guide's cloud author id — this mirrors
      // an existing quirk in apps/desktop/electron/main/index.ts so the two
      // apps' stored sync state stays byte-for-byte comparable).
      await setSetting(`cloudAuthorId:${payload.filePath}`, (await getSetting<string>('authToken')) ?? null)
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

    if (!payload.cloudId) return await createGuide()

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
      await deleteSetting(`cloudId:${payload.filePath}`)
      await deleteSetting(`cloudVersion:${payload.filePath}`)
      return await createGuide()
    }
    if (!res.ok) return { error: await apiError(res) }
    const { guide } = await res.json()
    await persistCloudState(guide)
    return { guide }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function cloudPullGuide(payload: { cloudId: string; filePath: string }) {
  try {
    const res = await fetch(`${WEB_API}/guides/${payload.cloudId}`, { headers: await authHeaders() })
    if (!res.ok) return { error: 'Pull failed' }
    const { guide, downloadUrl } = await res.json()
    const kv3Res = await fetch(downloadUrl)
    const content = await kv3Res.text()
    if (await invoke<boolean>('path_exists', { path: payload.filePath })) {
      await invoke('copy_file', { from: payload.filePath, to: `${payload.filePath}.bak` })
    }
    await invoke('write_text_file', { path: payload.filePath, content })
    await setSetting(`cloudVersion:${payload.filePath}`, guide.version)
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function cloudGetSyncState(filePath: string): Promise<CloudSyncStateResult> {
  const cloudId = await getSetting<string>(`cloudId:${filePath}`)
  const localVersion = (await getSetting<number>(`cloudVersion:${filePath}`)) ?? 0
  const cloudAuthorId = await getSetting<string>(`cloudAuthorId:${filePath}`)
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
  const token = await getSetting<string>('authToken')
  if (!token) return { states: {} }

  const localStates: Record<string, { status: string; cloudId?: string; cloudVersion?: number }> = {}
  for (const filePath of filePaths) {
    const cloudId = await getSetting<string>(`cloudId:${filePath}`)
    localStates[filePath] = cloudId
      ? { status: 'local_ahead', cloudId, cloudVersion: (await getSetting<number>(`cloudVersion:${filePath}`)) ?? 0 }
      : { status: 'not_in_cloud' }
  }

  try {
    const res = await fetch(`${WEB_API}/guides`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return { states: localStates }
    const { guides } = (await res.json()) as { guides: Array<{ id: string; version: number }> }
    const cloudById = new Map(guides.map((g) => [g.id, g]))
    const states: Record<string, { status: string; cloudId?: string; cloudVersion?: number }> = {}

    for (const filePath of filePaths) {
      const cloudId = await getSetting<string>(`cloudId:${filePath}`)
      const localVersion = (await getSetting<number>(`cloudVersion:${filePath}`)) ?? 0
      const lastPushed = (await getSetting<number>(`lastPushed:${filePath}`)) ?? 0
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
      // Electron distinguishes "synced" from "local_ahead" here via
      // fs.statSync(filePath).mtimeMs vs lastPushed. There's no Rust `stat`
      // command exposed yet, so we can't compare mtimes — approximate with
      // lastPushed alone: any successful push at all reads as synced, and a
      // guide that was never pushed (but somehow has a cloudId) reads as
      // local_ahead so it doesn't silently look "done".
      states[filePath] = { status: lastPushed > 0 ? 'synced' : 'local_ahead', cloudId, cloudVersion: cloudGuide.version }
    }
    return { states }
  } catch {
    return { states: localStates }
  }
}

export async function cloudDeleteGuide(cloudId: string) {
  try {
    const token = await getSetting<string>('authToken')
    if (!token) return { error: 'Not signed in' }
    const res = await fetch(`${WEB_API}/guides/${cloudId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { error: body.error ?? `Cloud delete failed (${res.status})` }
    }
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function openCommunity() {
  await open('https://cs2annotations.com/guides')
}

export async function featuredFork(guideId: string, title: string) {
  try {
    const annotationsRoot = (await getSetting<string>('annotationsRoot')) ?? ''
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
    await setSetting(`cloudId:${filePath}`, guideId)
    await setSetting(`cloudVersion:${filePath}`, 1)
    return { ok: true, filePath }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function savedPullGuide(payload: { guideId: string; title: string; downloadUrl: string }) {
  try {
    const annotationsRoot = (await getSetting<string>('annotationsRoot')) ?? ''
    if (!annotationsRoot) return { error: 'Annotations folder not configured. Set it in Settings first.' }

    const res = await fetch(payload.downloadUrl, { redirect: 'follow' })
    if (!res.ok) return { error: `Failed to fetch guide content (${res.status})` }
    const content = await res.text()
    const safeName = toLocalGuideName(payload.title) || 'saved_guide'
    const filePath = `${annotationsRoot}\\${safeName}\\${safeName}.txt`
    const cleanContent = content.startsWith('﻿') ? content.slice(1) : content
    await invoke('write_text_file', { path: filePath, content: '﻿' + cleanContent })
    return { ok: true, filePath }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export const media = {
  async list(guideId: string, nodeId?: string): Promise<AnnotationMedia[]> {
    const token = await getSetting<string>('authToken')
    if (!token) return []
    const url = nodeId ? `${WEB_API}/guides/${guideId}/media?nodeId=${nodeId}` : `${WEB_API}/guides/${guideId}/media`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    return res.ok ? res.json() : []
  },
  async createLink(guideId: string, payload: CreateMediaPayload): Promise<AnnotationMedia> {
    const token = await getSetting<string>('authToken')
    if (!token) throw new Error('Not authenticated')
    const res = await fetch(`${WEB_API}/guides/${guideId}/media`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async createUpload(guideId: string, formData: FormData): Promise<AnnotationMedia> {
    const token = await getSetting<string>('authToken')
    if (!token) throw new Error('Not authenticated')
    const res = await fetch(`${WEB_API}/guides/${guideId}/media`, {
      method: 'POST',
      headers: await authHeaders(),
      body: formData,
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async update(guideId: string, mediaId: string, payload: UpdateMediaPayload): Promise<AnnotationMedia> {
    const token = await getSetting<string>('authToken')
    if (!token) throw new Error('Not authenticated')
    const res = await fetch(`${WEB_API}/guides/${guideId}/media/${mediaId}`, {
      method: 'PUT',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  async remove(guideId: string, mediaId: string): Promise<void> {
    const token = await getSetting<string>('authToken')
    if (!token) throw new Error('Not authenticated')
    await fetch(`${WEB_API}/guides/${guideId}/media/${mediaId}`, { method: 'DELETE', headers: await authHeaders() })
  },
}
