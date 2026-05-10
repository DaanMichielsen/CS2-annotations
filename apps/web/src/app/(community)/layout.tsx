import Link from 'next/link'
import Image from 'next/image'
import { auth, signOut } from '@/lib/auth'

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  async function handleSignOut() {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
          <Link href="/" className="shrink-0 hover:opacity-80 transition-opacity">
            <span className="font-display font-bold text-white">CS2</span>
            <span className="font-display font-semibold text-violet-400"> Annotations</span>
          </Link>

          <div className="h-4 w-px bg-zinc-700" />

          <Link
            href="/guides"
            className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
          >
            Browse
          </Link>

          <Link
            href="/library"
            className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
          >
            Library
          </Link>

          {session && (
            <>
              <Link
                href="/for-you"
                className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
              >
                For You
              </Link>
              <Link
                href="/my-guides"
                className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
              >
                My Guides
              </Link>
            </>
          )}

          <div className="flex items-center gap-3 ml-auto">
            {session ? (
              <>
                <Link href={`/users/${session.user?.id}`} className="flex items-center gap-2 group">
                  {session.user?.image && (
                    <Image
                      src={session.user.image}
                      alt="avatar"
                      width={28}
                      height={28}
                      className="rounded-full ring-1 ring-zinc-700 group-hover:ring-zinc-500 transition-all"
                      unoptimized
                    />
                  )}
                  <span className="text-sm text-zinc-400 group-hover:text-zinc-200 hidden sm:block transition-colors">
                    {session.user?.name}
                  </span>
                </Link>
                <form action={handleSignOut}>
                  <button type="submit" className="text-xs px-3 py-1.5 text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded transition-colors">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="text-xs px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded font-semibold transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <footer className="border-t border-zinc-800/60 mt-24 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-zinc-600">
          <span>
            <span className="font-display font-bold text-zinc-500">CS2</span>
            <span className="font-display font-semibold text-violet-800"> Annotations</span>
          </span>
          <span>Community annotation guides for Counter-Strike 2</span>
        </div>
      </footer>
    </div>
  )
}
