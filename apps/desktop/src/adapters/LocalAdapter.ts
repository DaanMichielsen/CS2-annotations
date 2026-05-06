import type {
  AppendNodesPayload,
  CreateGuidePayload,
  GuideAdapter,
  GuideSummary,
  LoadedGuide,
  SaveGuidePayload,
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
  }
}
