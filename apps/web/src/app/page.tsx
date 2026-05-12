import { auth, signOut } from '@/lib/auth'
import { db } from '@/lib/db'
import Image from 'next/image'
import Link from 'next/link'
import GuideCard from '@/components/GuideCard'
import MapCarousel from '@/components/MapCarousel'

export const revalidate = 120

export default async function HomePage() {
  const session = await auth()
  const user = session?.user

  async function handleSignOut() {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  const recentGuides = await db.guide.findMany({
    where: { isPublic: true },
    include: {
      user: { select: { username: true, avatar: true, name: true } },
      ratings: { select: { value: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 6,
  })

  const guidesWithScore = recentGuides.map((g) => ({
    ...g,
    score: g.ratings.reduce((acc, r) => acc + r.value, 0),
  }))

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
          <Link href="/" className="shrink-0 hover:opacity-80 transition-opacity">
            <span className="font-display font-bold text-white">CS2</span>
            <span className="font-display font-semibold text-violet-400"> Annotations</span>
          </Link>

          <div className="h-4 w-px bg-zinc-800" />

          <Link href="/guides" className="text-sm text-zinc-400 hover:text-white transition-colors font-medium">
            Browse
          </Link>

          <Link href="/library" className="text-sm text-zinc-400 hover:text-white transition-colors font-medium">
            Library
          </Link>

          {user && (
            <>
              <Link href="/for-you" className="text-sm text-zinc-400 hover:text-white transition-colors font-medium">
                For You
              </Link>
              <Link href="/my-guides" className="text-sm text-zinc-400 hover:text-white transition-colors font-medium">
                My Guides
              </Link>
              <Link href="/saved" className="text-sm text-zinc-400 hover:text-white transition-colors font-medium">
                Saved
              </Link>
              {session?.user?.roles?.includes('admin') && (
                <Link href="/admin" className="text-sm text-violet-400 hover:text-violet-300 transition-colors font-medium">
                  Admin
                </Link>
              )}
            </>
          )}

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <Link href={`/users/${user.id}`} className="flex items-center gap-2 group">
                  {user.image && (
                    <Image src={user.image} alt={user.name ?? 'avatar'} width={28} height={28} className="rounded-full ring-1 ring-zinc-700 group-hover:ring-zinc-500 transition-all" unoptimized />
                  )}
                  <span className="text-sm text-zinc-400 group-hover:text-zinc-200 hidden sm:block transition-colors">{user.name}</span>
                </Link>
                <form action={handleSignOut}>
                  <button type="submit" className="text-xs px-3 py-1.5 text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded transition-colors">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link href="/auth/signin" className="text-xs px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded font-semibold transition-colors">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-800/60">
        {/* Map image carousel — crossfades between map screenshots */}
        <MapCarousel />

        {/* Violet glow on the left where text sits */}
        <div
          className="absolute top-0 left-0 w-[500px] h-full opacity-[0.06] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at left center, #8b5cf6 0%, transparent 70%)' }}
        />

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="flex justify-between gap-8">
            <div className="max-w-2xl py-24 sm:py-32">
              <p className="font-data text-violet-400 text-xs uppercase tracking-[0.25em] mb-4">
                Community · Precision · Knowledge
              </p>
              <h1 className="font-display font-bold text-5xl sm:text-6xl text-white leading-[0.95] tracking-tight mb-6">
                KNOW EVERY<br />
                <span className="text-violet-400">ANGLE.</span>
              </h1>
              <p className="text-zinc-400 text-lg leading-relaxed mb-8 max-w-lg">
                Annotated nade guides built in-game and shared with the community.
                Study lineups, discover new spots, master every map.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link
                  href="/guides"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  Browse Guides
                </Link>
                {!user && (
                  <Link
                    href="/auth/signin"
                    className="px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold rounded-lg transition-colors text-sm"
                  >
                    Sign in with Steam
                  </Link>
                )}
                {user && (
                  <Link
                    href="/my-guides"
                    className="px-6 py-3 border border-zinc-700 hover:border-violet-600/50 text-zinc-300 hover:text-violet-300 font-semibold rounded-lg transition-colors text-sm"
                  >
                    My Guides →
                  </Link>
                )}
              </div>
            </div>

            {/* Agent skin — stretches to hero height, image fills 4/5 from bottom */}
            <div className="hidden lg:block shrink-0 pointer-events-none select-none" aria-hidden="true">
              <div className="h-full flex items-end">
                <Image
                  src="/agents/bloody_darryl_the_strapped.webp"
                  alt=""
                  width={260}
                  height={430}
                  className="h-4/5 w-auto object-contain object-bottom"
                  style={{ filter: 'drop-shadow(-8px 0 48px rgba(139,92,246,0.35))' }}
                  unoptimized
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent guides */}
      {guidesWithScore.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-semibold text-2xl text-white tracking-tight">
              Recent Guides
            </h2>
            <Link href="/guides" className="text-sm text-zinc-500 hover:text-violet-400 transition-colors">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {guidesWithScore.map((g) => (
              <GuideCard
                key={g.id}
                id={g.id}
                title={g.title}
                map={g.map}
                score={g.score}
                authorName={g.user.username ?? g.user.name}
                authorAvatar={g.user.avatar}
              />
            ))}
          </div>
        </section>
      )}

      {guidesWithScore.length === 0 && (
        <section className="max-w-7xl mx-auto px-6 py-24 text-center">
          <p className="font-display font-semibold text-2xl text-zinc-700 mb-2">No public guides yet</p>
          <p className="text-zinc-700 text-sm">Be the first to push and publish a guide from the desktop app.</p>
        </section>
      )}
    </div>
  )
}
