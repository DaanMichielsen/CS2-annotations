import { getApiUser } from '@/lib/api-auth'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

export async function canReadMedia(guideId: string, req?: NextRequest): Promise<boolean> {
  const guide = await db.guide.findUnique({ where: { id: guideId }, select: { isPublic: true, userId: true } })
  if (!guide) return false
  if (guide.isPublic) return true
  if (!req) return false
  const user = await getApiUser(req)
  return user?.id === guide.userId
}

/** Returns the authenticated userId if the user can add media to this guide, null otherwise. */
export async function canCreateMedia(guideId: string, req: NextRequest): Promise<string | null> {
  const user = await getApiUser(req)
  if (!user?.id) return null
  const guide = await db.guide.findUnique({ where: { id: guideId }, select: { userId: true } })
  if (!guide || guide.userId !== user.id) return null
  return user.id
}

export async function canEditMedia(mediaId: string, req: NextRequest): Promise<boolean> {
  const user = await getApiUser(req)
  if (!user?.id) return false
  const record = await db.annotationMedia.findUnique({ where: { id: mediaId }, select: { uploadedBy: true } })
  return record?.uploadedBy === user.id
}
