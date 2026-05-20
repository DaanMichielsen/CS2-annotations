import type { AnnotationNode } from './annotation/types'
import type { AnnotationMedia, CreateMediaPayload, UpdateMediaPayload } from './annotation/mediaTypes'

export interface GuideSummary {
  id: string
  name: string
  mapName?: string
  source: 'local' | 'workshop' | 'cloud'
  installed?: boolean
  workshopId?: string
}

export interface LoadedGuide {
  nodes: AnnotationNode[]
  nodesKey: string
  root: Record<string, unknown>
}

export interface SaveGuidePayload {
  id: string
  root: Record<string, unknown>
  nodes: AnnotationNode[]
  nodesKey: string
  createBackup?: boolean
}

export interface AppendNodesPayload {
  targetId: string
  nodes: AnnotationNode[]
}

export interface CreateGuidePayload {
  filename: string
  mapName?: string
  nodes?: AnnotationNode[]
  nodesKey?: string
  root?: Record<string, unknown>
}

export interface GuideAdapter {
  listGuides(): Promise<GuideSummary[]>
  createGuide(payload: CreateGuidePayload): Promise<{ error?: string; id?: string; loadName?: string }>
  loadGuide(id: string): Promise<LoadedGuide | { error: string }>
  saveGuide(payload: SaveGuidePayload): Promise<{ error?: string }>
  saveAsLocal(payload: {
    root: Record<string, unknown>
    nodes: AnnotationNode[]
    nodesKey: string
    localName: string
  }): Promise<{ error?: string; id?: string; loadName?: string }>
  deleteGuide(id: string): Promise<{ error?: string }>
  appendNodes(payload: AppendNodesPayload): Promise<{ error?: string; finalNodeCount?: number }>
  getAnnotationsRoot?(): Promise<string>
  getWorkshopContentPath?(): Promise<string>
  getAutoCopyLoadCommandsOnOpen?(): Promise<boolean>
  getCfgKeybind?(): Promise<string>
  setAnnotationsRoot?(root: string): Promise<void>
  setWorkshopContentPath?(path: string): Promise<void>
  setAutoCopyLoadCommandsOnOpen?(value: boolean): Promise<void>
  setCfgKeybind?(key: string): Promise<void>
  detectSteamPath?(): Promise<
    | { path: string; annotationsRoot: string; workshopContentPath: string }
    | { error: string }
  >
  launchCS2?(): Promise<{ error?: string }>

  cs2?: {
    writeCommand(command: string): Promise<{ error?: string; cfgPath?: string }>
    sendConsoleCommand?(command: string): Promise<{ error?: string }>
    watchFile(filePath: string): void
    unwatchFile(): void
    onFileChanged(callback: (filePath: string) => void): () => void
  }

  clipboard?: {
    write(text: string): Promise<{ error?: string }>
    showInFolder?(path: string): Promise<void>
  }

  media?: {
    list(guideId: string, nodeId?: string): Promise<AnnotationMedia[]>
    createLink(guideId: string, payload: CreateMediaPayload): Promise<AnnotationMedia>
    createUpload(guideId: string, formData: FormData): Promise<AnnotationMedia>
    update(guideId: string, mediaId: string, payload: UpdateMediaPayload): Promise<AnnotationMedia>
    remove(guideId: string, mediaId: string): Promise<void>
  }
}
