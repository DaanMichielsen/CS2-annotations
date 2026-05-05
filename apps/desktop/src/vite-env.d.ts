/// <reference types="vite/client" />

import type { AnnotationNode } from './annotation/types'

type GuideSource = 'local' | 'workshop'

interface ElectronAPI {
  getAnnotationsRoot: () => Promise<string>
  setAnnotationsRoot: (root: string) => Promise<void>
  getWorkshopContentPath: () => Promise<string>
  setWorkshopContentPath: (p: string) => Promise<void>
  getAutoCopyLoadCommandsOnOpen: () => Promise<boolean>
  setAutoCopyLoadCommandsOnOpen: (value: boolean) => Promise<void>
  detectSteamPath: () => Promise<
    | { path: string; annotationsRoot: string; workshopContentPath: string }
    | { error: string }
  >
  listGuides: () => Promise<{ name: string; path: string; source: GuideSource; mapName?: string; workshopId?: string; installed: boolean }[]>
  createGuide: (filename: string, mapName?: string) => Promise<{ error?: string; loadName?: string }>
  loadGuide: (
    filePath: string
  ) => Promise<
    | { nodes: AnnotationNode[]; nodesKey: string; root: Record<string, unknown> }
    | { error: string }
  >
  saveGuide: (payload: {
    filePath: string
    root: Record<string, unknown>
    nodes: AnnotationNode[]
    nodesKey: string
    createBackup?: boolean
  }) => Promise<{ error?: string }>
  saveAsLocalGuide: (payload: {
    root: Record<string, unknown>
    nodes: AnnotationNode[]
    nodesKey: string
    localName: string
  }) => Promise<{ error?: string; path?: string; loadName?: string }>
  deleteGuide: (filePath: string) => Promise<{ error?: string }>
  appendNodesToGuide: (payload: {
    targetFilePath: string
    nodes: AnnotationNode[]
  }) => Promise<{ error?: string; finalNodeCount?: number }>
  createGuideWithNodes: (payload: {
    filename: string
    mapName: string
    nodes: AnnotationNode[]
  }) => Promise<{ error?: string; loadName?: string; filePath?: string }>
  sendCS2ConsoleCommand: (command: string) => Promise<{ error?: string }>
  writeCS2Cfg: (command: string) => Promise<{ error?: string; cfgPath?: string; content?: string }>
  showItemInFolder: (filePath: string) => Promise<void>
  launchCS2: () => Promise<{ error?: string }>
  watchGuideFile: (filePath: string) => void
  unwatchGuideFile: () => void
  onGuideFileChanged: (callback: (filePath: string) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
