import type {
  AppendNodesPayload,
  CreateGuidePayload,
  CreateMediaPayload,
  GuideAdapter,
  GuideSummary,
  LoadedGuide,
  SaveGuidePayload,
  UpdateMediaPayload,
} from '@cs2ann/shared'

export function createLocalAdapter(): GuideAdapter {
  return {
    async listGuides(): Promise<GuideSummary[]> {
      const raw = await window.electronAPI.listGuides()
      return raw.map((g) => ({
        id: g.path,
        name: g.name,
        mapName: g.mapName,
        source: g.source,
        installed: g.installed,
        workshopId: g.workshopId,
      }))
    },

    async createGuide(payload: CreateGuidePayload) {
      if (payload.nodes && payload.nodesKey && payload.root) {
        const result = await window.electronAPI.createGuideWithNodes({
          filename: payload.filename,
          mapName: payload.mapName ?? '',
          nodes: payload.nodes,
        })
        return { error: result.error, id: result.filePath, loadName: result.loadName }
      }
      const result = await window.electronAPI.createGuide(payload.filename, payload.mapName)
      return { error: result.error, loadName: result.loadName }
    },

    async loadGuide(id: string): Promise<LoadedGuide | { error: string }> {
      return window.electronAPI.loadGuide(id)
    },

    async saveGuide(payload: SaveGuidePayload) {
      return window.electronAPI.saveGuide({
        filePath: payload.id,
        root: payload.root,
        nodes: payload.nodes,
        nodesKey: payload.nodesKey,
        createBackup: payload.createBackup,
      })
    },

    async saveAsLocal(payload) {
      const result = await window.electronAPI.saveAsLocalGuide(payload)
      return { error: result.error, id: result.path, loadName: result.loadName }
    },

    async deleteGuide(id: string) {
      return window.electronAPI.deleteGuide(id)
    },

    async appendNodes(payload: AppendNodesPayload) {
      return window.electronAPI.appendNodesToGuide({
        targetFilePath: payload.targetId,
        nodes: payload.nodes,
      })
    },

    async getAnnotationsRoot() {
      return window.electronAPI.getAnnotationsRoot()
    },
    async getWorkshopContentPath() {
      return window.electronAPI.getWorkshopContentPath()
    },
    async getAutoCopyLoadCommandsOnOpen() {
      return window.electronAPI.getAutoCopyLoadCommandsOnOpen()
    },
    async setAnnotationsRoot(root: string) {
      await window.electronAPI.setAnnotationsRoot(root)
    },
    async setWorkshopContentPath(path: string) {
      await window.electronAPI.setWorkshopContentPath(path)
    },
    async setAutoCopyLoadCommandsOnOpen(value: boolean) {
      await window.electronAPI.setAutoCopyLoadCommandsOnOpen(value)
    },
    async getCfgKeybind() {
      return window.electronAPI.getCfgKeybind()
    },
    async setCfgKeybind(key: string) {
      await window.electronAPI.setCfgKeybind(key)
    },
    async detectSteamPath() {
      return window.electronAPI.detectSteamPath()
    },
    async launchCS2() {
      return window.electronAPI.launchCS2()
    },

    cs2: {
      async writeCommand(command: string) {
        return window.electronAPI.writeCS2Cfg(command)
      },
      async sendConsoleCommand(command: string) {
        return window.electronAPI.sendCS2ConsoleCommand(command)
      },
      watchFile(filePath: string) {
        window.electronAPI.watchGuideFile(filePath)
      },
      unwatchFile() {
        window.electronAPI.unwatchGuideFile()
      },
      onFileChanged(callback: (filePath: string) => void) {
        return window.electronAPI.onGuideFileChanged(callback)
      },
    },

    clipboard: {
      async write(text: string) {
        return window.electronAPI.copyToClipboard(text)
      },
      async showInFolder(path: string) {
        return window.electronAPI.showItemInFolder(path)
      },
    },

    media: {
      async list(guideId: string, nodeId?: string) {
        return window.electronAPI.mediaList(guideId, nodeId)
      },
      async createLink(guideId: string, payload: CreateMediaPayload) {
        return window.electronAPI.mediaCreateLink(guideId, payload)
      },
      async createUpload(guideId: string, formData: FormData) {
        const entries: [string, unknown][] = []
        for (const [key, val] of formData.entries()) {
          if (val instanceof File) {
            const buf = await val.arrayBuffer()
            entries.push([key, new Uint8Array(buf)])
          } else {
            entries.push([key, val])
          }
        }
        return window.electronAPI.mediaCreateUpload(guideId, entries)
      },
      async update(guideId: string, mediaId: string, payload: UpdateMediaPayload) {
        return window.electronAPI.mediaUpdate(guideId, mediaId, payload)
      },
      async remove(guideId: string, mediaId: string) {
        return window.electronAPI.mediaRemove(guideId, mediaId)
      },
    },

    async cloudPushGuide(payload) {
      return window.electronAPI.cloudPushGuide(payload)
    },
    async cloudPullGuide(payload) {
      return window.electronAPI.cloudPullGuide(payload)
    },
    async cloudGetSyncState(filePath: string) {
      return window.electronAPI.cloudGetSyncState(filePath)
    },
    async cloudDeleteGuide(cloudId: string) {
      return window.electronAPI.cloudDeleteGuide(cloudId)
    },
    async getAuthState() {
      return window.electronAPI.getAuthState()
    },
  }
}
