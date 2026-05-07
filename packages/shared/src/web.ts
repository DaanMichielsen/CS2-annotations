// Safe for Next.js/webpack — excludes mapData.ts which uses import.meta.glob (Vite-only)
export * from './kv3/index'
export * from './annotation/types'
export * from './annotation/kv3Mapping'
export * from './annotation/inferUtils'
export * from './annotation/groupUtils'
export type {
  GuideAdapter,
  GuideSummary,
  LoadedGuide,
  SaveGuidePayload,
  AppendNodesPayload,
  CreateGuidePayload,
} from './adapter'
