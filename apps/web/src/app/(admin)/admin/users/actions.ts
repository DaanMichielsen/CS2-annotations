'use server'

import { auth } from '@/lib/auth'
import { requireRole } from '@/lib/roles'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function searchUsers(q: string) {
  const session = await auth()
  requireRole(session, 'admin')

  return db.user.findMany({
    where: q.trim()
      ? {
          OR: [
            { username: { contains: q.trim(), mode: 'insensitive' } },
            { steamId: { contains: q.trim() } },
          ],
        }
      : {},
    include: { roles: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}

export async function grantRole(userId: string, role: string) {
  const session = await auth()
  requireRole(session, 'admin')

  await db.userRole.create({
    data: { userId, role, grantedById: session!.user.id },
  })
  revalidatePath('/admin/users')
}

export async function revokeRole(userId: string, role: string) {
  const session = await auth()
  requireRole(session, 'admin')

  // Prevent self-revocation of admin
  if (userId === session!.user.id && role === 'admin') return

  await db.userRole.delete({ where: { userId_role: { userId, role } } })
  revalidatePath('/admin/users')
}
