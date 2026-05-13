'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Pencil, Trash2, Check, X } from 'lucide-react'

interface Comment {
  id: string
  body: string
  createdAt: string | Date
  user: { id: string; username: string | null; avatar: string | null; name: string | null }
}

interface Props {
  guideId: string
  initialComments: Comment[]
  isAuthenticated?: boolean
  currentUserId?: string | null
}

function formatDate(raw: string | Date) {
  const d = new Date(raw)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function CommentThread({ guideId, initialComments, isAuthenticated, currentUserId }: Props) {
  const [comments, setComments] = useState(initialComments)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editSaving, setEditSaving] = useState(false)

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

  function startEdit(c: Comment) {
    setEditingId(c.id)
    setEditBody(c.body)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditBody('')
  }

  async function saveEdit(commentId: string) {
    if (!editBody.trim() || editSaving) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/guides/${guideId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editBody }),
      })
      if (res.ok) {
        setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, body: editBody } : c))
        setEditingId(null)
      } else {
        setError('Failed to save edit.')
      }
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteComment(commentId: string) {
    if (!confirm('Delete this comment?')) return
    const res = await fetch(`/api/guides/${guideId}/comments/${commentId}`, { method: 'DELETE' })
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } else {
      setError('Failed to delete comment.')
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
          const isOwn = currentUserId === c.user.id
          const isEditing = editingId === c.id

          return (
            <div key={c.id} className="flex gap-3">
              <Link href={`/users/${c.user.id}`} className="shrink-0 mt-0.5">
                {c.user.avatar ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-zinc-700 hover:ring-zinc-500 transition-all">
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
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 hover:border-zinc-500 transition-colors" />
                )}
              </Link>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <Link href={`/users/${c.user.id}`} className="text-sm font-semibold text-zinc-200 hover:text-white transition-colors">
                    {displayName}
                  </Link>
                  <span className="text-xs font-data text-zinc-600">{formatDate(c.createdAt)}</span>
                  {isOwn && !isEditing && (
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => startEdit(c)}
                        className="text-zinc-600 hover:text-zinc-400 transition-colors p-0.5"
                        title="Edit comment"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="text-zinc-600 hover:text-red-400 transition-colors p-0.5"
                        title="Delete comment"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="flex gap-2 mt-1">
                    <input
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-400 transition-colors"
                      autoFocus
                    />
                    <button
                      onClick={() => saveEdit(c.id)}
                      disabled={editSaving || !editBody.trim()}
                      className="p-1.5 text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-300 leading-relaxed">{c.body}</p>
                )}
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
