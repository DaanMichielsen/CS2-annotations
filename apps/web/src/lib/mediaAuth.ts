import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

async function getCtx(guideId: string) {
  const [session, guide] = await Promise.all([
    auth(),
    db.guide.findUnique({ where: { id: guideId }, select: { userId: true, isPublic: true } }),
  ])
  if (!guide) return null
  const userId = session?.user?.id ?? null
  return { guide, userId, isOwner: userId === guide.userId, isAuthenticated: !!userId }
}

export async function canReadMedia(guideId: string): Promise<boolean> {
  const ctx = await getCtx(guideId)
  if (!ctx) return false
  return ctx.guide.isPublic || ctx.isOwner
}

export async function canCreateMedia(
  guideId: string, nodeId: string, slot: string
): Promise<string | null> {
  const ctx = await getCtx(guideId)
  if (!ctx?.isAuthenticated || !ctx.userId) return null
  if (ctx.isOwner) return ctx.userId
  const count = await db.annotationMedia.count({ where: { guideId, nodeId, slot } })
  return count === 0 ? ctx.userId : null
}

export async function canEditMedia(mediaId: string): Promise<boolean> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return false
  const record = await db.annotationMedia.findUnique({
    where: { id: mediaId },
    include: { guide: { select: { userId: true } } },
  })
  if (!record) return false
  return record.uploadedBy === userId || record.guide.userId === userId
}
