import { NextRequest, NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { db } from '@/lib/db'
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

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const clientVersion = parseInt((formData.get('version') as string) ?? '0', 10)
  const title = formData.get('title') as string | null
  const nodeCount = parseInt((formData.get('nodeCount') as string) ?? '0', 10)

  if (clientVersion !== guide.version) {
    return NextResponse.json(
      { error: 'Version conflict', cloudVersion: guide.version },
      { status: 409 }
    )
  }

  let blobKey = guide.blobKey
  if (file) {
    const kv3Content = await file.text()
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

  return NextResponse.json({ ok: true })
}
