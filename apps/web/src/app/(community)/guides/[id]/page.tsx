import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import Image from 'next/image'
import RatingButtons from '@/components/RatingButtons'
import CommentThread from '@/components/CommentThread'
import { getMapColor, getMapLabel } from '@/lib/mapColors'

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

  const score = guide.ratings.reduce((acc, r) => acc + r.value, 0)
  const userVote = session?.user?.id
    ? (guide.ratings.find((r) => r.userId === session.user!.id)?.value ?? null)
    : null

  const isOwner = session?.user?.id === guide.userId
  const authorName = guide.user.username ?? guide.user.name ?? 'Anonymous'
  const { accent, dim } = getMapColor(guide.map)
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
              <span
                className="text-[0.65rem] font-data uppercase tracking-widest px-2 py-0.5 rounded font-semibold"
                style={{ backgroundColor: dim, color: accent }}
              >
                {mapLabel}
              </span>
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
                <Image
                  src={guide.user.avatar}
                  alt={authorName}
                  width={24}
                  height={24}
                  className="rounded-full ring-1 ring-zinc-700"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700" />
              )}
              <span className="text-sm text-zinc-400">{authorName}</span>
              <span className="text-zinc-700 text-xs font-data mx-1">·</span>
              <span className="text-xs font-data text-zinc-600">{guide.nodeCount} annotations</span>
              <span className="text-zinc-700 text-xs font-data mx-1">·</span>
              <span className="text-xs font-data text-zinc-600">v{guide.version}</span>
            </div>
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
