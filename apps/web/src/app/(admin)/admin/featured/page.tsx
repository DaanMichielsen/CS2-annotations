import { auth } from '@/lib/auth'
import { requireRole } from '@/lib/roles'
import { db } from '@/lib/db'
import FeaturedPageClient from './FeaturedPageClient'

export default async function AdminFeaturedPage() {
  const session = await auth()
  requireRole(session, 'admin')

  const featured = await db.featuredGuide.findMany({
    orderBy: { position: 'asc' },
    include: {
      guide: {
        include: {
          user: { select: { username: true, name: true } },
          credits: { orderBy: { position: 'asc' } },
        },
      },
    },
  })

  return <FeaturedPageClient initialItems={featured} />
}
