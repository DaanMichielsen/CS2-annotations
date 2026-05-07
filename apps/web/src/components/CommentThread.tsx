'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Comment {
  id: string
  body: string
  createdAt: string | Date
  user: { username: string | null; avatar: string | null; name: string | null }
}

interface Props {
  guideId: string
  initialComments: Comment[]
  isAuthenticated?: boolean
}

export default function CommentThread({ guideId, initialComments, isAuthenticated }: Props) {
  const [comments, setComments] = useState(initialComments)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/guides/${guideId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.ok) {
        const { comment } = await res.json()
        setComments((c) => [...c, comment])
        setBody('')
      } else if (res.status === 401) {
        window.location.href = '/auth/signin'
      } else {
        setError('Failed to post comment.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h3 className="font-display font-semibold text-base text-zinc-300 uppercase tracking-wider mb-5">
        Discussion <span className="text-zinc-600 font-data normal-case text-sm ml-1">({comments.length})</span>
      </h3>

      {comments.length === 0 && (
        <p className="text-zinc-600 text-sm mb-6">No comments yet. Be the first to share a tip or question.</p>
      )}

      <div className="space-y-5 mb-8">
        {comments.map((c) => {
          const displayName = c.user.username ?? c.user.name ?? 'Anonymous'
          const date = new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
          return (
            <div key={c.id} className="flex gap-3">
              {c.user.avatar ? (
                <div className="w-8 h-8 shrink-0 mt-0.5 rounded-full overflow-hidden ring-1 ring-zinc-700">
                  <Image
                    src={c.user.avatar}
                    alt={displayName}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-semibold text-zinc-200">{displayName}</span>
                  <span className="text-xs font-data text-zinc-600">{date}</span>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{c.body}</p>
              </div>
            </div>
          )
        })}
      </div>

      {isAuthenticated ? (
        <form onSubmit={submit} className="flex gap-3">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share a tip, question, or update…"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
          >
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </form>
      ) : (
        <a
          href="/auth/signin"
          className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          Sign in to join the discussion →
        </a>
      )}

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}
