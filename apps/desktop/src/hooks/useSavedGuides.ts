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
    const token = (window as any).electronAPI?.getAuthStateSync?.() ??
      localStorage.getItem('authToken')

    window.electronAPI.getAuthState().then((authState: { token: string | null } | null) => {
      if (!authState?.token) {
        setGuides([])
        setLoading(false)
        return
      }
      fetch(`${WEB_API}/saved-guides`, {
        headers: { Authorization: `Bearer ${authState.token}` },
      })
        .then((r) => r.json() as Promise<{ guides: SavedGuide[] }>)
        .then((data) => setGuides(data.guides ?? []))
        .catch(() => setGuides([]))
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => {
    fetchGuides()
    const interval = setInterval(fetchGuides, 5 * 60 * 1000)
    const unsub = window.electronAPI.onAuthStateChanged(() => {
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
