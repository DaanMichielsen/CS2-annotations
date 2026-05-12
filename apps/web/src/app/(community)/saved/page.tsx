import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import Link from 'next/link'
import GuideCard from '@/components/GuideCard'

export default async function SavedGuidesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const saved = await db.savedGuide.findMany({
    where: { userId: session.user.id },
    orderBy: { savedAt: 'desc' },
    include: {
      guide: {
        include: {
          user: { select: { username: true, avatar: true, name: true } },
          ratings: { select: { value: true } },
        },
      },
    },
  })

  const guides = saved.map((s) => ({
    ...s.guide,
    score: s.guide.ratings.reduce((acc, r) => acc + r.value, 0),
  }))

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-3xl text-white tracking-tight mb-1">Saved Guides</h1>
          <p className="text-zinc-600 text-sm">
            {guides.length === 0
              ? 'No saved guides yet — browse guides and click Save to add them here.'
              : `${guides.length} saved guide${guides.length !== 1 ? 's' : ''} · pull them into the desktop app`}
          </p>
        </div>
        <Link
          href="/guides"
          className="text-xs px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-lg transition-colors"
        >
          Browse guides →
        </Link>
      </div>

      {guides.length === 0 ? (
        <div className="text-center py-24 border border-zinc-800/60 rounded-xl">
          <p className="font-display font-semibold text-xl text-zinc-600 mb-2">Nothing saved yet</p>
          <p className="text-zinc-700 text-sm mb-6">
            Find a guide you like and hit the Save button to add it here.
          </p>
          <Link
            href="/guides"
            className="inline-flex px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Browse guides
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {guides.map((g) => (
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
      )}
    </div>
  )
}
