import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, name: true, avatar: true, bio: true, steamId: true, socialLinks: true },
  })
  return NextResponse.json(user)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const bio = typeof body.bio === 'string' ? body.bio.slice(0, 300) : undefined

  // Social links are intentionally not editable here — each platform requires its own
  // OAuth verification before it can be user-submitted. Enable entries in SOCIAL_PLATFORMS
  // in SocialIcons.tsx and add the platform key to `allowed` below when that is done.
  const allowed: string[] = []
  const cleanLinks: Record<string, string> = {}
  const socialLinks = body.socialLinks && typeof body.socialLinks === 'object' ? body.socialLinks : undefined
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
      ...(socialLinks !== undefined && allowed.length > 0 && { socialLinks: cleanLinks }),
    },
    select: { id: true, bio: true, socialLinks: true },
  })

  return NextResponse.json(user)
}
