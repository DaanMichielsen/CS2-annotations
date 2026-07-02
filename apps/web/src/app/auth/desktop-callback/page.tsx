'use client'

import { Suspense, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function DesktopCallbackContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      const token = session.user.id
      // `client=tauri` (set by the Tauri app's authBridge.openSteamSignIn,
      // see apps/desktop-tauri/src/lib/authBridge.ts) travels here inside the
      // /auth/signin `callbackUrl` param rather than as a sibling query param,
      // because /auth/signin only reads `callbackUrl` and threads that single
      // string through NextAuth's redirectTo — anything else would be dropped
      // before reaching this page. Electron never sends `client`, so it keeps
      // defaulting to the `cs2ann://` scheme unchanged.
      const client = searchParams.get('client')
      const scheme = client === 'tauri' ? 'cs2ann-tauri' : 'cs2ann'
      window.location.href = `${scheme}://auth/callback?token=${encodeURIComponent(token)}&name=${encodeURIComponent(session.user.name ?? '')}&avatar=${encodeURIComponent(session.user.image ?? '')}`
    }
  }, [status, session, searchParams])

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

export default function DesktopCallbackPage() {
  return (
    <Suspense fallback={null}>
      <DesktopCallbackContent />
    </Suspense>
  )
}
