'use client'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

// Client-side so the landing page stays statically rendered. A server-side
// auth() call here would make the whole route dynamic and hit Postgres on every
// request. Renders the signed-out CTA until the session resolves.
export default function HeroCta() {
  const { data: session, status } = useSession()
  const signedIn = status === 'authenticated' && !!session
  // The prerendered HTML is the same for everyone, so the session only arrives
  // after hydration. Hold the secondary button back until it resolves rather
  // than showing a signed-in user "Sign in with Steam" and then swapping it.
  const pending = status === 'loading'

  return (
    <div className="flex gap-3 flex-wrap">
      <Link
        href="/guides"
        className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg transition-colors text-sm"
      >
        Browse Guides
      </Link>
      {pending ? (
        // Keeps the row's height stable so the hero doesn't shift on hydration.
        <span aria-hidden className="px-6 py-3 rounded-lg text-sm font-semibold invisible">
          Sign in with Steam
        </span>
      ) : signedIn ? (
        <Link
          href="/my-guides"
          className="px-6 py-3 border border-zinc-700 hover:border-violet-600/50 text-zinc-300 hover:text-violet-300 font-semibold rounded-lg transition-colors text-sm"
        >
          My Guides →
        </Link>
      ) : (
        <Link
          href="/auth/signin"
          className="px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold rounded-lg transition-colors text-sm"
        >
          Sign in with Steam
        </Link>
      )}
    </div>
  )
}
