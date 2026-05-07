'use client'

import { useState } from 'react'

interface Props {
  guideId: string
  initialScore: number
  userVote?: number | null
}

export default function RatingButtons({ guideId, initialScore, userVote }: Props) {
  const [score, setScore] = useState(initialScore)
  const [voted, setVoted] = useState<number | null>(userVote ?? null)
  const [loading, setLoading] = useState(false)

  async function vote(value: 1 | -1) {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/guides/${guideId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      if (res.ok) {
        const data = await res.json()
        setScore(data.score)
        setVoted(value)
      } else if (res.status === 401) {
        window.location.href = '/auth/signin'
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => vote(1)}
        disabled={loading}
        className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-colors ${
          voted === 1
            ? 'bg-violet-600 text-white'
            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-violet-400'
        }`}
        title="Upvote"
        aria-label="Upvote"
      >
        ▲
      </button>
      <span className="w-8 text-center font-data text-sm font-semibold text-zinc-300">
        {score}
      </span>
      <button
        onClick={() => vote(-1)}
        disabled={loading}
        className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-colors ${
          voted === -1
            ? 'bg-red-800 text-white'
            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400'
        }`}
        title="Downvote"
        aria-label="Downvote"
      >
        ▼
      </button>
    </div>
  )
}
