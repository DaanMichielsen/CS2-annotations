import { useState, useEffect } from 'react'
import { getAuthState, onAuthStateChanged } from '../lib/authBridge'
import { WEB_API } from '../lib/cloudApi'

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

export function useSavedGuides(): { guides: SavedGuide[]; loading: boolean; refresh: () => void } {
  const [guides, setGuides] = useState<SavedGuide[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGuides = () => {
    getAuthState().then((authState) => {
      if (!authState.token) {
        setGuides([])
        setLoading(false)
        return
      }
      setLoading(true)
      fetch(`${WEB_API}/saved-guides`, { headers: { Authorization: `Bearer ${authState.token}` } })
        .then((r) => (r.ok ? (r.json() as Promise<{ guides: SavedGuide[] }>) : { guides: [] }))
        .then((data) => setGuides(data.guides ?? []))
        .catch(() => setGuides([]))
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => {
    fetchGuides()

    // Refresh when the window regains focus rather than on a short timer. The
    // old 2-minute poll was shorter than Neon's 5-minute scale-to-zero window,
    // so a single app left open pinned the database awake 24/7. The long
    // interval is only a backstop for an app that stays focused for hours.
    const onFocus = () => fetchGuides()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(fetchGuides, 30 * 60 * 1000)
    const unsub = onAuthStateChanged(() => {
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
