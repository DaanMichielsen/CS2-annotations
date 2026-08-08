import { unstable_cache } from 'next/cache'
import { db } from './db'

/**
 * Cached public reads.
 *
 * Pages that use `searchParams` or `auth()` are dynamically rendered, so the
 * full-route cache never applies to them. Without this layer every anonymous
 * request — which in practice means crawler traffic — opened a Postgres
 * connection and woke the Neon compute for a billed minimum of 5 minutes.
 * See docs/dev/database-cost.md.
 *
 * Rules for anything added here:
 *  1. The result MUST NOT depend on the signed-in user. Per-user reads (saved
 *     state, follows, ownership) stay uncached and out of this file.
 *  2. Return primitives only. `unstable_cache` round-trips values through JSON,
 *     which silently turns `Date` into `string` on a cache hit. Convert dates to
 *     ISO strings inside the cached function so both paths agree.
 */

/** Invalidate with `revalidateTag(CACHE_TAG_GUIDES)` after any guide mutation. */
export const CACHE_TAG_GUIDES = 'guides'
/** Invalidate with `revalidateTag(CACHE_TAG_LIBRARY)` after the grenade re-index. */
export const CACHE_TAG_LIBRARY = 'library'

const GUIDE_CARD_SELECT = {
  id: true,
  title: true,
  map: true,
  user: { select: { username: true, avatar: true, name: true } },
  ratings: { select: { value: true } },
  _count: { select: { annotationMedia: true } },
} as const

type GuideCardRow = {
  id: string
  title: string
  map: string | null
  user: { username: string | null; avatar: string | null; name: string | null } | null
  ratings: { value: number }[]
  _count: { annotationMedia: number }
}

export interface GuideCardData {
  id: string
  title: string
  map: string | null
  score: number
  authorName: string | null
  authorAvatar: string | null
  mediaCount: number
}

function toCardData(g: GuideCardRow): GuideCardData {
  return {
    id: g.id,
    title: g.title,
    map: g.map,
    score: g.ratings.reduce((acc, r) => acc + r.value, 0),
    authorName: g.user?.username ?? g.user?.name ?? null,
    authorAvatar: g.user?.avatar ?? null,
    mediaCount: g._count.annotationMedia,
  }
}

/** Newest public guides for the landing page. */
export const getRecentPublicGuides = unstable_cache(
  async (take: number): Promise<GuideCardData[]> => {
    const guides = await db.guide.findMany({
      where: { isPublic: true },
      select: GUIDE_CARD_SELECT,
      orderBy: { updatedAt: 'desc' },
      take,
    })
    return guides.map(toCardData)
  },
  ['recent-public-guides'],
  { revalidate: 300, tags: [CACHE_TAG_GUIDES] }
)

export interface BrowseArgs {
  map?: string
  q?: string
  sort?: string
  skip: number
  take: number
}

/** Paginated / filtered public guide list behind /guides. */
export const getBrowseGuides = unstable_cache(
  async ({ map, q, sort, skip, take }: BrowseArgs): Promise<{ guides: GuideCardData[]; total: number }> => {
    const where = {
      isPublic: true,
      ...(map ? { map } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
    }

    const [guides, total] = await Promise.all([
      db.guide.findMany({
        where,
        select: GUIDE_CARD_SELECT,
        orderBy: sort === 'newest' ? { createdAt: 'desc' as const } : { updatedAt: 'desc' as const },
        skip,
        take,
      }),
      db.guide.count({ where }),
    ])

    const cards = guides.map(toCardData)
    if (sort === 'top') cards.sort((a, b) => b.score - a.score)
    return { guides: cards, total }
  },
  ['browse-guides'],
  { revalidate: 300, tags: [CACHE_TAG_GUIDES] }
)

export interface LibraryArgs {
  map?: string
  type?: string
  throwType?: string
  q?: string
  skip: number
  take: number
}

export interface LibraryEntryData {
  id: string
  guideId: string
  nodeId: string
  map: string
  grenadeType: string
  throwType: string
  aimLabel: string | null
  posLabel: string | null
  guideTitle: string
  hasMedia: boolean
  landingThumb: string | null
}

/** Paginated / filtered grenade index behind /library. */
export const getLibraryEntries = unstable_cache(
  async ({ map, type, throwType, q, skip, take }: LibraryArgs): Promise<{ entries: LibraryEntryData[]; total: number }> => {
    const where = {
      ...(map ? { map } : {}),
      ...(type ? { grenadeType: type } : {}),
      ...(throwType ? { throwType } : {}),
      ...(q
        ? {
            OR: [
              { posLabel: { contains: q, mode: 'insensitive' as const } },
              { aimLabel: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [entries, total] = await Promise.all([
      db.grenadeEntry.findMany({
        where,
        select: {
          id: true,
          guideId: true,
          nodeId: true,
          map: true,
          grenadeType: true,
          throwType: true,
          aimLabel: true,
          posLabel: true,
          hasMedia: true,
          landingThumb: true,
          guide: { select: { title: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      db.grenadeEntry.count({ where }),
    ])

    return {
      entries: entries.map((e) => ({
        id: e.id,
        guideId: e.guideId,
        nodeId: e.nodeId,
        map: e.map,
        grenadeType: e.grenadeType,
        throwType: e.throwType,
        aimLabel: e.aimLabel,
        posLabel: e.posLabel,
        guideTitle: e.guide.title,
        hasMedia: e.hasMedia,
        landingThumb: e.landingThumb,
      })),
      total,
    }
  },
  ['library-entries'],
  { revalidate: 300, tags: [CACHE_TAG_LIBRARY] }
)
