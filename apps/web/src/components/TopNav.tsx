'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { handleSignOut } from '@/app/actions'
import { LeftNavLinks, RightNavLinks } from '@/components/NavLinks'

// Reads the session client-side rather than via auth(). A server-side auth()
// call here would opt every page that renders the nav out of static rendering.
export default function TopNav() {
  const { data: session, status } = useSession()
  // The session now resolves after hydration, so suppress the signed-out state
  // while it is still loading — otherwise a signed-in user sees "Sign in" flash.
  const pending = status === 'loading'

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
        <Link href="/" className="shrink-0 hover:opacity-80 transition-opacity">
          <span className="font-display font-bold text-white">CS2</span>
          <span className="font-display font-semibold text-violet-400"> Annotations</span>
        </Link>

        <div className="h-4 w-px bg-zinc-700" />

        <LeftNavLinks />

        <div className="flex items-center gap-6 ml-auto">
          <RightNavLinks
            isAuthenticated={!!session}
            isAdmin={!!session?.user?.roles?.includes('admin')}
          />

          {session && <div className="h-4 w-px bg-zinc-700" />}

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
                <button
                  type="submit"
                  className="text-xs px-3 py-1.5 text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded transition-colors"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : pending ? (
            // Reserve the button's footprint so the nav doesn't shift on hydration.
            <span aria-hidden className="text-xs px-4 py-1.5 rounded invisible">Sign in</span>
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
  )
}
