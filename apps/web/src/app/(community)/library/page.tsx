// apps/web/src/app/(community)/library/page.tsx
import { db } from '@/lib/db'
import { MapFilterBar } from '@/components/MapFilterBar'
import { ThrowTypeFilterBar } from '@/components/ThrowTypeFilterBar'
import { GrenadeTypeFilterBar } from '@/components/GrenadeTypeFilterBar'
import { PaginationFooter } from '@/components/PaginationFooter'
import { SearchInput } from '@/components/SearchInput'
import { THROW_TYPE_SHORT } from '@cs2ann/shared/web'
import type { ThrowType } from '@cs2ann/shared/web'
import { getMapColor, getMapLabel } from '@/lib/mapColors'
import Link from 'next/link'
import Image from 'next/image'

interface SearchParams {
  map?: string
  type?: string
  throw?: string
  q?: string
  page?: string
}

export const revalidate = 300

const PAGE_SIZE = 24

const GRENADE_ICONS: Record<string, string> = {
  smoke:      '/nades/smoke.png',
  flash:      '/nades/flash.png',
  he:         '/nades/hegrenade.png',
  molotov:    '/nades/molotov.png',
  incendiary: '/nades/molotov.png',
  decoy:      '/nades/decoy.png',
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { map, type, throw: throwParam, q, page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    ...(map ? { map } : {}),
    ...(type ? { grenadeType: type } : {}),
    ...(throwParam ? { throwType: throwParam } : {}),
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
      include: { guide: { select: { title: true } } },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    db.grenadeEntry.count({ where }),
  ])

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
          {entries.map((entry) => {
            const { accent, dim, icon: mapIcon } = getMapColor(entry.map)
            const mapLabel = getMapLabel(entry.map)
            const grenadeIcon = GRENADE_ICONS[entry.grenadeType]
            const throwShort = THROW_TYPE_SHORT[entry.throwType as ThrowType] ?? entry.throwType

            return (
              <div
                key={entry.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors flex flex-col gap-3"
              >
                {/* Header: map chip + grenade icon + throw badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="flex items-center gap-1 text-[0.6rem] font-data uppercase tracking-widest px-2 py-0.5 rounded font-semibold"
                    style={{ backgroundColor: dim, color: accent }}
                  >
                    {mapIcon && (
                      <Image src={mapIcon} alt="" width={10} height={10} className="opacity-80" unoptimized />
                    )}
                    {mapLabel}
                  </div>
                  {grenadeIcon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={grenadeIcon} alt={entry.grenadeType} width={16} height={16} className="opacity-80" />
                  )}
                  <span className="text-[0.65rem] font-data px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                    {throwShort}
                  </span>
                </div>

                {/* Labels */}
                <div className="flex-1">
                  {entry.aimLabel && (
                    <p className="font-display font-semibold text-zinc-100 text-sm leading-tight mb-1 truncate">
                      {entry.aimLabel}
                    </p>
                  )}
                  {entry.posLabel && (
                    <p className="text-xs text-zinc-500 truncate">{entry.posLabel}</p>
                  )}
                </div>

                {/* Guide link */}
                <Link
                  href={`/guides/${entry.guideId}`}
                  className="text-[0.68rem] text-zinc-600 hover:text-violet-400 transition-colors truncate"
                >
                  {entry.guide.title} →
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <PaginationFooter currentPage={page} totalPages={totalPages} createHref={buildPageHref} />
    </div>
  )
}
