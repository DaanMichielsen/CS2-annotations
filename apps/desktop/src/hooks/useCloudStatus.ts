import { useState, useEffect, useCallback } from 'react'
import type { GuideSummary } from '@cs2ann/shared'
import type { GuideSyncState } from '@cs2ann/shared'

export interface CloudStatusResult {
  guides: GuideSummary[]
  statuses: Record<string, GuideSyncState>
  loading: boolean
  refresh: () => void
}

export function useCloudStatus(): CloudStatusResult {
  const [guides, setGuides] = useState<GuideSummary[]>([])
  const [statuses, setStatuses] = useState<Record<string, GuideSyncState>>({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const authState = await window.electronAPI.getAuthState()
    if (!authState?.token) {
      setStatuses({})
      return
    }

    setLoading(true)
    try {
      const list = await window.electronAPI.listGuides()
      const allGuides = list as GuideSummary[]
      setGuides(allGuides)

      const localGuides = allGuides.filter((g) => g.source === 'local')
      const filePaths = localGuides.map((g) => g.id)

      if (filePaths.length === 0) {
        setStatuses({})
        return
      }

      const result = await (window.electronAPI as any).cloudGetAllSyncStates(filePaths)
      const raw = (result as { states: Record<string, { status: string; cloudId?: string; cloudVersion?: number }> }).states

      const resolved: Record<string, GuideSyncState> = {}
      for (const [filePath, state] of Object.entries(raw)) {
        resolved[filePath] = {
          status: state.status as GuideSyncState['status'],
          cloudId: state.cloudId,
          cloudVersion: state.cloudVersion,
        }
      }
      setStatuses(resolved)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const unsub = window.electronAPI.onAuthStateChanged(() => void refresh())
    return unsub
  }, [refresh])

  return { guides, statuses, loading, refresh }
}
