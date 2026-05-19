import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import GuideCard from '@/components/GuideCard'

export const revalidate = 60

export default async function ForYouPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const follows = await db.follow.findMany({
    where: { followerId: session.user.id },
    select: { followingId: true },
  })

  const followingIds = follows.map((f) => f.followingId)

  if (followingIds.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          </div>
          <h1 className="font-display font-bold text-2xl text-white mb-2">Your feed is empty</h1>
          <p className="text-zinc-500 text-sm mb-6 max-w-sm mx-auto">
            Follow players to see their guides here. Browse the community to find creators you like.
          </p>
          <Link
            href="/guides"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            Browse guides
          </Link>
        </div>
      </div>
    )
  }

  const guides = await db.guide.findMany({
    where: { userId: { in: followingIds }, isPublic: true },
    include: {
      user: { select: { id: true, username: true, name: true, avatar: true } },
      ratings: { select: { value: true } },
      _count: { select: { annotationMedia: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 48,
  })

  const guidesWithScore = guides.map((g) => ({
    ...g,
    score: g.ratings.reduce((a, r) => a + r.value, 0),
  }))

  // Group by author for display
  const byAuthor = followingIds.reduce<Record<string, typeof guidesWithScore>>((acc, id) => {
    acc[id] = guidesWithScore.filter((g) => g.userId === id)
    return acc
  }, {})

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-white tracking-tight mb-1">For You</h1>
        <p className="text-sm text-zinc-500 font-data">
          Latest guides from {followingIds.length} player{followingIds.length !== 1 ? 's' : ''} you follow
        </p>
      </div>

      {guidesWithScore.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-600 font-display text-lg">No guides published yet</p>
          <p className="text-zinc-700 text-sm mt-1">The people you follow haven&apos;t published any public guides yet.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(byAuthor)
            .filter(([, gs]) => gs.length > 0)
            .map(([authorId, authorGuides]) => {
              const author = authorGuides[0].user
              const authorName = author.username ?? author.name ?? 'Anonymous'
              return (
                <section key={authorId}>
                  {/* Author header */}
                  <div className="flex items-center gap-3 mb-4">
                    <Link href={`/users/${authorId}`} className="flex items-center gap-2.5 group">
                      {author.avatar ? (
                        <Image
                          src={author.avatar}
                          alt={authorName}
                          width={28}
                          height={28}
                          className="rounded-full ring-1 ring-zinc-700 group-hover:ring-zinc-500 transition-all"
                          unoptimized
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-zinc-800 ring-1 ring-zinc-700" />
                      )}
                      <span className="font-display font-semibold text-sm text-zinc-300 group-hover:text-white transition-colors">
                        {authorName}
                      </span>
                    </Link>
                    <span className="text-zinc-700 text-xs font-data">
                      {authorGuides.length} guide{authorGuides.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {authorGuides.map((g) => (
                      <GuideCard
                        key={g.id}
                        id={g.id}
                        title={g.title}
                        map={g.map}
                        score={g.score}
                        authorName={authorName}
                        authorAvatar={author.avatar}
                        mediaCount={g._count.annotationMedia}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
        </div>
      )}
    </div>
  )
}
