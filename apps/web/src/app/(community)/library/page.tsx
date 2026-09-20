// apps/web/src/app/(community)/library/page.tsx
import { getLibraryEntries } from '@/lib/queries'
import { MapFilterBar } from '@/components/MapFilterBar'
import { ThrowTypeFilterBar } from '@/components/ThrowTypeFilterBar'
import { GrenadeTypeFilterBar } from '@/components/GrenadeTypeFilterBar'
import { PaginationFooter } from '@/components/PaginationFooter'
import { SearchInput } from '@/components/SearchInput'
import LibraryCard from '@/components/LibraryCard'

interface SearchParams {
  map?: string
  type?: string
  throw?: string
  q?: string
  page?: string
}

// See src/lib/queries.ts: freshness comes from revalidateTag, not expiry.
export const revalidate = 3600

const PAGE_SIZE = 24

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { map, type, throw: throwParam, q, page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const skip = (page - 1) * PAGE_SIZE

  // Served from the cached layer — this page is dynamic (it reads searchParams),
  // so without it every filter permutation a crawler tries hits Postgres.
  const { entries, total } = await getLibraryEntries({
    map,
    type,
    throwType: throwParam,
    q,
    skip,
    take: PAGE_SIZE,
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildMapHref(m: string | null) {
    const p = new URLSearchParams({
      ...(m ? { map: m } : {}),
      ...(type ? { type } : {}),
      ...(throwParam ? { throw: throwParam } : {}),
      ...(q ? { q } : {}),
    })
    const qs = p.toString()
    return qs ? `/library?${qs}` : '/library'
  }

  function buildTypeHref(t: string | null) {
    const p = new URLSearchParams({
      ...(map ? { map } : {}),
      ...(t ? { type: t } : {}),
      ...(throwParam ? { throw: throwParam } : {}),
      ...(q ? { q } : {}),
    })
    const qs = p.toString()
    return qs ? `/library?${qs}` : '/library'
  }

  function buildThrowHref(t: string | null) {
    const p = new URLSearchParams({
      ...(map ? { map } : {}),
      ...(type ? { type } : {}),
      ...(t ? { throw: t } : {}),
      ...(q ? { q } : {}),
    })
    const qs = p.toString()
    return qs ? `/library?${qs}` : '/library'
  }

  function buildPageHref(p: number) {
    const params = new URLSearchParams({
      ...(map ? { map } : {}),
      ...(type ? { type } : {}),
      ...(throwParam ? { throw: throwParam } : {}),
      ...(q ? { q } : {}),
      page: String(p),
    })
    return `/library?${params.toString()}`
  }

  const searchOtherParams: Record<string, string> = {
    ...(map ? { map } : {}),
    ...(type ? { type } : {}),
    ...(throwParam ? { throw: throwParam } : {}),
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-10">
        <h1 className="font-display font-bold text-4xl text-white mb-2 tracking-tight">Grenade Library</h1>
        <p className="text-zinc-500 text-sm">
          Every grenade lineup from public community guides, indexed and filterable.
        </p>
      </div>

      {/* Map filter */}
      <MapFilterBar activeMap={map} buildHref={buildMapHref} />

      {/* Grenade type filter */}
      <div className="mt-4">
        <GrenadeTypeFilterBar activeType={type} buildHref={buildTypeHref} />
      </div>

      {/* Throw type + search row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-8">
        <ThrowTypeFilterBar activeType={throwParam} buildHref={buildThrowHref} />
        <SearchInput
          initialValue={q ?? ''}
          placeholder="Search lineups…"
          otherParams={searchOtherParams}
        />
      </div>

      <p className="text-xs text-zinc-600 mb-4">{total.toLocaleString()} lineup{total !== 1 ? 's' : ''}</p>

      {entries.length === 0 ? (
        <div className="text-center py-24 border border-zinc-800/60 rounded-xl">
          <p className="font-display font-semibold text-xl text-zinc-600 mb-2">No lineups found</p>
          <p className="text-zinc-700 text-sm">Try clearing some filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map((entry) => (
            <LibraryCard
              key={entry.id}
              guideId={entry.guideId}
              nodeId={entry.nodeId}
              map={entry.map}
              grenadeType={entry.grenadeType}
              throwType={entry.throwType}
              aimLabel={entry.aimLabel}
              posLabel={entry.posLabel}
              guideTitle={entry.guideTitle}
              hasMedia={entry.hasMedia}
              landingThumb={entry.landingThumb}
            />
          ))}
        </div>
      )}

      <PaginationFooter currentPage={page} totalPages={totalPages} createHref={buildPageHref} />
    </div>
  )
}
