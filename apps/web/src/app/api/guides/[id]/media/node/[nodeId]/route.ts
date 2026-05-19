// apps/web/src/app/api/guides/[id]/media/node/[nodeId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canReadMedia } from '@/lib/mediaAuth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const { id: guideId, nodeId } = await params
  if (!await canReadMedia(guideId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const records = await db.annotationMedia.findMany({
    where: { guideId, nodeId },
    orderBy: [{ slot: 'asc' }, { position: 'asc' }],
  })
  return NextResponse.json(records)
}
