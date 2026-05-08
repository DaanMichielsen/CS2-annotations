'use client'

import { useState, useTransition } from 'react'

interface Props {
  targetId: string
  initialFollowing: boolean
}

export default function FollowButton({ targetId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const res = await fetch(`/api/users/${targetId}/follow`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setFollowing(data.following)
      }
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`px-4 py-1.5 rounded text-xs font-data font-semibold uppercase tracking-widest transition-all duration-200 border ${
        following
          ? 'bg-transparent border-zinc-600 text-zinc-400 hover:border-red-800 hover:text-red-400'
          : 'bg-violet-600 hover:bg-violet-500 border-violet-600 text-white'
      } disabled:opacity-50`}
    >
      {pending ? '···' : following ? 'Following' : 'Follow'}
    </button>
  )
}
