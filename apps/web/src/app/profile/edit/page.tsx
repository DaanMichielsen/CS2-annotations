'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type SocialLinks = { steam?: string; youtube?: string; twitch?: string; kick?: string; discord?: string }

const PLATFORMS = [
  { key: 'steam',   label: 'Steam',   placeholder: 'steamcommunity.com/id/yourname or username' },
  { key: 'youtube', label: 'YouTube', placeholder: '@yourchannel or full URL' },
  { key: 'twitch',  label: 'Twitch',  placeholder: 'your Twitch username' },
  { key: 'kick',    label: 'Kick',    placeholder: 'your Kick username' },
  { key: 'discord', label: 'Discord', placeholder: 'your Discord username' },
]

export default function EditProfilePage() {
  const router = useRouter()
  const [bio, setBio] = useState('')
  const [links, setLinks] = useState<SocialLinks>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        setBio(data.bio ?? '')
        setLinks(data.socialLinks ?? {})
        setAvatar(data.avatar ?? null)
        setName(data.username ?? data.name ?? '')
        setLoading(false)
      })
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio, socialLinks: links }),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-600 font-data text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          {avatar ? (
            <Image src={avatar} alt={name} width={52} height={52} className="rounded-lg ring-2 ring-zinc-700" unoptimized />
          ) : (
            <div className="w-13 h-13 rounded-lg bg-zinc-800 ring-2 ring-zinc-700" />
          )}
          <div>
            <h1 className="font-display font-bold text-2xl text-white">{name}</h1>
            <p className="text-xs text-zinc-600 font-data mt-0.5">Edit your public profile</p>
          </div>
        </div>

        {/* Bio */}
        <div className="mb-6">
          <label className="block text-xs font-data text-zinc-500 uppercase tracking-widest mb-2">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Tell the community about yourself…"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-600 resize-none"
          />
          <p className="text-xs text-zinc-700 font-data mt-1 text-right">{bio.length}/300</p>
        </div>

        {/* Social links */}
        <div className="mb-8">
          <label className="block text-xs font-data text-zinc-500 uppercase tracking-widest mb-3">Social Links</label>
          <div className="space-y-3">
            {PLATFORMS.map(({ key, label, placeholder }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-16 text-xs font-data text-zinc-500 shrink-0">{label}</span>
                <input
                  type="text"
                  value={links[key as keyof SocialLinks] ?? ''}
                  onChange={(e) => setLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-600"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          {saved && (
            <span className="text-xs font-data text-emerald-400">✓ Saved</span>
          )}
        </div>
      </div>
    </div>
  )
}
