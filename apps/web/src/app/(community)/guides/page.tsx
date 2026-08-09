// apps/web/src/app/(community)/guides/page.tsx
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getBrowseGuides } from '@/lib/queries'
import GuideCard from '@/components/GuideCard'
import { getMapLabel } from '@/lib/mapColors'
import Link from 'next/link'
import { MapFilterBar } from '@/components/MapFilterBar'
import { PaginationFooter } from '@/components/PaginationFooter'
import { SearchInput } from '@/components/SearchInput'

interface SearchParams {
  map?: string
  sort?: string
  q?: string
  page?: string
}

const PAGE_SIZE = 24

export default async function BrowsePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth()
  const { map, sort, q, page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const skip = (page - 1) * PAGE_SIZE

  // Public list comes from the cached layer so repeat/crawler hits don't wake
  // Postgres; the per-user overlay below is intentionally left uncached.
  const { guides: withScores, total } = await getBrowseGuides({ map, q, sort, skip, take: PAGE_SIZE })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const guideIds = withScores.map((g) => g.id)
  const userId = session?.user?.id

  const [savedRows, featuredRows] = userId
    ? await Promise.all([
        db.savedGuide.findMany({
          where: { userId, guideId: { in: guideIds } },
          select: { guideId: true },
        }),
        db.featuredGuide.findMany({
          where: { guideId: { in: guideIds } },
          select: { guideId: true },
        }),
      ])
    : [[], []]

  const savedSet = new Set(savedRows.map((r) => r.guideId))
  const featuredSet = new Set(featuredRows.map((r) => r.guideId))

  function buildMapHref(m: string | null) {
    const params = new URLSearchParams({
      ...(m ? { map: m } : {}),
      ...(sort ? { sort } : {}),
      ...(q ? { q } : {}),
    })
    const qs = params.toString()
    return qs ? `/guides?${qs}` : '/guides'
  }

  function buildPageHref(p: number) {
    const params = new URLSearchParams({
      ...(map ? { map } : {}),
      ...(sort ? { sort } : {}),
      ...(q ? { q } : {}),
      page: String(p),
    })
    return `/guides?${params.toString()}`
  }

  const searchOtherParams: Record<string, string> = {
    ...(map ? { map } : {}),
    ...(sort ? { sort } : {}),
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-10">
        <h1 className="font-display font-bold text-4xl text-white mb-2 tracking-tight">
          Community Guides
        </h1>
        <p className="text-zinc-500 text-sm">
          Annotated nade &amp; utility guides built and shared by the CS2 community.
        </p>
      </div>

      {/* Map filters */}
      <MapFilterBar activeMap={map} buildHref={buildMapHref} />

      {/* Sort + Search row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-8">
        <div className="flex gap-1">
          {[
            { value: undefined, label: 'Recent' },
            { value: 'top',    label: 'Top' },
            { value: 'newest', label: 'Newest' },
          ].map(({ value, label }) => {
            const params = new URLSearchParams({
              ...(map ? { map } : {}),
              ...(value ? { sort: value } : {}),
              ...(q ? { q } : {}),
            })
            const qs = params.toString()
            return (
              <Link
                key={label}
                href={qs ? `/guides?${qs}` : '/guides'}
                className={`text-xs px-3 py-1.5 rounded transition-colors ${
                  (sort ?? undefined) === value
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
        <SearchInput
          initialValue={q ?? ''}
          placeholder="Search guides…"
          otherParams={searchOtherParams}
        />
      </div>

      {/* Guide grid */}
      {withScores.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-display font-semibold text-xl text-zinc-600 mb-2">No guides found</p>
          <p className="text-zinc-700 text-sm">
            {map ? `No public ${getMapLabel(map)} guides yet.` : 'Be the first to share a guide.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {withScores.map((g) => (
            <GuideCard
              key={g.id}
              id={g.id}
              title={g.title}
              map={g.map}
              score={g.score}
              authorName={g.authorName}
              authorAvatar={g.authorAvatar}
              isSaved={userId ? savedSet.has(g.id) : undefined}
              isAuthenticated={!!userId}
              isFeatured={featuredSet.has(g.id)}
              mediaCount={g.mediaCount}
            />
          ))}
        </div>
      )}

      <PaginationFooter
        currentPage={page}
        totalPages={totalPages}
        createHref={buildPageHref}
      />
    </div>
  )
}
