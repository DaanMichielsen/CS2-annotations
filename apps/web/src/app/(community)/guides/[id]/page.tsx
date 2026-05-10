import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import RatingButtons from '@/components/RatingButtons'
import CommentThread from '@/components/CommentThread'
import GuideAnnotationPreview from '@/components/GuideAnnotationPreview'
import { GuideNodeFilter } from '@/components/GuideNodeFilter'
import { getMapColor, getMapLabel } from '@/lib/mapColors'
import { getGuideBlobUrl } from '@/lib/blob'
import { parseKv3Text, kv3ToNodes, extractNodesKey } from '@cs2ann/shared/web'
import type { Kv3Object, AnnotationNode, GrenadeType } from '@cs2ann/shared/web'

const GRENADE_ORDER: GrenadeType[] = ['smoke', 'flash', 'he', 'molotov', 'decoy']
const GRENADE_ICON_FILES: Record<GrenadeType, string> = {
  smoke:   '/nades/smoke.png',
  flash:   '/nades/flash.png',
  he:      '/nades/hegrenade.png',
  molotov: '/nades/molotov.png',
  decoy:   '/nades/decoy.png',
}
const GRENADE_COLORS: Record<GrenadeType, string> = {
  smoke:   '#94a3b8',
  flash:   '#fde68a',
  he:      '#f87171',
  molotov: '#fb923c',
  decoy:   '#a3e635',
}

export default async function GuideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const { id } = await params

  const guide = await db.guide.findUnique({
    where: { id },
    include: {
      user: { select: { username: true, avatar: true, name: true } },
      ratings: { select: { value: true, userId: true } },
      comments: {
        include: { user: { select: { username: true, avatar: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!guide) notFound()
  if (!guide.isPublic && guide.userId !== session?.user?.id) notFound()

  // Fetch and parse annotation nodes from blob for preview
  let nodes: AnnotationNode[] = []
  if (guide.blobKey) {
    try {
      const blobUrl = await getGuideBlobUrl(guide.blobKey)
      if (blobUrl) {
        const kv3Res = await fetch(blobUrl, { next: { revalidate: 300 } })
        if (kv3Res.ok) {
          let kv3Text = await kv3Res.text()
          if (kv3Text.charCodeAt(0) === 0xfeff) kv3Text = kv3Text.slice(1)
          const root = parseKv3Text(kv3Text) as Kv3Object
          const nodesKey = extractNodesKey(root)
          nodes = kv3ToNodes(root, nodesKey)
        }
      }
    } catch {
      // blob unavailable — render preview with empty nodes
    }
  }

  // Grenade type summary from parsed nodes
  const mainGrenadeNodes = nodes.filter(
    (n) => n.Type === 'grenade' && n.SubType !== 'aim_target' && n.SubType !== 'destination'
  )
  const grenadeCounts = GRENADE_ORDER.reduce<Partial<Record<GrenadeType, number>>>(
    (acc, gt) => {
      const count = mainGrenadeNodes.filter((n) => n.GrenadeType === gt).length
      if (count > 0) acc[gt] = count
      return acc
    },
    {}
  )

  const score = guide.ratings.reduce((acc, r) => acc + r.value, 0)
  const userVote = session?.user?.id
    ? (guide.ratings.find((r) => r.userId === session.user!.id)?.value ?? null)
    : null

  const isOwner = session?.user?.id === guide.userId
  const authorName = guide.user.username ?? guide.user.name ?? 'Anonymous'
  const { accent, dim, icon: mapIcon } = getMapColor(guide.map)
  const mapLabel = getMapLabel(guide.map)

  async function forkGuide() {
    'use server'
    if (!session?.user?.id) redirect('/auth/signin')
    await fetch(`${process.env.NEXTAUTH_URL}/api/guides/${id}/fork`, { method: 'POST' })
    redirect('/my-guides')
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Back nav */}
      <Link href="/guides" className="inline-flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-8">
        ← Back to guides
      </Link>

      {/* Header */}
      <div
        className="rounded-xl p-6 mb-8 border border-zinc-800"
        style={{ background: `linear-gradient(135deg, ${dim} 0%, transparent 60%)` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="flex items-center gap-1.5 text-[0.65rem] font-data uppercase tracking-widest px-2 py-0.5 rounded font-semibold"
                style={{ backgroundColor: dim, color: accent }}
              >
                {mapIcon && (
                  <Image src={mapIcon} alt={mapLabel} width={14} height={14} className="opacity-80" unoptimized />
                )}
                {mapLabel}
              </div>
              {guide.forkOf && (
                <span className="text-[0.65rem] text-zinc-600 font-data">forked</span>
              )}
              {!guide.isPublic && (
                <span className="text-[0.65rem] px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded font-data">
                  private
                </span>
              )}
            </div>

            <h1 className="font-display font-bold text-3xl text-white mb-3 leading-tight">
              {guide.title}
            </h1>

            {guide.description && (
              <p className="text-zinc-400 text-sm mb-4 leading-relaxed">{guide.description}</p>
            )}

            <div className="flex items-center gap-2">
              {guide.user.avatar ? (
                <div className="w-6 h-6 rounded-full overflow-hidden ring-1 ring-zinc-700 shrink-0">
                  <Image
                    src={guide.user.avatar}
                    alt={authorName}
                    width={24}
                    height={24}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 shrink-0" />
              )}
              <span className="text-sm text-zinc-400">{authorName}</span>
              <span className="text-zinc-700 text-xs font-data mx-1">·</span>
              <span className="text-xs font-data text-zinc-600">v{guide.version}</span>
            </div>

            {/* Grenade type summary */}
            {Object.keys(grenadeCounts).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {GRENADE_ORDER.filter((gt) => grenadeCounts[gt]).map((gt) => (
                  <div
                    key={gt}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900/60"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={GRENADE_ICON_FILES[gt]} alt={gt} width={14} height={14} className="opacity-80" />
                    <span className="text-xs font-data font-bold tabular-nums" style={{ color: GRENADE_COLORS[gt] }}>
                      {grenadeCounts[gt]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col items-end gap-3">
            <RatingButtons guideId={guide.id} initialScore={score} userVote={userVote} />

            {session && !isOwner && (
              <form action={forkGuide}>
                <button
                  type="submit"
                  className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded transition-colors"
                >
                  Fork guide
                </button>
              </form>
            )}

            {isOwner && (
              <Link
                href={`/my-guides`}
                className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded transition-colors"
              >
                Manage →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Annotation preview */}
      <section className="mb-10">
        <h2 className="font-display font-semibold text-lg text-white mb-4 tracking-tight">
          Annotations
        </h2>
        <GuideNodeFilter nodes={nodes} mapName={guide.map} />
      </section>

      {/* Comments */}
      <div className="border-t border-zinc-800/60 pt-8">
        <CommentThread
          guideId={guide.id}
          initialComments={guide.comments.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
          }))}
          isAuthenticated={!!session?.user?.id}
        />
      </div>
    </div>
  )
}
