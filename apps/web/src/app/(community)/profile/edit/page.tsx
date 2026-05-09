'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { SOCIAL_PLATFORMS, STEAM_PLATFORM, SocialIcon, type SocialLinks } from '@/components/SocialIcons'

export default function EditProfilePage() {
  const router = useRouter()
  const [bio, setBio] = useState('')
  const [links, setLinks] = useState<SocialLinks>({})
  const [steamId, setSteamId] = useState<string | null>(null)
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
        setSteamId(data.steamId ?? null)
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

  const editablePlatforms = Object.keys(SOCIAL_PLATFORMS)

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-600 font-data text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-12 text-zinc-100">
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

        {/* Linked accounts */}
        <div className="mb-8">
          <label className="block text-xs font-data text-zinc-500 uppercase tracking-widest mb-3">Linked Accounts</label>
          <div className="space-y-2.5">

            {/* Steam — always shown, locked to authenticated account */}
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 flex items-center justify-center rounded bg-zinc-900 border border-zinc-800 shrink-0" title="Steam">
                <SocialIcon def={STEAM_PLATFORM} />
              </span>
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded text-sm text-zinc-500 select-none">
                {steamId
                  ? <span className="truncate">{STEAM_PLATFORM.href(steamId)}</span>
                  : <span className="text-zinc-700">No Steam account linked</span>
                }
              </div>
              <span className="flex items-center gap-1 text-[10px] font-data text-emerald-600 shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z" />
                </svg>
                Verified
              </span>
            </div>

            {/* Editable platforms — currently empty pending OAuth integrations */}
            {editablePlatforms.map((key) => {
              const def = SOCIAL_PLATFORMS[key]
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-7 h-7 flex items-center justify-center rounded bg-zinc-900 border border-zinc-800 shrink-0" title={def.label}>
                    <SocialIcon def={def} />
                  </span>
                  <input
                    type="text"
                    value={links[key] ?? ''}
                    onChange={(e) => setLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={def.placeholder}
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-600"
                  />
                </div>
              )
            })}

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
  )
}
