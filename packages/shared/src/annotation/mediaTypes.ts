export type MediaSlot = 'full' | 'standing' | 'aim' | 'landing'
export type MediaType = 'video' | 'image'
export type MediaSource = 'upload' | 'youtube'

export interface CropBox { x: number; y: number; w: number; h: number }

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
  trimStart?: number | null
  trimEnd?: number | null
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
  trimStart?: number
  trimEnd?: number
  cropBox?: CropBox
}

export interface UpdateMediaPayload {
  caption?: string
  cropBox?: CropBox
}

export const VALID_SLOTS: MediaSlot[] = ['full', 'standing', 'aim', 'landing']
export const SLOT_LABELS: Record<MediaSlot, string> = {
  full:     'Full video',
  standing: 'Standing position',
  aim:      'Aim position',
  landing:  'Landing position',
}
