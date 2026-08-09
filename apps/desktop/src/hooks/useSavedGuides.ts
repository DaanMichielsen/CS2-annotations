import { useState, useEffect } from 'react'

export interface SavedGuide {
  savedId: string
  id: string
  title: string
  map: string | null
  nodeCount: number
  version: number
  isPublic: boolean
  authorName: string | null
  downloadUrl: string | null
}

const WEB_API = 'https://cs2annotations.com/api'

export function useSavedGuides(): { guides: SavedGuide[]; loading: boolean; refresh: () => void } {
  const [guides, setGuides] = useState<SavedGuide[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGuides = () => {
    window.electronAPI.getAuthState().then((authState: { token: string | null } | null) => {
      if (!authState?.token) {
        setGuides([])
        setLoading(false)
        return
      }
      setLoading(true)
      fetch(`${WEB_API}/saved-guides`, {
        headers: { Authorization: `Bearer ${authState.token}` },
      })
        .then((r) => {
          if (!r.ok) return { guides: [] as SavedGuide[] }
          return r.json() as Promise<{ guides: SavedGuide[] }>
        })
        .then((data) => setGuides(data.guides ?? []))
        .catch(() => setGuides([]))
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => {
    fetchGuides()

    // Refresh on focus, not on a 2-minute timer: that poll was shorter than
    // Neon's 5-minute scale-to-zero window, so one open app kept the database
    // awake around the clock. Mirrors apps/desktop-tauri.
    const onFocus = () => fetchGuides()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(fetchGuides, 30 * 60 * 1000)
    const unsub = window.electronAPI.onAuthStateChanged(() => {
      setGuides([])
      setLoading(true)
      fetchGuides()
    })
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
      unsub()
    }
  }, [])

  return { guides, loading, refresh: fetchGuides }
}
