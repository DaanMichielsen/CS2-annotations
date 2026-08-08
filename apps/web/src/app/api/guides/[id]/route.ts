import { NextRequest, NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { revalidateTag } from 'next/cache'
import { db } from '@/lib/db'
import { CACHE_TAG_GUIDES } from '@/lib/queries'
import { uploadGuideBlob, deleteGuideBlob, getGuideBlobUrl } from '@/lib/blob'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const guide = await db.guide.findUnique({ where: { id } })
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (guide.userId !== user.id && !guide.isPublic) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const downloadUrl = await getGuideBlobUrl(guide.blobKey)
  return NextResponse.json({ guide, downloadUrl })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const guide = await db.guide.findUnique({ where: { id } })
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (guide.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const contentType = req.headers.get('content-type') ?? ''

  let title: string | null = null
  let nodeCount = 0
  let clientVersion = 0
  let kv3Content: string | null = null

  if (contentType.includes('application/json')) {
    const body = await req.json()
    title = body.title ?? null
    nodeCount = parseInt(String(body.nodeCount ?? '0'), 10)
    clientVersion = parseInt(String(body.version ?? '0'), 10)
    kv3Content = body.content ?? null
  } else {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    title = formData.get('title') as string | null
    nodeCount = parseInt((formData.get('nodeCount') as string) ?? '0', 10)
    clientVersion = parseInt((formData.get('version') as string) ?? '0', 10)
    if (file) kv3Content = await file.text()
  }

  if (clientVersion !== guide.version) {
    return NextResponse.json(
      { error: 'Version conflict', cloudVersion: guide.version },
      { status: 409 }
    )
  }

  let blobKey = guide.blobKey
  if (kv3Content) {
    blobKey = await uploadGuideBlob(guide.id, kv3Content)
  }

  const updated = await db.guide.update({
    where: { id },
    data: {
      blobKey,
      version: guide.version + 1,
      ...(title ? { title } : {}),
      nodeCount,
    },
  })

  revalidateTag(CACHE_TAG_GUIDES)
  return NextResponse.json({ guide: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const guide = await db.guide.findUnique({ where: { id } })
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (guide.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await deleteGuideBlob(guide.blobKey)
  await db.guide.delete({ where: { id } })
  revalidateTag(CACHE_TAG_GUIDES)

  return NextResponse.json({ ok: true })
}
