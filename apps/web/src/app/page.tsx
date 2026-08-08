import Image from 'next/image'
import Link from 'next/link'
import GuideCard from '@/components/GuideCard'
import HeroCta from '@/components/HeroCta'
import MapCarousel from '@/components/MapCarousel'
import TopNav from '@/components/TopNav'
import { getRecentPublicGuides } from '@/lib/queries'

export const revalidate = 120

// No auth() call — the signed-in/signed-out CTA lives in <HeroCta/>, which
// resolves the session client-side. That keeps this route statically rendered
// so crawler traffic is served from the cache and never reaches Postgres.
export default async function HomePage() {
  const guidesWithScore = await getRecentPublicGuides(6)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <TopNav />

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
              <HeroCta />
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
                authorName={g.authorName}
                authorAvatar={g.authorAvatar}
                mediaCount={g.mediaCount}
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
