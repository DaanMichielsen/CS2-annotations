'use client'
import { useState } from 'react'
import { Bookmark } from 'lucide-react'

interface Props {
  guideId: string
  initialSaved: boolean
  isAuthenticated: boolean
}

export default function SaveButton({ guideId, initialSaved, isAuthenticated }: Props) {
  const [saved, setSaved] = useState(initialSaved)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!isAuthenticated) {
      window.location.href = '/auth/signin'
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/guides/${guideId}/save`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as { saved: boolean }
        setSaved(data.saved)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
        saved
          ? 'bg-violet-950/60 border-violet-700 text-violet-300 hover:bg-violet-950 hover:border-violet-600'
          : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600'
      }`}
      title={saved ? 'Remove from saved guides' : 'Save guide to desktop app library'}
    >
      <Bookmark
        size={15}
        className={saved ? 'fill-violet-400 text-violet-400' : 'text-zinc-400'}
      />
      {saved ? 'Saved' : 'Save guide'}
    </button>
  )
}
