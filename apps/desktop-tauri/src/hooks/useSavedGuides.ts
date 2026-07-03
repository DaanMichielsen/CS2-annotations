import { useState, useEffect } from 'react'
import { getAuthState, onAuthStateChanged } from '../lib/authBridge'

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
    const interval = setInterval(fetchGuides, 2 * 60 * 1000)
    const unsub = onAuthStateChanged(() => {
      setGuides([])
      setLoading(true)
      fetchGuides()
    })
    return () => {
      clearInterval(interval)
      unsub()
    }
  }, [])

  return { guides, loading, refresh: fetchGuides }
}
