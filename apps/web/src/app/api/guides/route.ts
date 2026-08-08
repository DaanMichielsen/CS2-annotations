import { NextRequest, NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { revalidateTag } from 'next/cache'
import { db } from '@/lib/db'
import { CACHE_TAG_GUIDES } from '@/lib/queries'
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

  const contentType = req.headers.get('content-type') ?? ''

  let title: string | null = null
  let map: string | null = null
  let nodeCount = 0
  let kv3Content: string | null = null

  if (contentType.includes('application/json')) {
    const body = await req.json()
    title = body.title ?? null
    map = body.map ?? null
    nodeCount = parseInt(String(body.nodeCount ?? '0'), 10)
    kv3Content = body.content ?? null
  } else {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    title = formData.get('title') as string | null
    map = formData.get('map') as string | null
    nodeCount = parseInt((formData.get('nodeCount') as string) ?? '0', 10)
    if (file) kv3Content = await file.text()
  }

  if (!kv3Content || !title) return NextResponse.json({ error: 'Missing content or title' }, { status: 400 })

  let guide
  try {
    guide = await db.guide.create({
      data: { userId: user.id, title, map: map ?? '', nodeCount, blobKey: '' },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to create guide record' }, { status: 500 })
  }

  try {
    const blobKey = await uploadGuideBlob(guide.id, kv3Content)
    const updated = await db.guide.update({ where: { id: guide.id }, data: { blobKey } })
    revalidateTag(CACHE_TAG_GUIDES)
    return NextResponse.json({ guide: updated }, { status: 201 })
  } catch {
    await db.guide.delete({ where: { id: guide.id } }).catch(() => {})
    return NextResponse.json({ error: 'Failed to upload guide content — please try again' }, { status: 500 })
  }
}
