'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function DesktopCallbackPage() {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      const token = session.user.id
      window.location.href = `cs2ann://auth/callback?token=${encodeURIComponent(token)}&name=${encodeURIComponent(session.user.name ?? '')}&avatar=${encodeURIComponent(session.user.image ?? '')}`
    }
  }, [status, session])

  if (status === 'loading') return <p className="p-8">Authenticating...</p>
  if (status === 'unauthenticated') return <p className="p-8">Sign-in failed. Please try again.</p>
  return <p className="p-8">Opening CS2 Annotations Manager...</p>
}
