import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { deleteGuideBlob } from '@/lib/blob'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

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

export default async function MyGuidesPage() {
  const session = await auth()
  if (!session) redirect('/auth/signin')

  const guides = await db.guide.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">My Guides</h1>

      {guides.length === 0 ? (
        <p className="text-zinc-400">No guides yet — push one from the desktop app.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {guides.map((guide) => (
            <div
              key={guide.id}
              className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-5 py-4"
            >
              <div>
                <p className="font-semibold text-zinc-100">{guide.title}</p>
                <p className="text-sm text-zinc-400 mt-0.5">
                  {guide.map ?? 'Unknown map'} · {guide.nodeCount} nodes · v{guide.version}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/guides/${guide.id}/edit`}
                  className="px-3 py-1 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded transition-colors"
                >
                  View
                </Link>
                <form action={deleteGuide.bind(null, guide.id)}>
                  <button
                    type="submit"
                    className="px-3 py-1 text-sm bg-red-900 hover:bg-red-800 text-red-100 rounded transition-colors"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
