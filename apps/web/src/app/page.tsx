import { auth, signIn, signOut } from '@/lib/auth'
import Image from 'next/image'
import Link from 'next/link'

export default async function HomePage() {
  const session = await auth()
  const user = session?.user

  async function handleSignOut() {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  async function handleSignIn() {
    'use server'
    await signIn('steam', { redirectTo: '/' })
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">CS2 Annotations</span>

          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/my-guides" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                My Guides
              </Link>
              {user.image && (
                <Image
                  src={user.image}
                  alt={user.name ?? 'avatar'}
                  width={30}
                  height={30}
                  className="rounded-full"
                  unoptimized
                />
              )}
              <span className="text-sm text-zinc-300">{user.name}</span>
              <form action={handleSignOut}>
                <button
                  type="submit"
                  className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors px-3 py-1 rounded border border-zinc-700 hover:border-zinc-500"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <form action={handleSignIn}>
              <button
                type="submit"
                className="text-sm text-zinc-100 bg-zinc-800 hover:bg-zinc-700 transition-colors px-3 py-1 rounded border border-zinc-700"
              >
                Sign in
              </button>
            </form>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold tracking-tight">CS2 Annotations</h1>
        <p className="mt-3 text-zinc-400 text-lg">
          Save and share nade guides for every map.
        </p>
        {!user && (
          <p className="mt-6 text-sm text-zinc-500">
            Sign in with Steam to get started.
          </p>
        )}
      </main>
    </div>
  )
}
