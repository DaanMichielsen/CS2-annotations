'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AnnotationNode, AnnotationMedia, CreateMediaPayload, UpdateMediaPayload } from '@cs2ann/shared/web'
import { MediaUploadModal } from '@cs2ann/ui'
import AnnotationList from './AnnotationList'

interface Props {
  guideId: string
  nodes: AnnotationNode[]
  mediaMap: Record<string, AnnotationMedia[]>
  isOwner: boolean
}

export default function MediaManagerClient({ guideId, nodes, mediaMap, isOwner }: Props) {
  const router = useRouter()
  const [modalNodeId, setModalNodeId] = useState<string | null>(null)

  const refresh = useCallback(() => router.refresh(), [router])

  const createLink = async (gid: string, payload: CreateMediaPayload): Promise<AnnotationMedia> => {
    const res = await fetch(`/api/guides/${gid}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  const createUpload = async (gid: string, fd: FormData): Promise<AnnotationMedia> => {
    const res = await fetch(`/api/guides/${gid}/media`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  const update = async (mediaId: string, payload: UpdateMediaPayload): Promise<AnnotationMedia> => {
    const res = await fetch(`/api/guides/${guideId}/media/${mediaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  const remove = async (mediaId: string): Promise<void> => {
    await fetch(`/api/guides/${guideId}/media/${mediaId}`, { method: 'DELETE' })
  }

  return (
    <>
      <AnnotationList
        nodes={nodes}
        mediaMap={mediaMap}
        canAddMedia={isOwner}
        onAddMedia={(nid) => setModalNodeId(nid)}
      />
      {modalNodeId !== null && (
        <MediaUploadModal
          guideId={guideId}
          nodes={nodes}
          existingMedia={mediaMap}
          currentUserId=""
          onCreateLink={createLink}
          onCreateUpload={createUpload}
          onUpdate={update}
          onRemove={remove}
          onClose={() => setModalNodeId(null)}
          onMediaChange={refresh}
        />
      )}
    </>
  )
}
