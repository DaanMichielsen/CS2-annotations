import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { open } from '@tauri-apps/plugin-shell'
import {
  parseKv3Text,
  serializeKv3Text,
  kv3ToNodes,
  extractNodesKey,
  setNodesInRoot,
} from '@cs2ann/shared'
import type {
  AnnotationNode,
  AppendNodesPayload,
  CreateGuidePayload,
  GuideAdapter,
  GuideSummary,
  Kv3Object,
  LoadedGuide,
  SaveGuidePayload,
} from '@cs2ann/shared'
import { toLocalGuideName } from '../lib/guideNaming'
import { scanLocalGuides, scanFeaturedWorkshopGuides, scanUserWorkshopGuides } from '../lib/guideScan'
import { getSetting, setSetting, deleteSetting } from '../lib/settingsStore'

const UTF8_BOM = '﻿'

function stripBom(raw: string): string {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
}

async function writeAnnotationFile(filePath: string, content: string): Promise<void> {
  await invoke('write_text_file', { path: filePath, content: UTF8_BOM + content })
}

async function getAnnotationsRootOrThrow(): Promise<string> {
  const root = (await getSetting<string>('annotationsRoot')) ?? ''
  if (!root) throw new Error('Annotations folder not set. Set it in Settings.')
  return root
}

/**
 * Returns true only if `candidate` is `root` itself or a path nested inside
 * it. Both inputs are normalized (lowercased, `/` collapsed to `\`, trailing
 * backslashes stripped) before comparison so this can't be fooled by a
 * sibling directory whose name merely starts with the same characters as
 * `root` (e.g. `C:\annotations-other\foo.txt` vs root `C:\annotations`).
 */
