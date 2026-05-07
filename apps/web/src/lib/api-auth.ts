import { auth } from './auth'
import { db } from './db'
import type { NextRequest } from 'next/server'

// Returns the authenticated user's id, checking NextAuth session first,
// then falling back to `Authorization: Bearer <userId>` for the desktop app.
export async function getApiUser(req: NextRequest): Promise<{ id: string } | null> {
  const session = await auth()
  if (session?.user?.id) return { id: session.user.id }

  const header = req.headers.get('authorization') ?? ''
  if (header.startsWith('Bearer ')) {
    const userId = header.slice(7).trim()
    if (userId) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
      if (user) return { id: user.id }
    }
  }
  return null
}
