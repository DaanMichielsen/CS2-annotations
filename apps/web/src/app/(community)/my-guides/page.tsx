// apps/web/src/app/(community)/my-guides/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { deleteGuideBlob } from '@/lib/blob'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { getMapColor, getMapLabel } from '@/lib/mapColors'
import { MapFilterBar } from '@/components/MapFilterBar'
import { PaginationFooter } from '@/components/PaginationFooter'
import { SearchInput } from '@/components/SearchInput'

interface SearchParams {
  map?: string
  q?: string
  page?: string
}

const PAGE_SIZE = 24

async function deleteGuide(id: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.id) return
  const guide = await db.guide.findUnique({ where: { id } })
  if (!guide || guide.userId !== session.user.id) return
  await deleteGuideBlob(guide.blobKey)
  await db.guide.delete({ where: { id } })
  revalidatePath('/my-guides')
}

async function togglePublish(id: string, currentIsPublic: boolean) {
  'use server'
  const session = await auth()
  if (!session?.user?.id) return
  const guide = await db.guide.findUnique({ where: { id } })
  if (!guide || guide.userId !== session.user.id) return
  await db.guide.update({ where: { id }, data: { isPublic: !currentIsPublic } })
  revalidatePath('/my-guides')
}

export default async function MyGuidesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth()
  if (!session) redirect('/auth/signin')

  const { map, q, page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    userId: session.user.id,
    ...(map ? { map } : {}),
    ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
  }

  const [guides, total] = await Promise.all([
    db.guide.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: PAGE_SIZE }),
    db.guide.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const totalUnfiltered = await db.guide.count({ where: { userId: session.user.id } })

  function buildMapHref(m: string | null) {
    const params = new URLSearchParams({ ...(m ? { map: m } : {}), ...(q ? { q } : {}) })
    const qs = params.toString()
    return qs ? `/my-guides?${qs}` : '/my-guides'
  }

  function buildPageHref(p: number) {
    const params = new URLSearchParams({
      ...(map ? { map } : {}),
      ...(q ? { q } : {}),
      page: String(p),
    })
    return `/my-guides?${params.toString()}`
  }

  const searchOtherParams: Record<string, string> = { ...(map ? { map } : {}) }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl text-white tracking-tight mb-1">My Guides</h1>
          <p className="text-zinc-600 text-sm">
            {totalUnfiltered === 0
              ? 'No guides yet — push one from the desktop app.'
              : `${totalUnfiltered} guide${totalUnfiltered !== 1 ? 's' : ''} · ${guides.filter((g) => g.isPublic).length} public on this page`}
          </p>
        </div>
        <Link
          href="/guides"
          className="text-xs px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-lg transition-colors"
        >
          Browse community →
        </Link>
      </div>

      {/* Map filter */}
      <MapFilterBar activeMap={map} buildHref={buildMapHref} />

      {/* Search row */}
      <div className="flex justify-end mt-3 mb-6">
        <SearchInput
          initialValue={q ?? ''}
          placeholder="Search my guides…"
          otherParams={searchOtherParams}
        />
      </div>

      {guides.length === 0 ? (
        <div className="text-center py-24 border border-zinc-800/60 rounded-xl">
          <p className="font-display font-semibold text-xl text-zinc-600 mb-2">No guides found</p>
          <p className="text-zinc-700 text-sm">
            {map || q ? 'Try clearing the filters.' : 'Open the desktop app and push a guide to get started.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {guides.map((guide) => {
            const { accent, dim } = getMapColor(guide.map)
            const mapLabel = getMapLabel(guide.map)
            return (
              <div
                key={guide.id}
                className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 rounded-xl px-5 py-4 hover:border-zinc-700 transition-colors"
                style={{ borderLeftColor: accent, borderLeftWidth: '3px' }}
              >
                <span
                  className="shrink-0 text-[0.6rem] font-data uppercase tracking-widest px-2 py-0.5 rounded hidden sm:block"
                  style={{ backgroundColor: dim, color: accent }}
                >
                  {mapLabel}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-zinc-100 truncate">{guide.title}</p>
                  <p className="text-xs font-data text-zinc-600 mt-0.5">
                    {guide.nodeCount} nodes · v{guide.version} ·{' '}
                    {new Date(guide.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[0.65rem] font-data uppercase tracking-wide px-2 py-0.5 rounded ${
                    guide.isPublic
                      ? 'bg-emerald-950 text-emerald-500 border border-emerald-900'
                      : 'bg-zinc-800 text-zinc-600'
                  }`}
                >
                  {guide.isPublic ? 'Public' : 'Private'}
                </span>
                <div className="flex gap-2 shrink-0">
                  {guide.isPublic && (
                    <Link
                      href={`/guides/${guide.id}`}
                      className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-lg transition-colors"
                    >
                      View
                    </Link>
                  )}
                  <form action={togglePublish.bind(null, guide.id, guide.isPublic)}>
                    <button
                      type="submit"
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                        guide.isPublic
                          ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-400'
                          : 'bg-violet-950/50 hover:bg-violet-900/50 border-violet-900 text-violet-400'
                      }`}
                    >
                      {guide.isPublic ? 'Unpublish' : 'Publish'}
                    </button>
                  </form>
                  <form action={deleteGuide.bind(null, guide.id)}>
                    <button
                      type="submit"
                      className="text-xs px-3 py-1.5 bg-zinc-900 hover:bg-red-950 border border-zinc-800 hover:border-red-900 text-zinc-600 hover:text-red-400 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PaginationFooter currentPage={page} totalPages={totalPages} createHref={buildPageHref} />
    </div>
  )
}
