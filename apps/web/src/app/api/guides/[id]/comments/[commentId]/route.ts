import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string; commentId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { commentId } = await params
  const { body } = (await req.json()) as { body: string }
  if (!body?.trim()) return NextResponse.json({ error: 'Empty comment' }, { status: 400 })

  const comment = await db.guideComment.findUnique({ where: { id: commentId } })
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (comment.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updated = await db.guideComment.update({
    where: { id: commentId },
    data: { body: body.trim() },
    include: { user: { select: { id: true, username: true, avatar: true, name: true } } },
  })
  return NextResponse.json({ comment: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { commentId } = await params
  const comment = await db.guideComment.findUnique({ where: { id: commentId } })
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (comment.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.guideComment.delete({ where: { id: commentId } })
  return NextResponse.json({ ok: true })
}
