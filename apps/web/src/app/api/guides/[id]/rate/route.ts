import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { value } = (await req.json()) as { value: number }
  if (value !== 1 && value !== -1 && value !== 0) {
    return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
  }

  if (value === 0) {
    // Remove existing vote
    await db.guideRating.deleteMany({
      where: { userId: session.user.id, guideId: id },
    })
  } else {
    await db.guideRating.upsert({
      where: { userId_guideId: { userId: session.user.id, guideId: id } },
      update: { value },
      create: { userId: session.user.id, guideId: id, value },
    })
  }

  const agg = await db.guideRating.aggregate({
    where: { guideId: id },
    _sum: { value: true },
  })

  return NextResponse.json({ score: agg._sum.value ?? 0 })
}
