import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import RatingButtons from '@/components/RatingButtons'
import CommentThread from '@/components/CommentThread'
import SaveButton from '@/components/SaveButton'
import DownloadButton from '@/components/DownloadButton'
import { GuideNodeFilter } from '@/components/GuideNodeFilter'
import { getMapColor, getMapLabel } from '@/lib/mapColors'
import { getGuideBlobUrl } from '@/lib/blob'
import { parseKv3Text, kv3ToNodes, extractNodesKey } from '@cs2ann/shared/web'
import type { Kv3Object, AnnotationNode, GrenadeType } from '@cs2ann/shared/web'
import { CreditChip } from '@/components/CreditChip'
import AnnotationList from '@/components/AnnotationList'
import FollowButton from '@/components/FollowButton'

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
      user: { select: { id: true, username: true, avatar: true, name: true } },
      ratings: { select: { value: true, userId: true } },
      comments: {
        include: { user: { select: { id: true, username: true, avatar: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      credits: { orderBy: { position: 'asc' } },
      featuredGuide: { select: { id: true } },
      savedBy: session?.user?.id
        ? { where: { userId: session.user.id }, select: { id: true } }
        : false,
    },
  })

  if (!guide) notFound()
  if (!guide.isPublic && guide.userId !== session?.user?.id) notFound()

  // Fetch and parse annotation nodes for preview
  let nodes: AnnotationNode[] = []
  let blobUrl: string | null = null
  if (guide.blobKey) {
    try {
      blobUrl = await getGuideBlobUrl(guide.blobKey)
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
      // blob unavailable
    }
  }

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
  const isFeatured = !!guide.featuredGuide
  const initialSaved = Array.isArray(guide.savedBy) && guide.savedBy.length > 0
  const authorName = guide.user.username ?? guide.user.name ?? 'Anonymous'
  const { accent, dim, icon: mapIcon } = getMapColor(guide.map)
  const mapLabel = getMapLabel(guide.map)

  const isFollowing =
    session?.user?.id && !isOwner
      ? !!(await db.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: session.user.id,
              followingId: guide.userId,
            },
          },
        }))
      : false

  async function forkGuide() {
    'use server'
    if (!session?.user?.id) redirect('/auth/signin')
    await fetch(`${process.env.NEXTAUTH_URL}/api/guides/${id}/fork`, { method: 'POST' })
    redirect('/my-guides')
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Back nav */}
      <Link
        href="/guides"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-6"
      >
        ← Back to guides
      </Link>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">

        {/* ── LEFT: main content ── */}
        <div className="flex-1 min-w-0">

          {/* Map badge + status tags */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
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

          {/* Title */}
          <h1 className="font-display font-bold text-4xl text-white mb-3 leading-tight tracking-tight">
            {guide.title}
          </h1>

          {/* Description */}
          {guide.description && (
            <p className="text-zinc-400 text-sm mb-4 leading-relaxed max-w-2xl">
              {guide.description}
            </p>
          )}

          {/* Credits */}
          {guide.credits.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-zinc-600">Credits:</span>
              {guide.credits.map((c) => (
                <CreditChip key={c.id} handle={c.handle} label={c.label} />
              ))}
            </div>
          )}

          {/* Grenade type summary */}
          {Object.keys(grenadeCounts).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-6">
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

          {/* Annotation preview */}
          <section>
            <h2 className="font-display font-semibold text-base text-zinc-400 mb-4 uppercase tracking-wider">
              Annotations · {nodes.length} nodes
            </h2>
            <GuideNodeFilter nodes={nodes} mapName={guide.map} />
            <AnnotationList nodes={nodes} />
          </section>
        </div>

        {/* ── RIGHT: sidebar ── */}
        <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-20 flex flex-col gap-4">

          {/* Author card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[0.65rem] font-data uppercase tracking-wider text-zinc-600 mb-3">Created by</p>
            <div className="flex items-center gap-3">
              <Link
                href={`/users/${guide.user.id}`}
                className="flex items-center gap-3 group flex-1 min-w-0"
              >
                {guide.user.avatar ? (
                  <Image
                    src={guide.user.avatar}
                    alt={authorName}
                    width={40}
                    height={40}
                    className="rounded-full ring-1 ring-zinc-700 group-hover:ring-zinc-500 transition-all shrink-0"
                    unoptimized
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 shrink-0" />
                )}
                <p className="font-display font-semibold text-zinc-100 group-hover:text-white transition-colors truncate">
                  {authorName}
                </p>
              </Link>
              {session && !isOwner && (
                <FollowButton targetId={guide.user.id} initialFollowing={isFollowing} />
              )}
            </div>
          </div>

          {/* Rating */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[0.65rem] font-data uppercase tracking-wider text-zinc-600 mb-3">Rating</p>
            <RatingButtons guideId={guide.id} initialScore={score} userVote={userVote} />
          </div>

          {/* Actions — button group: hugging, shared borders, only outer corners rounded */}
          <div className="flex overflow-hidden rounded-lg">
            {!isFeatured && (
              <div className="flex-1">
                <SaveButton
                  guideId={guide.id}
                  initialSaved={initialSaved}
                  isAuthenticated={!!session?.user?.id}
                  className="rounded-none!"
                />
              </div>
            )}
            {blobUrl && (
              <div className={`flex-1${!isFeatured ? ' -ml-px' : ''}`}>
                <DownloadButton
                  downloadUrl={blobUrl}
                  guideTitle={guide.title}
                  mapName={guide.map ?? null}
                  className="rounded-none!"
                />
              </div>
            )}
            {session && !isOwner && (
              <form
                className={`flex-1${blobUrl || !isFeatured ? ' -ml-px' : ''}`}
                action={forkGuide}
              >
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-none border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 text-sm font-medium transition-colors"
                >
                  Fork guide
                </button>
              </form>
            )}
            {isOwner && (
              <Link
                href="/my-guides"
                className={`flex-1 flex items-center justify-center gap-2 px-2 py-2 rounded-none border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 text-sm font-medium transition-colors${blobUrl || !isFeatured ? ' -ml-px' : ''}`}
              >
                Manage →
              </Link>
            )}
          </div>

          {/* Comments */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <CommentThread
              guideId={guide.id}
              initialComments={guide.comments.map((c) => ({
                ...c,
                createdAt: c.createdAt.toISOString(),
              }))}
              isAuthenticated={!!session?.user?.id}
              currentUserId={session?.user?.id ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
