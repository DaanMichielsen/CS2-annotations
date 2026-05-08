import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import GuideCard from '@/components/GuideCard'
import FollowButton from '@/components/FollowButton'
import { SOCIAL_PLATFORMS, type SocialLinks } from '@/components/SocialIcons'

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const { id } = await params

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      name: true,
      avatar: true,
      bio: true,
      socialLinks: true,
      steamId: true,
      createdAt: true,
      _count: { select: { followers: true, following: true } },
    },
  })

  if (!user) notFound()

  const isOwnProfile = session?.user?.id === user.id

  const isFollowing = session?.user?.id
    ? !!(await db.follow.findUnique({
        where: { followerId_followingId: { followerId: session.user.id, followingId: user.id } },
      }))
    : false

  const guides = await db.guide.findMany({
    where: { userId: user.id, isPublic: true },
    include: { ratings: { select: { value: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  const guidesWithScore = guides.map((g) => ({
    ...g,
    score: g.ratings.reduce((a, r) => a + r.value, 0),
  }))

  const topGuides = [...guidesWithScore].sort((a, b) => b.score - a.score).slice(0, 3)
  const totalScore = guidesWithScore.reduce((a, g) => a + g.score, 0)

  const displayName = user.username ?? user.name ?? 'Unknown'
  const links = (user.socialLinks ?? {}) as SocialLinks

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Profile header — dossier card */}
      <div className="relative overflow-hidden border-b border-zinc-800/60">
        {/* Background texture */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-950" />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '8px 8px' }}
        />
        <div className="absolute top-0 left-0 w-64 h-full opacity-[0.04] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at left center, #8b5cf6 0%, transparent 70%)' }}
        />

        <div className="relative max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              {user.avatar ? (
                <Image
                  src={user.avatar}
                  alt={displayName}
                  width={80}
                  height={80}
                  className="rounded-lg ring-2 ring-zinc-700 object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-zinc-800 ring-2 ring-zinc-700 flex items-center justify-center">
                  <span className="font-display text-2xl text-zinc-500">{displayName[0]?.toUpperCase()}</span>
                </div>
              )}
              {/* Online indicator placeholder */}
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-950" />
            </div>

            {/* Name + bio + links */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                  <h1 className="font-display font-bold text-3xl text-white leading-tight tracking-tight">
                    {displayName}
                  </h1>
                  {user.steamId && (
                    <p className="text-xs font-data text-zinc-600 mt-0.5">Steam · {user.steamId}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isOwnProfile ? (
                    <Link
                      href="/profile/edit"
                      className="px-4 py-1.5 rounded text-xs font-data font-semibold uppercase tracking-widest border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                      Edit profile
                    </Link>
                  ) : session ? (
                    <FollowButton targetId={user.id} initialFollowing={isFollowing} />
                  ) : (
                    <Link
                      href="/auth/signin"
                      className="px-4 py-1.5 rounded text-xs font-data font-semibold uppercase tracking-widest bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                    >
                      Sign in to follow
                    </Link>
                  )}
                </div>
              </div>

              {user.bio && (
                <p className="text-sm text-zinc-400 leading-relaxed mb-3 max-w-xl">{user.bio}</p>
              )}

              {/* Social links */}
              {Object.keys(links).some((k) => links[k as keyof SocialLinks]) && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {(Object.keys(SOCIAL_PLATFORMS) as (keyof SocialLinks)[]).map((key) => {
                    const val = links[key]
                    const def = SOCIAL_PLATFORMS[key]
                    if (!val) return null
                    return (
                      <a
                        key={key}
                        href={def.href(val)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 transition-colors text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        <span style={{ color: def.color }}>{def.icon}</span>
                        {def.label}
                      </a>
                    )
                  })}
                </div>
              )}

              {/* Stats row */}
              <div className="flex flex-wrap gap-6">
                {[
                  { label: 'Guides', value: guides.length },
                  { label: 'Followers', value: user._count.followers },
                  { label: 'Following', value: user._count.following },
                  { label: 'Score', value: totalScore > 0 ? `+${totalScore}` : totalScore },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="font-data font-bold text-lg text-white tabular-nums leading-none">{value}</div>
                    <div className="text-[0.65rem] text-zinc-600 uppercase tracking-widest mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {guides.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-display text-xl text-zinc-700">No public guides yet</p>
          </div>
        ) : (
          <>
            {/* Top guides */}
            {topGuides.length > 0 && (
              <section className="mb-12">
                <h2 className="font-display font-semibold text-lg text-white mb-4 tracking-tight flex items-center gap-2">
                  <span className="text-violet-400">▲</span> Top Guides
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topGuides.map((g) => (
                    <GuideCard
                      key={g.id}
                      id={g.id}
                      title={g.title}
                      map={g.map}
                      nodeCount={g.nodeCount}
                      score={g.score}
                      authorName={displayName}
                      authorAvatar={user.avatar}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* All guides */}
            <section>
              <h2 className="font-display font-semibold text-lg text-white mb-4 tracking-tight">
                All Guides
                <span className="ml-2 text-sm font-data text-zinc-600">{guides.length}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {guidesWithScore.map((g) => (
                  <GuideCard
                    key={g.id}
                    id={g.id}
                    title={g.title}
                    map={g.map}
                    nodeCount={g.nodeCount}
                    score={g.score}
                    authorName={displayName}
                    authorAvatar={user.avatar}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