export function isInsideRoot(root: string, candidate: string): boolean {
  const normalize = (p: string): string => {
    let n = p.toLowerCase().replace(/\//g, '\\')
    while (n.endsWith('\\')) n = n.slice(0, -1)
    return n
  }
  const normalizedRoot = normalize(root)
  const normalizedCandidate = normalize(candidate)
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}\\`)
  )
}

export function createTauriAdapter(): GuideAdapter {
  return {
    async listGuides(): Promise<GuideSummary[]> {
      const annotationsRoot = (await getSetting<string>('annotationsRoot')) ?? ''
      const workshopContentPath = (await getSetting<string>('workshopContentPath')) ?? ''

      const [local, featured, userWorkshop] = await Promise.all([
        scanLocalGuides(annotationsRoot),
        scanFeaturedWorkshopGuides(workshopContentPath),
        scanUserWorkshopGuides(workshopContentPath),
      ])

      return [...local, ...featured, ...userWorkshop].map((g) => ({
        id: g.path,
        name: g.name,
        mapName: g.mapName,
        source: g.source,
        installed: g.installed,
        workshopId: g.workshopId,
      }))
    },

    async createGuide(payload: CreateGuidePayload) {
      const rootPath = await getAnnotationsRootOrThrow()
      const safeName = toLocalGuideName(payload.filename)
      if (!safeName) {
        return { error: 'Invalid guide name. Use letters, numbers, underscores or hyphens (no spaces).' }
      }
      const dirPath = `${rootPath}\\${safeName}`
      const filePath = `${dirPath}\\${safeName}.txt`
      if (await invoke<boolean>('path_exists', { path: filePath })) {
        return { error: `Guide "${safeName}" already exists.` }
      }

      const root: Kv3Object = { MapName: payload.mapName ?? '', ScreenText: {}, Nodes: [] }
      if (payload.nodes && payload.nodesKey) {
        setNodesInRoot(root, payload.nodes, payload.nodesKey)
      }
      await writeAnnotationFile(filePath, serializeKv3Text(root))
      return { loadName: safeName, id: filePath }
    },

    async loadGuide(id: string): Promise<LoadedGuide | { error: string }> {
      try {
        if (!(await invoke<boolean>('path_exists', { path: id }))) {
          return { error: `File not found: ${id}` }
        }
        const raw = await invoke<string>('read_text_file', { path: id })
        const hadBom = raw.charCodeAt(0) === 0xfeff
        const content = stripBom(raw)
        const hasKv3Header = content.trimStart().startsWith('<!--')
        const root = parseKv3Text(content) as Kv3Object
        const nodesKey = extractNodesKey(root)
        const nodes = kv3ToNodes(root, nodesKey)

        if (!hadBom || !hasKv3Header) {
          await writeAnnotationFile(id, serializeKv3Text(root))
        }
        return { nodes, nodesKey, root }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },

    async saveGuide(payload: SaveGuidePayload) {
      try {
        if (payload.createBackup !== false && (await invoke<boolean>('path_exists', { path: payload.id }))) {
          await invoke('copy_file', { from: payload.id, to: `${payload.id}.bak` })
        }
        const root = payload.root as Kv3Object
        setNodesInRoot(root, payload.nodes, payload.nodesKey)
        await writeAnnotationFile(payload.id, serializeKv3Text(root))
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },

    async saveAsLocal(payload) {
      try {
        const rootPath = await getAnnotationsRootOrThrow()
        const safeName = toLocalGuideName(payload.localName)
        if (!safeName) {
          return { error: 'Invalid guide name. Use letters, numbers, underscores or hyphens (no spaces).' }
        }
        const filePath = `${rootPath}\\${safeName}\\${safeName}.txt`
        if (await invoke<boolean>('path_exists', { path: filePath })) {
          return { error: `A local guide named "${safeName}" already exists.` }
        }
        const root = payload.root as Kv3Object
        setNodesInRoot(root, payload.nodes, payload.nodesKey)
        await writeAnnotationFile(filePath, serializeKv3Text(root))
        return { id: filePath, loadName: safeName }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },

    async deleteGuide(id: string) {
      try {
        const annotationsRoot = (await getSetting<string>('annotationsRoot')) ?? ''
        if (!annotationsRoot) return { error: 'Annotations folder not set.' }
        if (!isInsideRoot(annotationsRoot, id)) {
          return { error: 'Can only delete local annotation files from the configured annotations folder.' }
        }
        if (!(await invoke<boolean>('path_exists', { path: id }))) return { error: 'File not found.' }
        await invoke('unwatch_file')
        await invoke('delete_file', { path: id })
        const lastSlash = id.lastIndexOf('\\')
        if (lastSlash > 0) {
          const dirPath = id.slice(0, lastSlash)
          await invoke('delete_dir_if_empty', { path: dirPath })
        }
        await deleteSetting(`cloudId:${id}`)
        await deleteSetting(`cloudVersion:${id}`)
        await deleteSetting(`lastPushed:${id}`)
        await deleteSetting(`cloudAuthorId:${id}`)
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },

    async appendNodes(payload: AppendNodesPayload) {
      try {
        const targetFilePath = payload.targetId
        if (!(await invoke<boolean>('path_exists', { path: targetFilePath }))) {
          return { error: `File not found: ${targetFilePath}` }
        }
        const bakPath = `${targetFilePath}.bak`
        await invoke('copy_file', { from: targetFilePath, to: bakPath })

        const raw = stripBom(await invoke<string>('read_text_file', { path: targetFilePath }))
        const root = parseKv3Text(raw) as Kv3Object
        const nodesKey = extractNodesKey(root)
        const existingNodes = kv3ToNodes(root, nodesKey)
        const merged: AnnotationNode[] = [...existingNodes, ...payload.nodes]
        setNodesInRoot(root, merged, nodesKey)
        await writeAnnotationFile(targetFilePath, serializeKv3Text(root))

        try {
          const written = stripBom(await invoke<string>('read_text_file', { path: targetFilePath }))
          parseKv3Text(written)
        } catch {
          await invoke('copy_file', { from: bakPath, to: targetFilePath })
          return { error: 'Copy failed: file could not be validated after write. The original file has been restored.' }
        }

        await invoke('delete_file', { path: bakPath })
        return { finalNodeCount: merged.length }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },

    async getAnnotationsRoot() {
      return (await getSetting<string>('annotationsRoot')) ?? ''
    },

    async setAnnotationsRoot(root: string) {
      await setSetting('annotationsRoot', root)
    },

    async getWorkshopContentPath() {
      return (await getSetting<string>('workshopContentPath')) ?? ''
    },

    async setWorkshopContentPath(path: string) {
      await setSetting('workshopContentPath', path)
    },

    async getAutoCopyLoadCommandsOnOpen() {
      return (await getSetting<boolean>('autoCopyLoadCommandsOnOpen')) ?? false
    },

    async setAutoCopyLoadCommandsOnOpen(value: boolean) {
      await setSetting('autoCopyLoadCommandsOnOpen', value)
    },

    async getCfgKeybind() {
      return (await getSetting<string>('cfgKeybind')) ?? 'f8'
    },

    async setCfgKeybind(key: string) {
      await setSetting('cfgKeybind', key)
    },

    async detectSteamPath() {
      return invoke<
        | { path: string; annotationsRoot: string; workshopContentPath: string }
        | { error: string }
      >('detect_steam_path')
    },

    async launchCS2() {
      try {
        await open('steam://run/730')
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },

    cs2: {
      async writeCommand(command: string) {
        const annotationsRoot = (await getSetting<string>('annotationsRoot')) ?? ''
        try {
          const result = await invoke<{ cfgPath: string; content: string }>('write_cs2_cfg', {
            annotationsRoot,
            command,
          })
          await writeText(command)
          return result
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) }
        }
      },
      watchFile(filePath: string) {
        void invoke('watch_file', { path: filePath })
      },
      unwatchFile() {
        void invoke('unwatch_file')
      },
      onFileChanged(callback: (filePath: string) => void) {
        let unlisten: (() => void) | undefined
        void listen<string>('guide-file-changed', (event) => callback(event.payload)).then((fn) => {
          unlisten = fn
        })
        return () => unlisten?.()
      },
    },

    clipboard: {
      async write(text: string) {
        try {
          await writeText(text)
          return {}
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) }
        }
      },
      async showInFolder(path: string) {
        await revealItemInDir(path)
      },
    },
  }
}
