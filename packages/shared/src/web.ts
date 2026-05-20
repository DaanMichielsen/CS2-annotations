// Safe for Next.js/webpack — excludes mapData.ts which uses import.meta.glob (Vite-only)
export * from './kv3/index'
export * from './annotation/types'
export * from './annotation/kv3Mapping'
export * from './annotation/inferUtils'
export * from './annotation/groupUtils'
export {
  THROW_TYPE_LABEL,
  THROW_TYPE_SHORT,
  type ThrowType,
} from './annotation/inferUtils'
export type { AnnotationMedia, CreateMediaPayload, UpdateMediaPayload, MediaSlot, MediaType, MediaSource, CropBox } from './annotation/mediaTypes'
export { VALID_SLOTS, SLOT_LABELS } from './annotation/mediaTypes'
export { resolveMediaForDisplay } from './annotation/mediaUtils'
export type {
  GuideAdapter,
  GuideSummary,
  LoadedGuide,
  SaveGuidePayload,
  AppendNodesPayload,
  CreateGuidePayload,
} from './adapter'
