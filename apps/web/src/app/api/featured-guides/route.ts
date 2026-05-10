import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const revalidate = 60

export async function GET() {
  const featured = await db.featuredGuide.findMany({
    orderBy: { position: 'asc' },
    include: {
      guide: {
        select: {
          id: true,
          title: true,
          map: true,
          nodeCount: true,
          credits: {
            orderBy: { position: 'asc' },
            select: { handle: true, label: true },
          },
        },
      },
    },
  })

  return NextResponse.json({
    guides: featured.map((fg) => ({
      id: fg.guideId,
      title: fg.guide.title,
      map: fg.guide.map,
      nodeCount: fg.guide.nodeCount,
      credits: fg.guide.credits,
    })),
  })
}
