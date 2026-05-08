import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getAnnotationsRoot: () => ipcRenderer.invoke('getAnnotationsRoot'),
  setAnnotationsRoot: (root: string) => ipcRenderer.invoke('setAnnotationsRoot', root),
  getWorkshopContentPath: () => ipcRenderer.invoke('getWorkshopContentPath'),
  setWorkshopContentPath: (p: string) => ipcRenderer.invoke('setWorkshopContentPath', p),
  getAutoCopyLoadCommandsOnOpen: () => ipcRenderer.invoke('getAutoCopyLoadCommandsOnOpen'),
  setAutoCopyLoadCommandsOnOpen: (value: boolean) => ipcRenderer.invoke('setAutoCopyLoadCommandsOnOpen', value),
  detectSteamPath: () => ipcRenderer.invoke('detectSteamPath'),
  listGuides: () => ipcRenderer.invoke('listGuides'),
  loadGuide: (filePath: string) => ipcRenderer.invoke('loadGuide', filePath),
  createGuide: (filename: string, mapName?: string) => ipcRenderer.invoke('createGuide', filename, mapName),
  saveGuide: (payload: {
    filePath: string
    root: unknown
    nodes: unknown[]
    nodesKey: string
    createBackup?: boolean
  }) => ipcRenderer.invoke('saveGuide', payload),
  saveAsLocalGuide: (payload: {
    root: unknown
    nodes: unknown[]
    nodesKey: string
    localName: string
  }) => ipcRenderer.invoke('saveAsLocalGuide', payload),
  deleteGuide: (filePath: string) => ipcRenderer.invoke('deleteGuide', filePath),
  appendNodesToGuide: (payload: { targetFilePath: string; nodes: unknown[] }) =>
    ipcRenderer.invoke('appendNodesToGuide', payload),
  createGuideWithNodes: (payload: { filename: string; mapName: string; nodes: unknown[] }) =>
    ipcRenderer.invoke('createGuideWithNodes', payload),
  sendCS2ConsoleCommand: (command: string) => ipcRenderer.invoke('sendCS2ConsoleCommand', command),
  writeCS2Cfg: (command: string) => ipcRenderer.invoke('writeCS2Cfg', command),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('showItemInFolder', filePath),
  launchCS2: () => ipcRenderer.invoke('launchCS2'),
  watchGuideFile: (filePath: string) => ipcRenderer.send('watchGuideFile', filePath),
  unwatchGuideFile: () => ipcRenderer.send('unwatchGuideFile'),
  onGuideFileChanged: (callback: (filePath: string) => void) => {
    const handler = (_: unknown, fp: string) => callback(fp)
    ipcRenderer.on('guideFileChanged', handler)
    return () => ipcRenderer.removeListener('guideFileChanged', handler)
  },
  getAuthState: () => ipcRenderer.invoke('getAuthState'),
  signOut: () => ipcRenderer.invoke('signOut'),
  openSteamSignIn: () => ipcRenderer.invoke('openSteamSignIn'),
  onAuthStateChanged: (callback: (state: { token: string; name: string; avatar: string }) => void) => {
    const handler = (_: unknown, state: { token: string; name: string; avatar: string }) => callback(state)
    ipcRenderer.on('authStateChanged', handler)
    return () => ipcRenderer.removeAllListeners('authStateChanged')
  },
  getCfgKeybind: () => ipcRenderer.invoke('getCfgKeybind'),
  setCfgKeybind: (key: string) => ipcRenderer.invoke('setCfgKeybind', key),
  cloudListGuides: () => ipcRenderer.invoke('cloudListGuides'),
  cloudPushGuide: (payload: { filePath: string; title: string; map: string; nodeCount?: number; cloudId?: string; cloudVersion?: number }) =>
    ipcRenderer.invoke('cloudPushGuide', payload),
  cloudPullGuide: (payload: { cloudId: string; filePath: string }) =>
    ipcRenderer.invoke('cloudPullGuide', payload),
  cloudGetSyncState: (filePath: string) =>
    ipcRenderer.invoke('cloudGetSyncState', filePath),
  openCommunity: () => ipcRenderer.invoke('openCommunity'),
})
