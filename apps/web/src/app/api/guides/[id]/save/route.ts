import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: guideId } = await params

  const guide = await db.guide.findUnique({ where: { id: guideId }, select: { id: true } })
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = await db.savedGuide.findUnique({
    where: { userId_guideId: { userId: session.user.id, guideId } },
  })

  if (existing) {
    await db.savedGuide.delete({ where: { id: existing.id } })
    return NextResponse.json({ saved: false })
  }

  await db.savedGuide.create({ data: { userId: session.user.id, guideId } })
  return NextResponse.json({ saved: true })
}
