'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

export default function DesktopCallbackPage() {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      const token = session.user.id
      window.location.href = `cs2ann://auth/callback?token=${encodeURIComponent(token)}&name=${encodeURIComponent(session.user.name ?? '')}&avatar=${encodeURIComponent(session.user.image ?? '')}`
    }
  }, [status, session])

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-center px-4">
      <div className="mb-6">
        <span className="font-display font-bold text-white text-2xl">CS2</span>
        <span className="font-display font-semibold text-violet-400 text-2xl"> Annotations</span>
      </div>

      {status === 'loading' && (
        <>
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin mb-4" />
          <p className="text-zinc-400 text-sm">Authenticating…</p>
        </>
      )}

      {status === 'authenticated' && (
        <>
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin mb-4" />
          <p className="text-zinc-400 text-sm">Opening CS2 Annotations desktop app…</p>
          <p className="text-zinc-600 text-xs mt-2">You can close this tab once the app opens.</p>
        </>
      )}

      {status === 'unauthenticated' && (
        <>
          <p className="text-red-400 text-sm mb-4">Sign-in failed. Please try again.</p>
          <Link
            href="/auth/signin"
            className="text-xs px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors"
          >
            Back to sign in
          </Link>
        </>
      )}
    </div>
  )
}
