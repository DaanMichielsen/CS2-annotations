'use server'

import { auth } from '@/lib/auth'
import { requireRole } from '@/lib/roles'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function addFeaturedGuide(guideId: string) {
  const session = await auth()
  requireRole(session, 'admin')

  const agg = await db.featuredGuide.aggregate({ _max: { position: true } })
  const position = (agg._max.position ?? 0) + 1
  await db.featuredGuide.create({ data: { guideId, position } })
  revalidatePath('/admin/featured')
}

export async function removeFeaturedGuide(guideId: string) {
  const session = await auth()
  requireRole(session, 'admin')

  await db.featuredGuide.delete({ where: { guideId } })
  const remaining = await db.featuredGuide.findMany({ orderBy: { position: 'asc' } })
  await db.$transaction(
    remaining.map((fg, i) =>
      db.featuredGuide.update({ where: { id: fg.id }, data: { position: i + 1 } })
    )
  )
  revalidatePath('/admin/featured')
}

export async function reorderFeaturedGuides(orderedIds: string[]) {
  const session = await auth()
  requireRole(session, 'admin')

  await db.$transaction(
    orderedIds.map((id, i) =>
      db.featuredGuide.update({ where: { id }, data: { position: i + 1 } })
    )
  )
  revalidatePath('/admin/featured')
}

export async function updateGuideCredits(
  guideId: string,
  credits: Array<{ handle: string; label?: string }>
) {
  const session = await auth()
  requireRole(session, 'admin')

  await db.$transaction([
    db.guideCredit.deleteMany({ where: { guideId } }),
    ...credits
      .filter((c) => c.handle.trim())
      .map((c, i) =>
        db.guideCredit.create({
          data: { guideId, handle: c.handle.trim(), label: c.label?.trim() || null, position: i + 1 },
        })
      ),
  ])
  revalidatePath('/admin/featured')
}

export async function searchPublicGuides(q: string, map: string | null, page: number) {
  const session = await auth()
  requireRole(session, 'admin')

  const PAGE_SIZE = 24
  const where = {
    isPublic: true,
    ...(map ? { map } : {}),
    ...(q.trim() ? { title: { contains: q.trim(), mode: 'insensitive' as const } } : {}),
  }

  const [guides, total] = await Promise.all([
    db.guide.findMany({
      where,
      include: {
        user: { select: { username: true, name: true } },
        featuredGuide: { select: { id: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.guide.count({ where }),
  ])

  return { guides, totalPages: Math.ceil(total / PAGE_SIZE) }
}
