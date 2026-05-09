import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function EditGuidePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-xl font-semibold text-zinc-100 mb-3">Browser editor coming soon</h1>
      <p className="text-zinc-400 mb-6">
        Guide editing in the browser is not yet available. Open the desktop app to edit this guide,
        then push your changes to the cloud.
      </p>
      <Link
        href="/my-guides"
        className="text-sm text-zinc-300 hover:text-zinc-100 underline underline-offset-2"
      >
        Back to My Guides
      </Link>
    </div>
  )
}
