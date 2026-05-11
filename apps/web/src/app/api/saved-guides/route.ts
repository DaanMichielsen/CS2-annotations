import { NextRequest, NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { getGuideBlobUrl } from '@/lib/blob'

export async function GET(req: NextRequest) {
  const user = await getApiUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const saved = await db.savedGuide.findMany({
    where: { userId: user.id },
    orderBy: { savedAt: 'desc' },
    include: {
      guide: {
        select: {
          id: true,
          title: true,
          map: true,
          nodeCount: true,
          version: true,
          blobKey: true,
          isPublic: true,
          user: { select: { username: true, name: true } },
        },
      },
    },
  })

  // Resolve blob download URLs for desktop use
  const guides = await Promise.all(
    saved.map(async (s) => {
      const downloadUrl = s.guide.blobKey ? await getGuideBlobUrl(s.guide.blobKey) : null
      return {
        savedId: s.id,
        savedAt: s.savedAt,
        id: s.guide.id,
        title: s.guide.title,
        map: s.guide.map,
        nodeCount: s.guide.nodeCount,
        version: s.guide.version,
        isPublic: s.guide.isPublic,
        authorName: s.guide.user.username ?? s.guide.user.name,
        downloadUrl,
      }
    })
  )

  return NextResponse.json({ guides })
}
