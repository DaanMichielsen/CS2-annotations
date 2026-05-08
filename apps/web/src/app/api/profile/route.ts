import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, name: true, avatar: true, bio: true, socialLinks: true },
  })
  return NextResponse.json(user)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const bio = typeof body.bio === 'string' ? body.bio.slice(0, 300) : undefined
  const socialLinks = body.socialLinks && typeof body.socialLinks === 'object' ? body.socialLinks : undefined

  const allowed = ['steam', 'youtube', 'twitch', 'kick', 'discord']
  const cleanLinks: Record<string, string> = {}
  if (socialLinks) {
    for (const key of allowed) {
      if (typeof socialLinks[key] === 'string') {
        cleanLinks[key] = socialLinks[key].trim().slice(0, 200)
      }
    }
  }

  const user = await db.user.update({
    where: { id: session.user.id },
    data: {
      ...(bio !== undefined && { bio }),
      ...(socialLinks !== undefined && { socialLinks: cleanLinks }),
    },
    select: { id: true, bio: true, socialLinks: true },
  })

  return NextResponse.json(user)
}
