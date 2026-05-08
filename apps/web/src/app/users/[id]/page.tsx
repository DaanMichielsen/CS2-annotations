import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import GuideCard from '@/components/GuideCard'
import FollowButton from '@/components/FollowButton'

type SocialLinks = { steam?: string; youtube?: string; twitch?: string; kick?: string; discord?: string }

const SOCIAL_ICONS: Record<string, { label: string; icon: React.ReactNode; color: string; href: (v: string) => string }> = {
  steam: {
    label: 'Steam',
    color: '#c7d5e0',
    href: (v) => v.startsWith('http') ? v : `https://steamcommunity.com/id/${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.524s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.711L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
      </svg>
    ),
  },
  youtube: {
    label: 'YouTube',
    color: '#ff0000',
    href: (v) => v.startsWith('http') ? v : `https://youtube.com/@${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  twitch: {
    label: 'Twitch',
    color: '#9146ff',
    href: (v) => v.startsWith('http') ? v : `https://twitch.tv/${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
      </svg>
    ),
  },
  kick: {
    label: 'Kick',
    color: '#53fc18',
    href: (v) => v.startsWith('http') ? v : `https://kick.com/${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2 2h4v8l4-8h4l-5 9 5 11h-4l-4-9v9H2z"/>
      </svg>
    ),
  },
  discord: {
    label: 'Discord',
    color: '#5865f2',
    href: (v) => v.startsWith('http') ? v : `https://discord.com/users/${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.101 18.08.113 18.1.132 18.114a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
  },
}

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
                  {Object.entries(SOCIAL_ICONS).map(([key, def]) => {
                    const val = links[key as keyof SocialLinks]
                    if (!val) return null
                    return (
                      <a
                        key={key}
                        href={def.href(val)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 transition-colors text-xs text-zinc-400 hover:text-zinc-200"
                        style={{ '--link-color': def.color } as React.CSSProperties}
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
