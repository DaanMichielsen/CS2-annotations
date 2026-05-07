import { db } from '@/lib/db'
import GuideCard from '@/components/GuideCard'
import { KNOWN_MAPS, getMapLabel } from '@/lib/mapColors'
import Link from 'next/link'

interface SearchParams {
  map?: string
  sort?: string
  q?: string
}

export const revalidate = 60

export default async function BrowsePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { map, sort, q } = await searchParams
  const perPage = 24

  const guides = await db.guide.findMany({
    where: {
      isPublic: true,
      ...(map ? { map } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    },
    include: {
      user: { select: { username: true, avatar: true, name: true } },
      ratings: { select: { value: true } },
    },
    orderBy: sort === 'newest' ? { createdAt: 'desc' } : { updatedAt: 'desc' },
    take: perPage,
  })

  const withScores = guides.map((g) => ({
    ...g,
    score: g.ratings.reduce((acc, r) => acc + r.value, 0),
  }))

  if (sort === 'top') withScores.sort((a, b) => b.score - a.score)

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Hero strip */}
      <div className="mb-10">
        <h1 className="font-display font-bold text-4xl text-white mb-2 tracking-tight">
          Community Guides
        </h1>
        <p className="text-zinc-500 text-sm">
          Annotated nade & utility guides built and shared by the CS2 community.
        </p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <Link
          href={`/guides${sort ? `?sort=${sort}` : ''}`}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !map
              ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
          }`}
        >
          All maps
        </Link>
        {KNOWN_MAPS.map((m) => (
          <Link
            key={m}
            href={`/guides?map=${m}${sort ? `&sort=${sort}` : ''}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              map === m
                ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
            }`}
          >
            {getMapLabel(m)}
          </Link>
        ))}

        <div className="ml-auto flex gap-1">
          {[
            { value: undefined, label: 'Recent' },
            { value: 'top', label: 'Top' },
            { value: 'newest', label: 'Newest' },
          ].map(({ value, label }) => (
            <Link
              key={label}
              href={`/guides${new URLSearchParams({ ...(map ? { map } : {}), ...(value ? { sort: value } : {}) }).toString() ? `?${new URLSearchParams({ ...(map ? { map } : {}), ...(value ? { sort: value } : {}) }).toString()}` : ''}`}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${
                (sort ?? undefined) === value
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Guide grid */}
      {withScores.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-display font-semibold text-xl text-zinc-600 mb-2">No guides yet</p>
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
              nodeCount={g.nodeCount}
              score={g.score}
              authorName={g.user.username ?? g.user.name}
              authorAvatar={g.user.avatar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
