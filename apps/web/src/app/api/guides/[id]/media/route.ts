import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { db } from '@/lib/db'
import { CACHE_TAG_GUIDES } from '@/lib/queries'
import { canReadMedia, canCreateMedia } from '@/lib/mediaAuth'
import { VALID_SLOTS, type MediaSlot } from '@cs2ann/shared/web'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: guideId } = await params
  if (!await canReadMedia(guideId, req)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const records = await db.annotationMedia.findMany({
    where: { guideId },
    orderBy: [{ nodeId: 'asc' }, { position: 'asc' }],
  })
  return NextResponse.json(records)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: guideId } = await params
  const ct = req.headers.get('content-type') ?? ''

  if (!ct.includes('application/json'))
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })

  const { nodeId, slot, url, caption, mediaType, source, blobKey } = await req.json()

  if (!nodeId || !slot || !url || !VALID_SLOTS.includes(slot as MediaSlot))
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })

  const userId = await canCreateMedia(guideId, req)
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const resolvedSource: string = source === 'upload' ? 'upload' : 'youtube'
  const resolvedMediaType: string = resolvedSource === 'youtube' ? 'video' : (mediaType ?? 'video')

  const record = await db.annotationMedia.create({
    data: {
      guideId,
      nodeId,
      uploadedBy: userId,
      slot,
      mediaType: resolvedMediaType,
      source: resolvedSource,
      url,
      blobKey: resolvedSource === 'upload' ? (blobKey ?? null) : null,
      caption: caption ?? null,
    },
  })
  // mediaCount is part of the cached card data.
  revalidateTag(CACHE_TAG_GUIDES)
  return NextResponse.json(record, { status: 201 })
}
