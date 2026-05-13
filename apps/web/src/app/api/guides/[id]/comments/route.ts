import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const comments = await db.guideComment.findMany({
    where: { guideId: id },
    include: { user: { select: { id: true, username: true, avatar: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ comments })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { body } = (await req.json()) as { body: string }
  if (!body?.trim()) return NextResponse.json({ error: 'Empty comment' }, { status: 400 })

  const comment = await db.guideComment.create({
    data: { userId: session.user.id, guideId: id, body: body.trim() },
    include: { user: { select: { id: true, username: true, avatar: true, name: true } } },
  })
  return NextResponse.json({ comment }, { status: 201 })
}
