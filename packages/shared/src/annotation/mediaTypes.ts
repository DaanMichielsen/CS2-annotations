export type MediaSlot = 'standing' | 'aim' | 'landing'
export type MediaType = 'video' | 'image'
export type MediaSource = 'upload' | 'youtube'

export interface CropBox {
  x: number // 0-1 fraction from left
  y: number // 0-1 fraction from top
  w: number // 0-1 fraction width
  h: number // 0-1 fraction height
}

export interface AnnotationMedia {
  id: string
  guideId: string
  nodeId: string
  uploadedBy: string
  slot: MediaSlot
  mediaType: MediaType
  source: MediaSource
  url: string
  blobKey?: string | null
  caption?: string | null
  notes?: string | null
  trimStart?: number | null
  trimEnd?: number | null
  speedRate?: number | null
  cropBox?: CropBox | null
  position: number
  createdAt: string
}

export interface CreateMediaPayload {
  nodeId: string
  slot: MediaSlot
  mediaType: MediaType
  source: MediaSource
  url: string
  blobKey?: string
  caption?: string
  notes?: string
  trimStart?: number
  trimEnd?: number
  speedRate?: number
  cropBox?: CropBox
}

export interface UpdateMediaPayload {
  caption?: string
  notes?: string
  speedRate?: number
  cropBox?: CropBox
}

export const VALID_SLOTS: MediaSlot[] = ['standing', 'aim', 'landing']
export const SLOT_LABELS: Record<MediaSlot, string> = {
  standing: 'Standing position',
  aim: 'Aim position',
  landing: 'Landing position',
}
