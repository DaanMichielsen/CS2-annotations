/// <reference types="vite/client" />

import type { AnnotationNode } from '@cs2ann/shared'

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
  getAuthState: () => Promise<{ token: string | null; name: string; avatar: string }>
  signOut: () => Promise<void>
  openSteamSignIn: () => Promise<void>
  onAuthStateChanged: (callback: (state: { token: string; name: string; avatar: string }) => void) => () => void
  cloudListGuides: () => Promise<{ guides?: Array<{ id: string; title: string; map: string; version: number }>; error?: string }>
  cloudPushGuide: (payload: { filePath: string; title: string; map: string; cloudId?: string; cloudVersion?: number }) =>
    Promise<{ guide?: { id: string; version: number }; conflict?: boolean; cloudVersion?: number; error?: string }>
  cloudPullGuide: (payload: { cloudId: string; filePath: string }) => Promise<{ ok?: boolean; error?: string }>
  cloudGetSyncState: (filePath: string) => Promise<{ synced: boolean; cloudId?: string; localVersion?: number; cloudVersion?: number; behind?: boolean }>
  openCommunity: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
