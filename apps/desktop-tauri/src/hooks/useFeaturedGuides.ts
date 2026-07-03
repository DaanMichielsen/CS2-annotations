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
    const interval = setInterval(fetchGuides, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return { guides, loading }
}
