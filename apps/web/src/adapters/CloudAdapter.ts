import type {
  GuideAdapter,
  GuideSummary,
  LoadedGuide,
  SaveGuidePayload,
  AppendNodesPayload,
  CreateGuidePayload,
  Kv3Object,
} from '@cs2ann/shared/web'
import { serializeKv3Text, parseKv3Text, kv3ToNodes, extractNodesKey, setNodesInRoot, isKv3Object } from '@cs2ann/shared/web'

// In-memory version cache so saveGuide can send the correct version for optimistic locking
const versionCache = new Map<string, number>()

export function createCloudAdapter(): GuideAdapter {
  return {
    async listGuides(): Promise<GuideSummary[]> {
      const res = await fetch('/api/guides')
      if (!res.ok) throw new Error('Failed to list guides')
      const { guides } = await res.json()
      return guides.map((g: { id: string; title: string; map?: string }) => ({
        id: g.id,
        name: g.title,
        mapName: g.map,
        source: 'cloud' as const,
      }))
    },

    async createGuide(payload: CreateGuidePayload) {
      let kv3 = ''
      if (payload.nodes && payload.root && payload.nodesKey) {
        const root = payload.root as Kv3Object
        setNodesInRoot(root, payload.nodes, payload.nodesKey)
        kv3 = serializeKv3Text(root)
      }
      const form = new FormData()
      form.set('title', payload.filename)
      form.set('map', payload.mapName ?? '')
      form.set('nodeCount', String(payload.nodes?.length ?? 0))
      form.set('file', new Blob([kv3], { type: 'text/plain' }), 'guide.kv3')

      const res = await fetch('/api/guides', { method: 'POST', body: form })
      if (!res.ok) return { error: 'Failed to create guide' }
      const { guide } = await res.json()
      return { id: guide.id }
    },

    async loadGuide(id: string): Promise<LoadedGuide | { error: string }> {
      const res = await fetch(`/api/guides/${id}`)
      if (!res.ok) return { error: 'Failed to load guide' }
      const { guide, downloadUrl } = await res.json()
      versionCache.set(id, guide.version)
      const kv3Res = await fetch(downloadUrl)
      const kv3Text = await kv3Res.text()
      const root = parseKv3Text(kv3Text)
      if (!isKv3Object(root)) return { error: 'Failed to parse guide file' }
      const nodesKey = extractNodesKey(root)
      const nodes = kv3ToNodes(root, nodesKey)
      return { nodes, nodesKey, root }
    },

    async saveGuide(payload: SaveGuidePayload) {
      const root = payload.root as Kv3Object
      setNodesInRoot(root, payload.nodes, payload.nodesKey)
      const kv3 = serializeKv3Text(root)
      const currentVersion = versionCache.get(payload.id) ?? 1
      const form = new FormData()
      form.set('version', String(currentVersion))
      form.set('nodeCount', String(payload.nodes.length))
      form.set('file', new Blob([kv3], { type: 'text/plain' }), 'guide.kv3')

      const res = await fetch(`/api/guides/${payload.id}`, { method: 'PUT', body: form })
      if (res.status === 409) {
        const { cloudVersion } = await res.json()
        return { error: `VERSION_CONFLICT:${cloudVersion}` }
      }
      if (!res.ok) return { error: 'Failed to save guide' }
      const { guide } = await res.json()
      versionCache.set(payload.id, guide.version)
      return {}
    },

    async saveAsLocal() {
      return { error: 'saveAsLocal not supported in browser' }
    },

    async deleteGuide(id: string) {
      const res = await fetch(`/api/guides/${id}`, { method: 'DELETE' })
      if (!res.ok) return { error: 'Failed to delete' }
      return {}
    },

    async appendNodes(_payload: AppendNodesPayload) {
      return { error: 'Not yet implemented' }
    },
  }
}
