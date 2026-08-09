import { type NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { CACHE_TAG_GUIDES } from '@/lib/queries'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const guide = await db.guide.findUnique({ where: { id } })
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (guide.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { isPublic } = (await req.json()) as { isPublic: boolean }
  const updated = await db.guide.update({ where: { id }, data: { isPublic } })
  // Publishing/unpublishing changes the cached public listings immediately.
  revalidateTag(CACHE_TAG_GUIDES)
  return NextResponse.json({ guide: updated })
}
