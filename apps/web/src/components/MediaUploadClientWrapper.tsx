'use client'
import { useState } from 'react'
import type { AnnotationNode, AnnotationMedia, CreateMediaPayload, UpdateMediaPayload } from '@cs2ann/shared/web'
import { MediaUploadModal } from '@cs2ann/ui'

interface Props {
  guideId: string
  nodes: AnnotationNode[]
  initialMedia: Record<string, AnnotationMedia[]>
}

export default function MediaUploadClientWrapper({ guideId, nodes, initialMedia }: Props) {
  const [open, setOpen] = useState(false)
  const [media, setMedia] = useState(initialMedia)

  async function createLink(gId: string, payload: CreateMediaPayload): Promise<AnnotationMedia> {
    const res = await fetch(`/api/guides/${gId}/media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async function createUpload(gId: string, fd: FormData): Promise<AnnotationMedia> {
    const res = await fetch(`/api/guides/${gId}/media`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async function update(gId: string, mediaId: string, payload: UpdateMediaPayload): Promise<AnnotationMedia> {
    const res = await fetch(`/api/guides/${gId}/media/${mediaId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async function remove(gId: string, mediaId: string): Promise<void> {
    await fetch(`/api/guides/${gId}/media/${mediaId}`, { method: 'DELETE' })
  }

  async function handleChange() {
    const res = await fetch(`/api/guides/${guideId}/media`)
    if (res.ok) {
      const list: AnnotationMedia[] = await res.json()
      const map: Record<string, AnnotationMedia[]> = {}
      for (const m of list) {
        if (!map[m.nodeId]) map[m.nodeId] = []
        map[m.nodeId].push(m)
      }
      setMedia(map)
    }
    setOpen(false)
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 rounded transition-colors">
        Manage media
      </button>
      {open && (
        <MediaUploadModal
          guideId={guideId}
          nodes={nodes}
          existingMedia={media}
          currentUserId=""
          onCreateLink={createLink}
          onCreateUpload={createUpload}
          onUpdate={update}
          onRemove={remove}
          onClose={() => setOpen(false)}
          onMediaChange={handleChange}
        />
      )}
    </>
  )
}
