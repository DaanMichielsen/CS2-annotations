'use client'
import { useState } from 'react'
import { upload } from '@vercel/blob/client'
import type { AnnotationMedia, AnnotationNode, CreateMediaPayload, MediaSlot, UpdateMediaPayload } from '@cs2ann/shared/web'
import { GuideNodeFilter } from '@/components/GuideNodeFilter'
import AnnotationList from '@/components/AnnotationList'
import { MediaUploadModal } from '@cs2ann/ui'

interface Props {
  guideId: string
  nodes: AnnotationNode[]
  mapName: string | null | undefined
  isOwner: boolean
  initialMedia: Record<string, AnnotationMedia[]>
}

export default function GuideInteractionClient({ guideId, nodes, mapName, isOwner, initialMedia }: Props) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)
  const [openNodeId,     setOpenNodeId]     = useState<string | null>(null)
  const [mediaMap,       setMediaMap]       = useState(initialMedia)

  async function createLink(_gId: string, payload: CreateMediaPayload): Promise<AnnotationMedia> {
    const res = await fetch(`/api/guides/${guideId}/media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async function createUpload(
    _gId: string, file: File, nodeId: string, slot: MediaSlot, mediaType: string, caption?: string
  ): Promise<AnnotationMedia> {
    const blob = await upload(file.name, file, {
      access: 'public',
      handleUploadUrl: `/api/guides/${guideId}/media/upload-token`,
    })
    const res = await fetch(`/api/guides/${guideId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, slot, url: blob.url, mediaType, caption, source: 'upload', blobKey: blob.pathname }),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async function update(_gId: string, mediaId: string, payload: UpdateMediaPayload): Promise<AnnotationMedia> {
    const res = await fetch(`/api/guides/${guideId}/media/${mediaId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async function remove(_gId: string, mediaId: string): Promise<void> {
    await fetch(`/api/guides/${guideId}/media/${mediaId}`, { method: 'DELETE' })
  }

  async function handleMediaChange() {
    const res = await fetch(`/api/guides/${guideId}/media`)
    if (res.ok) {
      const list: AnnotationMedia[] = await res.json()
      const map: Record<string, AnnotationMedia[]> = {}
      for (const m of list) {
        if (!map[m.nodeId]) map[m.nodeId] = []
        map[m.nodeId].push(m)
      }
      setMediaMap(map)
    }
    setOpenNodeId(null)
  }

  return (
    <>
      <GuideNodeFilter
        nodes={nodes}
        mapName={mapName}
        mediaMap={mediaMap}
        onPinClick={setExpandedNodeId}
      />
      <AnnotationList
        nodes={nodes}
        mediaMap={mediaMap}
        expandedNodeId={expandedNodeId ?? undefined}
        canAddMedia={isOwner}
        onAddMedia={isOwner ? setOpenNodeId : undefined}
      />
      {isOwner && openNodeId && (
        <MediaUploadModal
          guideId={guideId}
          nodeId={openNodeId}
          existingMedia={mediaMap[openNodeId] ?? []}
          currentUserId=""
          onCreateLink={createLink}
          onCreateUpload={createUpload}
          onUpdate={update}
          onRemove={remove}
          onClose={() => setOpenNodeId(null)}
          onMediaChange={handleMediaChange}
        />
      )}
    </>
  )
}
