import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db } from '@/lib/db'
import { canReadMedia, canCreateMedia } from '@/lib/mediaAuth'
import { VALID_SLOTS, type MediaSlot } from '@cs2ann/shared/web'

const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime']
const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp']

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

  // YouTube / external link
  if (ct.includes('application/json')) {
    const { nodeId, slot, url, caption } = await req.json()
    if (!nodeId || !slot || !url || !VALID_SLOTS.includes(slot))
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    const userId = await canCreateMedia(guideId, req)
    if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const record = await db.annotationMedia.create({
      data: { guideId, nodeId, uploadedBy: userId, slot, mediaType: 'video', source: 'youtube', url, caption: caption ?? null },
    })
    return NextResponse.json(record, { status: 201 })
  }

  // Direct upload
  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    const file      = fd.get('file') as File | null
    const nodeId    = fd.get('nodeId') as string | null
    const slot      = fd.get('slot') as string | null
    const mediaType = fd.get('mediaType') as string | null

    if (!file || !nodeId || !slot || !mediaType || !VALID_SLOTS.includes(slot as MediaSlot))
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    const allowed = mediaType === 'video' ? ALLOWED_VIDEO : ALLOWED_IMAGE
    if (!allowed.includes(file.type))
      return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 400 })

    const userId = await canCreateMedia(guideId, req)
    if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const ext = file.name.split('.').pop() ?? 'bin'
    const blobKey = `cs2annotations/media/${guideId}/${nodeId}/${slot}/${Date.now()}.${ext}`
    const { url } = await put(blobKey, file.stream(), { access: 'public', contentType: file.type })

    const record = await db.annotationMedia.create({
      data: {
        guideId, nodeId, uploadedBy: userId, slot, mediaType, source: 'upload', url, blobKey,
        caption:   (fd.get('caption')   as string | null) ?? null,
        trimStart: fd.get('trimStart')  ? Number(fd.get('trimStart'))  : null,
        trimEnd:   fd.get('trimEnd')    ? Number(fd.get('trimEnd'))    : null,
        cropBox:   fd.get('cropBox')    ? JSON.parse(fd.get('cropBox') as string) : null,
      },
    })
    return NextResponse.json(record, { status: 201 })
  }

  return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
}
