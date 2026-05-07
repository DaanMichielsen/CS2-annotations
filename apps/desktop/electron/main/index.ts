import { app, BrowserWindow, ipcMain, shell, clipboard, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce(fn: (...args: any[]) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null
  return (...args: unknown[]) => { if (t) clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

let currentFileWatcher: ReturnType<typeof fs.watch> | null = null
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
import Store from 'electron-store'
import { parseKv3Text, serializeKv3Text, kv3ToNodes, extractNodesKey, setNodesInRoot } from '@cs2ann/shared'
import type { Kv3Object, AnnotationNode } from '@cs2ann/shared'

// Register custom protocol for deep link auth callback
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('cs2ann', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('cs2ann')
}

// Ensure single instance (required for Windows deep links)
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

const store = new Store<{
  annotationsRoot: string
  workshopContentPath: string
  autoCopyLoadCommandsOnOpen: boolean
  authToken: string | null
  authName: string
  authAvatar: string
}>()

const CS2_SERVER_ANNOTATION_LINES = 'sv_cheats 1\nsv_allow_annotations_access_level 2'

const CS2_ANNOTATIONS_RELATIVE =
  'steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\annotations\\local'
const CS2_WORKSHOP_CONTENT_RELATIVE = 'steamapps\\workshop\\content\\730'

function getSteamPathFromRegistry(): Promise<string | null> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(null)
      return
    }
    try {
      execFile(
        'reg',
        ['query', 'HKEY_CURRENT_USER\\Software\\Valve\\Steam', '/v', 'SteamPath', '/t', 'REG_SZ'],
        { encoding: 'utf8' },
        (err: Error | null, stdout: string) => {
          if (err) {
            execFile(
              'reg',
              ['query', 'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam', '/v', 'InstallPath', '/t', 'REG_SZ'],
              { encoding: 'utf8' },
              (err2: Error | null, stdout2: string) => {
                if (err2) {
                  resolve(null)
                  return
                }
                const match = stdout2.match(/InstallPath\s+REG_SZ\s+(.+)/)
                resolve(match ? match[1].trim() : null)
              }
            )
            return
          }
          const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/)
          resolve(match ? match[1].trim() : null)
        }
      )
    } catch {
      resolve(null)
    }
  })
}

function deriveAnnotationsRoot(steamPath: string): string {
  return path.join(steamPath, CS2_ANNOTATIONS_RELATIVE)
}

function deriveWorkshopContentPath(steamPath: string): string {
  return path.join(steamPath, CS2_WORKSHOP_CONTENT_RELATIVE)
}

const KV3_HEADER_PREFIX = '<!-- kv3 encoding:text:version{'

const FEATURED_GUIDES: { id: string; name: string }[] = [
  { id: '3387810001', name: 'inferno_essential' },
  { id: '3387870747', name: 'ancient_essential' },
  { id: '3388581972', name: 'anubis_essential' },
  { id: '3388611848', name: 'overpass_essential' },
  { id: '3388638091', name: 'nuke_essential' },
  { id: '3388681214', name: 'dust2_essential' },
  { id: '3388737112', name: 'mirage_essential' },
  { id: '3388761697', name: 'vertigo_essential' },
]

function fileIsAnnotation(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(256)
    const bytesRead = fs.readSync(fd, buf, 0, 256, 0)
    fs.closeSync(fd)
    const firstLine = buf.slice(0, bytesRead).toString('utf-8').replace(/^﻿/, '').split('\n')[0]
    return firstLine.trimEnd().startsWith(KV3_HEADER_PREFIX)
  } catch { return false }
}

function readMapName(filePath: string): string | undefined {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').replace(/^﻿/, '')
    const lines = raw.split('\n').slice(0, 10)
    for (const line of lines) {
      const m = line.match(/MapName\s*=\s*"([^"]*)"/)
      if (m) return m[1] || undefined
    }
  } catch {}
  return undefined
}

let mainWindow: BrowserWindow | null = null

