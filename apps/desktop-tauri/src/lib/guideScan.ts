import { invoke } from '@tauri-apps/api/core'

const KV3_HEADER_PREFIX = '<!-- kv3 encoding:text:version{'

export function fileIsAnnotation(content: string): boolean {
  const stripped = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  const firstLine = stripped.split('\n')[0]
  return firstLine.trimEnd().startsWith(KV3_HEADER_PREFIX)
}

export function readMapName(content: string): string | undefined {
  const stripped = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  const lines = stripped.split('\n').slice(0, 10)
  for (const line of lines) {
    const m = line.match(/MapName\s*=\s*"([^"]*)"/)
    if (m) return m[1] || undefined
  }
  return undefined
}

export interface FeaturedGuideRef {
  id: string
  name: string
}

export const FEATURED_GUIDES: FeaturedGuideRef[] = [
  { id: '3387810001', name: 'inferno_essential' },
  { id: '3387870747', name: 'ancient_essential' },
  { id: '3388581972', name: 'anubis_essential' },
  { id: '3388611848', name: 'overpass_essential' },
  { id: '3388638091', name: 'nuke_essential' },
  { id: '3388681214', name: 'dust2_essential' },
  { id: '3388737112', name: 'mirage_essential' },
  { id: '3388761697', name: 'vertigo_essential' },
]

export type GuideSource = 'local' | 'workshop'

export interface GuideItem {
  name: string
  path: string
  source: GuideSource
  mapName?: string
  workshopId?: string
  installed: boolean
}

async function tryReadTextFile(path: string): Promise<string | null> {
  try {
    return await invoke<string>('read_text_file', { path })
  } catch {
    return null
  }
}

export async function scanLocalGuides(annotationsRoot: string): Promise<GuideItem[]> {
  const guides: GuideItem[] = []
  if (!annotationsRoot || !(await invoke<boolean>('path_exists', { path: annotationsRoot }))) {
    return guides
  }
  const entries = await invoke<{ name: string; is_dir: boolean }[]>('list_dir', { path: annotationsRoot })
  for (const e of entries) {
    if (!e.is_dir) continue
    const txtPath = `${annotationsRoot}\\${e.name}\\${e.name}.txt`
    const content = await tryReadTextFile(txtPath)
    if (content === null) continue
    guides.push({
      name: e.name,
      path: txtPath,
      source: 'local',
      mapName: readMapName(content),
      installed: true,
    })
  }
  return guides
}

export async function scanFeaturedWorkshopGuides(workshopPath: string): Promise<GuideItem[]> {
  const guides: GuideItem[] = []
  for (const fg of FEATURED_GUIDES) {
    const folderPath = workshopPath ? `${workshopPath}\\${fg.id}` : ''
    const exists = folderPath && (await invoke<boolean>('path_exists', { path: folderPath }))
    if (!exists) {
      guides.push({ name: fg.name, path: '', source: 'workshop', workshopId: fg.id, installed: false })
      continue
    }
    const files = await invoke<{ name: string; is_dir: boolean }[]>('list_dir', { path: folderPath })
    let found = false
    for (const f of files) {
      if (f.is_dir || !f.name.toLowerCase().endsWith('.txt')) continue
      const fullPath = `${folderPath}\\${f.name}`
      const content = await tryReadTextFile(fullPath)
      if (content === null || !fileIsAnnotation(content)) continue
      guides.push({
        name: fg.name,
        path: fullPath,
        source: 'workshop',
        mapName: readMapName(content),
        workshopId: fg.id,
        installed: true,
      })
      found = true
      break
    }
    if (!found) {
      guides.push({ name: fg.name, path: '', source: 'workshop', workshopId: fg.id, installed: false })
    }
  }
  return guides
}

export async function scanUserWorkshopGuides(workshopPath: string): Promise<GuideItem[]> {
  const guides: GuideItem[] = []
  if (!workshopPath || !(await invoke<boolean>('path_exists', { path: workshopPath }))) return guides
  const featuredIds = new Set(FEATURED_GUIDES.map((g) => g.id))
  const dirs = await invoke<{ name: string; is_dir: boolean }[]>('list_dir', { path: workshopPath })
  for (const d of dirs) {
    if (!d.is_dir || featuredIds.has(d.name)) continue
    const folderPath = `${workshopPath}\\${d.name}`
    const files = await invoke<{ name: string; is_dir: boolean }[]>('list_dir', { path: folderPath })
    for (const f of files) {
      if (f.is_dir || !f.name.toLowerCase().endsWith('.txt')) continue
      const fullPath = `${folderPath}\\${f.name}`
      const content = await tryReadTextFile(fullPath)
      if (content === null || !fileIsAnnotation(content)) continue
      const baseName = f.name.replace(/\.txt$/i, '')
      guides.push({
        name: `${d.name} - ${baseName}`,
        path: fullPath,
        source: 'workshop',
        mapName: readMapName(content),
        workshopId: d.name,
        installed: true,
      })
      break
    }
  }
  return guides
}
