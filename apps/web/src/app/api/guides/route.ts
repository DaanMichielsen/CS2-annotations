import { NextRequest, NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { uploadGuideBlob } from '@/lib/blob'

export async function GET(req: NextRequest) {
  const user = await getApiUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guides = await db.guide.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, map: true, version: true,
      isPublic: true, nodeCount: true, createdAt: true, updatedAt: true,
    },
  })

  return NextResponse.json({ guides })
}

export async function POST(req: NextRequest) {
  const user = await getApiUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null
  const map = formData.get('map') as string | null
  const nodeCount = parseInt((formData.get('nodeCount') as string) ?? '0', 10)

  if (!file || !title) return NextResponse.json({ error: 'Missing file or title' }, { status: 400 })

  const kv3Content = await file.text()

  const guide = await db.guide.create({
    data: { userId: user.id, title, map: map ?? '', nodeCount, blobKey: '' },
  })

  const blobKey = await uploadGuideBlob(guide.id, kv3Content)
  const updated = await db.guide.update({ where: { id: guide.id }, data: { blobKey } })

  return NextResponse.json({ guide: updated }, { status: 201 })
}
