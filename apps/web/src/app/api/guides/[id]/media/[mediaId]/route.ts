// apps/web/src/app/api/guides/[id]/media/[mediaId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { db } from '@/lib/db'
import { canEditMedia } from '@/lib/mediaAuth'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const { mediaId } = await params
  if (!await canEditMedia(mediaId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { caption, notes, speedRate, cropBox } = await req.json()
  const record = await db.annotationMedia.update({
    where: { id: mediaId },
    data: { caption: caption ?? null, notes: notes ?? null, speedRate: speedRate ?? null, cropBox: cropBox ?? null },
  })
  return NextResponse.json(record)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const { mediaId } = await params
  if (!await canEditMedia(mediaId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const record = await db.annotationMedia.findUnique({ where: { id: mediaId } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (record.blobKey) await del(record.url)
  await db.annotationMedia.delete({ where: { id: mediaId } })
  return new NextResponse(null, { status: 204 })
}