function handleDeepLink(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.pathname === '/callback') {
      const token = parsed.searchParams.get('token')
      const name = parsed.searchParams.get('name') ?? ''
      const avatar = parsed.searchParams.get('avatar') ?? ''
      if (token) {
        store.set('authToken', token)
        store.set('authName', name)
        store.set('authAvatar', avatar)
        mainWindow?.webContents.send('authStateChanged', { token, name, avatar })
      }
    }
  } catch { /* ignore malformed deep link URLs */ }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_VITE_DEV_SERVER_URL) {
    mainWindow!.loadURL(process.env.ELECTRON_VITE_DEV_SERVER_URL ?? 'http://localhost:5173')
    mainWindow!.webContents.openDevTools()
  } else {
    mainWindow!.loadFile(path.join(__dirname, '../../out/renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  // Deep link: macOS fires open-url
  app.on('open-url', (_event, url) => handleDeepLink(url))

  // Deep link: Windows fires second-instance with argv
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith('cs2ann://'))
    if (url) handleDeepLink(url)
    if (mainWindow) { mainWindow.show(); mainWindow.focus() }
  })

  // Auth IPC
  ipcMain.handle('getAuthState', () => ({
    token: store.get('authToken', null) as string | null,
    name: store.get('authName', '') as string,
    avatar: store.get('authAvatar', '') as string
  }))

  ipcMain.handle('signOut', () => {
    store.delete('authToken')
    store.delete('authName')
    store.delete('authAvatar')
  })

  ipcMain.handle('openSteamSignIn', () => {
    const webAppUrl = 'https://cs2annotations.com'
    shell.openExternal(`${webAppUrl}/auth/signin?callbackUrl=/auth/desktop-callback`)
  })

  // Write annotation_manager.cfg with server commands so F8 is ready (if path set)
  const annotationsRoot = store.get('annotationsRoot', '')
  if (annotationsRoot) {
    try {
      const cfgDir = path.resolve(path.join(annotationsRoot, '../../cfg'))
      if (fs.existsSync(cfgDir)) {
        const cfgFile = path.join(cfgDir, 'annotation_manager.cfg')
        fs.writeFileSync(cfgFile, CS2_SERVER_ANNOTATION_LINES + '\n', 'utf-8')
      }
    } catch { /* ignore */ }
  }

  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: 'A new version has been downloaded. Restart the app to apply the update.',
      buttons: ['Restart now', 'Later']
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('getAnnotationsRoot', (): string => {
  return store.get('annotationsRoot', '')
})

ipcMain.handle('setAnnotationsRoot', (_event, root: string): void => {
  store.set('annotationsRoot', root)
})

ipcMain.handle('getWorkshopContentPath', (): string => {
  return store.get('workshopContentPath', '')
})

ipcMain.handle('setWorkshopContentPath', (_event, p: string): void => {
  store.set('workshopContentPath', p)
})

ipcMain.handle('getAutoCopyLoadCommandsOnOpen', (): boolean => {
  return store.get('autoCopyLoadCommandsOnOpen', false)
})

ipcMain.handle('setAutoCopyLoadCommandsOnOpen', (_event, value: boolean): void => {
  store.set('autoCopyLoadCommandsOnOpen', value)
})

ipcMain.handle(
  'detectSteamPath',
  async (): Promise<
    | { path: string; annotationsRoot: string; workshopContentPath: string }
    | { error: string }
  > => {
    const steamPath = await getSteamPathFromRegistry()
    if (!steamPath) {
      const fallback = 'C:\\Program Files (x86)\\Steam'
      if (fs.existsSync(fallback)) {
        const annotationsRoot = deriveAnnotationsRoot(fallback)
        const workshopContentPath = deriveWorkshopContentPath(fallback)
        return { path: fallback, annotationsRoot, workshopContentPath }
      }
      return { error: 'Steam path not found in registry. Set the folders manually.' }
    }
    const annotationsRoot = deriveAnnotationsRoot(steamPath)
    const workshopContentPath = deriveWorkshopContentPath(steamPath)
    return { path: steamPath, annotationsRoot, workshopContentPath }
  }
)

function getAnnotationsRootPath(): string {
  const root = store.get('annotationsRoot', '')
  if (!root) throw new Error('Annotations folder not set. Set it in Settings.')
  return root
}

const UTF8_BOM = '\uFEFF'

function writeAnnotationFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, UTF8_BOM + content, 'utf-8')
}

