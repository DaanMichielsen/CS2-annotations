import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getGuideBlobUrl } from '@/lib/blob'
import { parseKv3Text, kv3ToNodes, extractNodesKey } from '@cs2ann/shared/web'
import type { Kv3Object, AnnotationNode, AnnotationMedia } from '@cs2ann/shared/web'
import PlayClient from './PlayClient'

export default async function PlayModePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const { id } = await params

  const guide = await db.guide.findUnique({
    where: { id },
    select: { id: true, title: true, map: true, blobKey: true, isPublic: true, userId: true },
  })
  if (!guide) notFound()
  if (!guide.isPublic && guide.userId !== session?.user?.id) notFound()

  let nodes: AnnotationNode[] = []
  if (guide.blobKey) {
    try {
      const blobUrl = await getGuideBlobUrl(guide.blobKey)
      if (blobUrl) {
        const res = await fetch(blobUrl, { next: { revalidate: 300 } })
        if (res.ok) {
          let text = await res.text()
          if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
          const root = parseKv3Text(text) as Kv3Object
          nodes = kv3ToNodes(root, extractNodesKey(root))
        }
      }
    } catch { /* blob unavailable */ }
  }

  let mediaMap: Record<string, AnnotationMedia[]> = {}
  try {
    const rawMedia = await db.annotationMedia.findMany({
      where: { guideId: guide.id },
      orderBy: [{ nodeId: 'asc' }, { position: 'asc' }],
    })
    for (const m of rawMedia) {
      const typed = {
        ...m,
        slot:      m.slot      as AnnotationMedia['slot'],
        mediaType: m.mediaType as AnnotationMedia['mediaType'],
        source:    m.source    as AnnotationMedia['source'],
        createdAt: m.createdAt.toISOString(),
        cropBox:   m.cropBox   as AnnotationMedia['cropBox'],
      }
      if (!mediaMap[m.nodeId]) mediaMap[m.nodeId] = []
      mediaMap[m.nodeId].push(typed)
    }
  } catch { /* media unavailable */ }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* slim header */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 shrink-0">
        <Link href={`/guides/${guide.id}`}
          className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
          ← {guide.title}
        </Link>
      </header>

      {/* main area: handed to client for interactivity */}
      <PlayClient
        guideId={guide.id}
        mapName={guide.map ?? ''}
        nodes={nodes}
        mediaMap={mediaMap}
      />
    </div>
  )
}
