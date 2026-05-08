import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: targetId } = await params
  if (targetId === session.user.id) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })

  const existing = await db.follow.findUnique({
    where: { followerId_followingId: { followerId: session.user.id, followingId: targetId } },
  })

  if (existing) {
    await db.follow.delete({ where: { id: existing.id } })
    return NextResponse.json({ following: false })
  } else {
    await db.follow.create({ data: { followerId: session.user.id, followingId: targetId } })
    return NextResponse.json({ following: true })
  }
}
