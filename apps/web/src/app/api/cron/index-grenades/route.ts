// apps/web/src/app/api/cron/index-grenades/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getGuideBlobUrl } from '@/lib/blob'
import { parseKv3Text, kv3ToNodes, extractNodesKey, inferThrowType } from '@cs2ann/shared/web'
import type { Kv3Object, AnnotationNode } from '@cs2ann/shared/web'

export const dynamic = 'force-dynamic'

const BATCH_SIZE = 50
const CURSOR_KEY = 'grenade-indexer'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cursorRow = await db.cronState.findUnique({ where: { key: CURSOR_KEY } })
  const cursor = cursorRow ? new Date(cursorRow.value) : new Date(0)

  let processed = 0
  let cleaned = 0
  let latestDate = cursor

  // 1. Clean up entries for guides that became private since last run
  const privateGuides = await db.guide.findMany({
    where: { isPublic: false, updatedAt: { gt: cursor } },
    select: { id: true, updatedAt: true },
  })
  if (privateGuides.length > 0) {
    await db.grenadeEntry.deleteMany({
      where: { guideId: { in: privateGuides.map((g) => g.id) } },
    })
    cleaned = privateGuides.length
    for (const g of privateGuides) {
      if (g.updatedAt > latestDate) latestDate = g.updatedAt
    }
  }

  // 2. Index new / updated public guides
  const publicGuides = await db.guide.findMany({
    where: { isPublic: true, updatedAt: { gt: cursor } },
    orderBy: { updatedAt: 'asc' },
    take: BATCH_SIZE,
    select: { id: true, map: true, blobKey: true, updatedAt: true },
  })

  for (const guide of publicGuides) {
    try {
      const blobUrl = await getGuideBlobUrl(guide.blobKey)
      if (!blobUrl) continue

      const res = await fetch(blobUrl)
      if (!res.ok) continue

      let kv3Text = await res.text()
      if (kv3Text.charCodeAt(0) === 0xfeff) kv3Text = kv3Text.slice(1)

      const root = parseKv3Text(kv3Text) as Kv3Object
      const nodesKey = extractNodesKey(root)
      const nodes = kv3ToNodes(root, nodesKey)

      // Group grenade nodes by master id
      const mainNodes = nodes.filter(
        (n: AnnotationNode) => n.Type === 'grenade' && n.SubType !== 'aim_target' && n.SubType !== 'destination'
      )
      const aimTargets = nodes.filter((n: AnnotationNode) => n.Type === 'grenade' && n.SubType === 'aim_target')
      const aimByMaster = new Map(aimTargets.map((n: AnnotationNode) => [n.MasterNodeId, n]))

      const upserts = mainNodes
        .filter((n: AnnotationNode) => n.GrenadeType && n.Id)
        .map((n: AnnotationNode) => {
          const aim = aimByMaster.get(n.Id)
          const throwType = aim ? inferThrowType(aim) : 'other'
          return db.grenadeEntry.upsert({
            where: { guideId_nodeId: { guideId: guide.id, nodeId: n.Id! } },
            create: {
              guideId: guide.id,
              nodeId: n.Id!,
              map: guide.map ?? 'unknown',
              grenadeType: n.GrenadeType!,
              throwType,
              posLabel: n.Desc?.Text ?? null,
              aimLabel: n.Title?.Text ?? null,
            },
            update: {
              map: guide.map ?? 'unknown',
              grenadeType: n.GrenadeType!,
              throwType,
              posLabel: n.Desc?.Text ?? null,
              aimLabel: n.Title?.Text ?? null,
            },
          })
        })

      await Promise.all(upserts)

      // Sync hasMedia / landingThumb from annotationMedia table
      const mediaRows = await db.annotationMedia.findMany({
        where: { guideId: guide.id },
        select: { nodeId: true, slot: true, url: true },
      })
      const mediaByNode = new Map<string, { hasMedia: boolean; landingThumb: string | null }>()
      for (const m of mediaRows) {
        const entry = mediaByNode.get(m.nodeId) ?? { hasMedia: false, landingThumb: null }
        entry.hasMedia = true
        if (m.slot === 'landing' && !entry.landingThumb) entry.landingThumb = m.url
        mediaByNode.set(m.nodeId, entry)
      }

      const nodeIds = mainNodes.map((n: AnnotationNode) => n.Id!)
      const withMedia = [...mediaByNode.entries()]
      const withoutMedia = nodeIds.filter((id) => !mediaByNode.has(id))

      await Promise.all([
        ...withMedia.map(([nodeId, val]) =>
          db.grenadeEntry.updateMany({
            where: { guideId: guide.id, nodeId },
            data: { hasMedia: val.hasMedia, landingThumb: val.landingThumb },
          })
        ),
        withoutMedia.length > 0
          ? db.grenadeEntry.updateMany({
              where: { guideId: guide.id, nodeId: { in: withoutMedia } },
              data: { hasMedia: false, landingThumb: null },
            })
          : Promise.resolve(),
      ])

      processed++
      if (guide.updatedAt > latestDate) latestDate = guide.updatedAt
    } catch (err) {
      console.error(`[cron] Failed to index guide ${guide.id}:`, err)
    }
  }

  // 3. Advance cursor
  if (latestDate > cursor) {
    await db.cronState.upsert({
      where: { key: CURSOR_KEY },
      create: { key: CURSOR_KEY, value: latestDate.toISOString() },
      update: { value: latestDate.toISOString() },
    })
  }

  return NextResponse.json({ processed, cleaned })
}