function toLocalGuideName(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

type GuideSource = 'local' | 'workshop'

type GuideItem = {
  name: string
  path: string
  source: GuideSource
  mapName?: string
  workshopId?: string
  installed: boolean
}

ipcMain.handle(
  'listGuides',
  async (): Promise<GuideItem[]> => {
    const guides: GuideItem[] = []

    // ── Local guides ──────────────────────────────────────────────────────
    const annotationsRoot = store.get('annotationsRoot', '')
    if (annotationsRoot && fs.existsSync(annotationsRoot)) {
      const entries = fs.readdirSync(annotationsRoot, { withFileTypes: true })
      for (const e of entries) {
        if (!e.isDirectory()) continue
        const txtPath = path.join(annotationsRoot, e.name, `${e.name}.txt`)
        if (!fs.existsSync(txtPath)) continue
        guides.push({
          name: e.name,
          path: txtPath,
          source: 'local',
          mapName: readMapName(txtPath),
          installed: true,
        })
      }
    }

    // ── Workshop guides ───────────────────────────────────────────────────
    const workshopPath = store.get('workshopContentPath', '')

    // Featured registry — show all, mark uninstalled ones
    for (const fg of FEATURED_GUIDES) {
      const folderPath = workshopPath ? path.join(workshopPath, fg.id) : ''
      if (!folderPath || !fs.existsSync(folderPath)) {
        guides.push({ name: fg.name, path: '', source: 'workshop', workshopId: fg.id, installed: false })
        continue
      }
      let found = false
      try {
        const files = fs.readdirSync(folderPath, { withFileTypes: true })
        for (const f of files) {
          if (!f.isFile() || path.extname(f.name).toLowerCase() !== '.txt') continue
          const fullPath = path.join(folderPath, f.name)
          if (!fileIsAnnotation(fullPath)) continue
          guides.push({
            name: fg.name,
            path: fullPath,
            source: 'workshop',
            mapName: readMapName(fullPath),
            workshopId: fg.id,
            installed: true,
          })
          found = true
          break
        }
      } catch {}
      if (!found) {
        guides.push({ name: fg.name, path: '', source: 'workshop', workshopId: fg.id, installed: false })
      }
    }

    // Non-registry workshop items (user-downloaded guides not in FEATURED_GUIDES)
    if (workshopPath && fs.existsSync(workshopPath)) {
      const featuredIds = new Set(FEATURED_GUIDES.map((g) => g.id))
      const dirs = fs.readdirSync(workshopPath, { withFileTypes: true })
      for (const d of dirs) {
        if (!d.isDirectory() || featuredIds.has(d.name)) continue
        const folderPath = path.join(workshopPath, d.name)
        try {
          const files = fs.readdirSync(folderPath, { withFileTypes: true })
          for (const f of files) {
            if (!f.isFile() || path.extname(f.name).toLowerCase() !== '.txt') continue
            const fullPath = path.join(folderPath, f.name)
            if (!fileIsAnnotation(fullPath)) continue
            const baseName = path.basename(f.name, '.txt')
            guides.push({
              name: `${d.name} - ${baseName}`,
              path: fullPath,
              source: 'workshop',
              mapName: readMapName(fullPath),
              workshopId: d.name,
              installed: true,
            })
            break
          }
        } catch {}
      }
    }

    return guides
  }
)

ipcMain.handle(
  'loadGuide',
  async (
    _event,
    filePath: string
  ): Promise<
    | { nodes: AnnotationNode[]; nodesKey: string; root: Kv3Object }
    | { error: string }
  > => {
    try {
      if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` }
      let raw = fs.readFileSync(filePath, 'utf-8')
      const hadBom = raw.charCodeAt(0) === 0xfeff
      if (hadBom) raw = raw.slice(1)
      // KV3 header is required for CS2 to load the file
      const hasKv3Header = raw.trimStart().startsWith('<!--')
      const root = parseKv3Text(raw) as Kv3Object
      const nodesKey = extractNodesKey(root)
      const nodes = kv3ToNodes(root, nodesKey)
      // Rewrite whenever either the BOM or the KV3 header is missing.
      // This auto-fixes: workshop files (no BOM, no header) and files created
      // by older versions of this app (had BOM but no header).
      if (!hadBom || !hasKv3Header) {
        writeAnnotationFile(filePath, serializeKv3Text(root))
      }
      return { nodes, nodesKey, root }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }
)

ipcMain.handle(
  'createGuide',
  async (_event, filename: string, mapName?: string): Promise<{ error?: string; loadName?: string }> => {
    try {
      const rootPath = getAnnotationsRootPath()
      const safeName = toLocalGuideName(filename)
      if (!safeName) return { error: 'Invalid guide name. Use letters, numbers, underscores or hyphens (no spaces).' }
      const dirPath = path.join(rootPath, safeName)
      const filePath = path.join(dirPath, `${safeName}.txt`)
      if (fs.existsSync(filePath)) return { error: `Guide "${safeName}" already exists.` }
      fs.mkdirSync(dirPath, { recursive: true })
      const root: Kv3Object = { MapName: mapName ?? '', ScreenText: {}, Nodes: [] }
      const out = serializeKv3Text(root)
      writeAnnotationFile(filePath, out)
      return { loadName: safeName }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }
)

ipcMain.handle(
  'saveGuide',
  async (
    _event,
    payload: { filePath: string; root: Kv3Object; nodes: AnnotationNode[]; nodesKey: string; createBackup?: boolean }
  ): Promise<{ error?: string }> => {
    try {
      const filePath = payload.filePath
      const dirPath = path.dirname(filePath)
      if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
      if (payload.createBackup !== false && fs.existsSync(filePath)) {
        const bakPath = filePath + '.bak'
        fs.copyFileSync(filePath, bakPath)
      }
      setNodesInRoot(payload.root, payload.nodes, payload.nodesKey)
      const out = serializeKv3Text(payload.root)
      writeAnnotationFile(filePath, out)
      return {}
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }
)

ipcMain.handle(
  'saveAsLocalGuide',
  async (
    _event,
    payload: { root: Kv3Object; nodes: AnnotationNode[]; nodesKey: string; localName: string }
  ): Promise<{ error?: string; path?: string; loadName?: string }> => {
    try {
      const rootPath = getAnnotationsRootPath()
      const safeName = toLocalGuideName(payload.localName)
      if (!safeName) return { error: 'Invalid guide name. Use letters, numbers, underscores or hyphens (no spaces).' }
      const dirPath = path.join(rootPath, safeName)
      const filePath = path.join(dirPath, `${safeName}.txt`)
      if (fs.existsSync(filePath)) return { error: `A local guide named "${safeName}" already exists.` }
      fs.mkdirSync(dirPath, { recursive: true })
      setNodesInRoot(payload.root, payload.nodes, payload.nodesKey)
      const out = serializeKv3Text(payload.root)
      writeAnnotationFile(filePath, out)
      return { path: filePath, loadName: safeName }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }
)

ipcMain.handle(
  'deleteGuide',
  async (_event, filePath: string): Promise<{ error?: string }> => {
    try {
      const annotationsRoot = store.get('annotationsRoot', '')
      if (!annotationsRoot) return { error: 'Annotations folder not set.' }
      const rootAbs = path.resolve(annotationsRoot)
      const fileAbs = path.resolve(filePath)
      const relative = path.relative(rootAbs, fileAbs)
      if (relative.startsWith('..') || path.isAbsolute(relative))
        return { error: 'Can only delete local annotation files from the configured annotations folder.' }
      if (!fs.existsSync(fileAbs)) return { error: 'File not found.' }
      fs.unlinkSync(fileAbs)
      const dirPath = path.dirname(fileAbs)
      if (fs.existsSync(dirPath)) {
        const remaining = fs.readdirSync(dirPath)
        if (remaining.length === 0) fs.rmdirSync(dirPath)
      }
      return {}
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }
)

ipcMain.handle(
  'appendNodesToGuide',
  async (
    _event,
    payload: { targetFilePath: string; nodes: AnnotationNode[] }
  ): Promise<{ error?: string; finalNodeCount?: number }> => {
    try {
      const { targetFilePath, nodes: newNodes } = payload
      if (!fs.existsSync(targetFilePath))
        return { error: `File not found: ${targetFilePath}` }

      const bakPath = targetFilePath + '.bak'
      fs.copyFileSync(targetFilePath, bakPath)

      let raw = fs.readFileSync(targetFilePath, 'utf-8')
      if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)
      const root = parseKv3Text(raw) as Kv3Object
      const nodesKey = extractNodesKey(root)
      const existingNodes = kv3ToNodes(root, nodesKey)

      const merged = [...existingNodes, ...newNodes]
      setNodesInRoot(root, merged, nodesKey)
      const out = serializeKv3Text(root)
      writeAnnotationFile(targetFilePath, out)

      try {
        let written = fs.readFileSync(targetFilePath, 'utf-8')
        if (written.charCodeAt(0) === 0xfeff) written = written.slice(1)
        parseKv3Text(written)
      } catch {
        fs.copyFileSync(bakPath, targetFilePath)
        return {
          error:
            'Copy failed: file could not be validated after write. The original file has been restored.',
        }
      }

      fs.unlinkSync(bakPath)
      return { finalNodeCount: merged.length }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }
)

ipcMain.handle(
  'createGuideWithNodes',
  async (
    _event,
    payload: { filename: string; mapName: string; nodes: AnnotationNode[] }
  ): Promise<{ error?: string; loadName?: string; filePath?: string }> => {
    try {
      const rootPath = getAnnotationsRootPath()
      const safeName = toLocalGuideName(payload.filename)
      if (!safeName)
        return {
          error: 'Invalid guide name. Use letters, numbers, underscores or hyphens.',
        }
      const dirPath = path.join(rootPath, safeName)
      const filePath = path.join(dirPath, `${safeName}.txt`)
      if (fs.existsSync(filePath))
        return { error: `Guide "${safeName}" already exists.` }

      const dirCreatedByUs = !fs.existsSync(dirPath)
      fs.mkdirSync(dirPath, { recursive: true })
      const root: Kv3Object = { MapName: payload.mapName, ScreenText: {}, Nodes: [] }
      setNodesInRoot(root, payload.nodes, 'Nodes')
      const out = serializeKv3Text(root)
      writeAnnotationFile(filePath, out)

      try {
        let written = fs.readFileSync(filePath, 'utf-8')
        if (written.charCodeAt(0) === 0xfeff) written = written.slice(1)
        parseKv3Text(written)
      } catch {
        try {
          fs.unlinkSync(filePath)
          if (dirCreatedByUs) fs.rmdirSync(dirPath)
        } catch {}
        return {
          error: 'Create failed: file could not be validated after write.',
        }
      }

      return { loadName: safeName, filePath }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }
)

// ── File watcher ────────────────────────────────────────────────────────────
ipcMain.on('watchGuideFile', (_event, filePath: string) => {
  if (currentFileWatcher) { currentFileWatcher.close(); currentFileWatcher = null }
  if (!filePath) return
  const notify = debounce(() => {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('guideFileChanged', filePath))
  }, 400)
  try { currentFileWatcher = fs.watch(filePath, () => notify()) } catch { /* ignore */ }
})

ipcMain.on('unwatchGuideFile', () => {
  if (currentFileWatcher) { currentFileWatcher.close(); currentFileWatcher = null }
})

const CS2_APP_ID = '730'
const CS2_WINDOW_TITLE = 'Counter-Strike 2'

ipcMain.handle('writeCS2Cfg', async (_event, command: string): Promise<{ error?: string; cfgPath?: string }> => {
  try {
    const annotationsRoot = store.get('annotationsRoot', '')
    if (!annotationsRoot) return { error: 'Annotations folder not configured in Settings.' }
    const cfgDir = path.resolve(path.join(annotationsRoot, '../../cfg'))
    if (!fs.existsSync(cfgDir)) return { error: `CS2 cfg folder not found at: ${cfgDir}` }
    const cfgFile = path.join(cfgDir, 'annotation_manager.cfg')
    fs.writeFileSync(cfgFile, command + '\n', 'utf-8')
    clipboard.writeText(command)
    return { cfgPath: cfgFile, content: command }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('showItemInFolder', (_event, filePath: string): void => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('launchCS2', async (): Promise<{ error?: string }> => {
  try {
    await shell.openExternal(`steam://run/${CS2_APP_ID}`)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ── Cloud sync ──────────────────────────────────────────────────────────────

const WEB_API = 'https://cs2annotations.com/api'

function cloudHeaders(): Record<string, string> {
  const token = store.get('authToken', null) as string | null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

ipcMain.handle('cloudListGuides', async () => {
  try {
    const res = await fetch(`${WEB_API}/guides`, { headers: cloudHeaders() })
    if (!res.ok) return { error: 'Request failed' }
    return res.json()
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('cloudPushGuide', async (_event, payload: {
  filePath: string; title: string; map: string; nodeCount?: number; cloudId?: string; cloudVersion?: number
}) => {
  try {
    const content = fs.readFileSync(payload.filePath, 'utf-8')
    const form = new FormData()
    form.set('title', payload.title)
    form.set('map', payload.map)
    form.set('nodeCount', String(payload.nodeCount ?? 0))
    form.set('file', new Blob([content], { type: 'text/plain' }), 'guide.kv3')

    if (payload.cloudId) {
      form.set('version', String(payload.cloudVersion ?? 1))
      const res = await fetch(`${WEB_API}/guides/${payload.cloudId}`, {
        method: 'PUT', headers: cloudHeaders(), body: form,
      })
      if (res.status === 409) {
        const data = await res.json()
        return { conflict: true, cloudVersion: data.cloudVersion }
      }
      if (!res.ok) return { error: 'Push failed' }
      const { guide } = await res.json()
      store.set(`cloudVersion:${payload.filePath}`, guide.version)
      store.set(`cloudId:${payload.filePath}`, guide.id)
      return { guide }
    } else {
      const res = await fetch(`${WEB_API}/guides`, {
        method: 'POST', headers: cloudHeaders(), body: form,
      })
      if (!res.ok) return { error: 'Push failed' }
      const { guide } = await res.json()
      store.set(`cloudVersion:${payload.filePath}`, guide.version)
      store.set(`cloudId:${payload.filePath}`, guide.id)
      return { guide }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('cloudPullGuide', async (_event, payload: { cloudId: string; filePath: string }) => {
  try {
    const res = await fetch(`${WEB_API}/guides/${payload.cloudId}`, { headers: cloudHeaders() })
    if (!res.ok) return { error: 'Pull failed' }
    const { guide, downloadUrl } = await res.json()

    const kv3Res = await fetch(downloadUrl)
    const kv3Content = await kv3Res.text()

    if (fs.existsSync(payload.filePath)) {
      fs.copyFileSync(payload.filePath, payload.filePath + '.bak')
    }
    fs.writeFileSync(payload.filePath, kv3Content, 'utf-8')
    store.set(`cloudVersion:${payload.filePath}`, guide.version)
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('cloudGetSyncState', async (_event, filePath: string) => {
  const cloudId = store.get(`cloudId:${filePath}`, null) as string | null
  const localVersion = store.get(`cloudVersion:${filePath}`, 0) as number
  if (!cloudId) return { synced: false }
  try {
    const res = await fetch(`${WEB_API}/guides/${cloudId}`, { headers: cloudHeaders() })
    if (!res.ok) return { synced: false, cloudId, localVersion }
    const { guide } = await res.json()
    return { synced: true, cloudId, localVersion, cloudVersion: guide.version, behind: guide.version > localVersion }
  } catch {
    return { synced: false, cloudId, localVersion }
  }
})

ipcMain.handle('openCommunity', () => {
  shell.openExternal('https://cs2annotations.com/guides')
})

// ── CS2 console ─────────────────────────────────────────────────────────────

ipcMain.handle(
  'sendCS2ConsoleCommand',
  async (_event, command: string): Promise<{ error?: string }> => {
    if (process.platform !== 'win32') {
      return { error: 'Run in CS2 is only supported on Windows.' }
    }
    try {
      const { Hardware } = require('keysender') as { Hardware: new (title: string | null, className?: string | null) => { workwindow: { isOpen: () => boolean; refresh: () => boolean }; keyboard: { sendKey: (key: string | string[], delay?: number) => Promise<void>; printText: (text: string, delay?: number) => Promise<void> } } }
      const cs2 = new Hardware(CS2_WINDOW_TITLE)
      if (!cs2.workwindow.isOpen() && !cs2.workwindow.refresh()) {
        return { error: 'Counter-Strike 2 window not found. Start the game first.' }
      }
      await cs2.keyboard.sendKey('`', 80)
      await new Promise((r) => setTimeout(r, 100))
      await cs2.keyboard.printText(command, 30)
      await cs2.keyboard.sendKey('enter', 80)
      return {}
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
        return { error: 'Run in CS2 requires the "keysender" package (Windows). Install it with: npm install keysender. Then use Copy command and paste in the game console.' }
      }
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }
)
