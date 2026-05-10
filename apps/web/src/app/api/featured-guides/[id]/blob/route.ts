import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getGuideBlobUrl } from '@/lib/blob'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const guide = await db.guide.findFirst({
    where: { id, isPublic: true },
    select: { blobKey: true },
  })
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = await getGuideBlobUrl(guide.blobKey)
  if (!url) return NextResponse.json({ error: 'Content not available' }, { status: 404 })

  return NextResponse.redirect(url)
}
