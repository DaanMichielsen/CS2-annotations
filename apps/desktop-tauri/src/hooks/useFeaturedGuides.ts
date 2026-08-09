import { useState, useEffect } from 'react'
import { WEB_API } from '../lib/cloudApi'

export interface FeaturedGuide {
  id: string
  title: string
  map: string | null
  nodeCount: number
  credits: Array<{ handle: string; label: string | null }>
}

export function useFeaturedGuides(): { guides: FeaturedGuide[]; loading: boolean } {
  const [guides, setGuides] = useState<FeaturedGuide[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGuides = () => {
      fetch(`${WEB_API}/featured-guides`)
        .then((r) => r.json() as Promise<{ guides: FeaturedGuide[] }>)
        .then((data) => setGuides(data.guides))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
    fetchGuides()

    // Featured guides change rarely; a 5-minute poll kept Neon's compute from
    // ever scaling to zero. Refresh on focus plus a long backstop instead.
    const onFocus = () => fetchGuides()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(fetchGuides, 30 * 60 * 1000)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [])

  return { guides, loading }
}
