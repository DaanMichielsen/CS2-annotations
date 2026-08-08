import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { revalidateTag } from 'next/cache'
import { db } from '@/lib/db'
import { CACHE_TAG_GUIDES } from '@/lib/queries'
import { uploadGuideBlob, getGuideBlobUrl } from '@/lib/blob'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const source = await db.guide.findUnique({ where: { id } })
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!source.isPublic && source.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const blobUrl = await getGuideBlobUrl(source.blobKey)
  const fileRes = await fetch(blobUrl)
  const kv3Content = await fileRes.text()

  const forked = await db.guide.create({
    data: {
      userId: session.user.id,
      title: `${source.title} (fork)`,
      description: source.description,
      map: source.map,
      tags: source.tags,
      nodeCount: source.nodeCount,
      forkOf: source.id,
      blobKey: '',
    },
  })

  const blobKey = await uploadGuideBlob(forked.id, kv3Content)
  const updated = await db.guide.update({ where: { id: forked.id }, data: { blobKey } })
  revalidateTag(CACHE_TAG_GUIDES)
  return NextResponse.json({ guide: updated }, { status: 201 })
}
