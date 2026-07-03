import { useState, useEffect, useCallback } from 'react'
import type { GuideSummary, GuideSyncState } from '@cs2ann/shared'
import { getAuthState, onAuthStateChanged } from '../lib/authBridge'
import { cloudGetAllSyncStates } from '../lib/cloudApi'
import { createTauriAdapter } from '../adapters/TauriAdapter'

const adapter = createTauriAdapter()

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
    const authState = await getAuthState()
    if (!authState.token) {
      setStatuses({})
      return
    }
    setLoading(true)
    try {
      const allGuides = await adapter.listGuides()
      setGuides(allGuides)
      const localGuides = allGuides.filter((g) => g.source === 'local')
      const filePaths = localGuides.map((g) => g.id)
      if (filePaths.length === 0) {
        setStatuses({})
        return
      }
      const { states } = await cloudGetAllSyncStates(filePaths)
      const resolved: Record<string, GuideSyncState> = {}
      for (const [filePath, state] of Object.entries(states as Record<string, { status: string; cloudId?: string; cloudVersion?: number }>)) {
        resolved[filePath] = { status: state.status as GuideSyncState['status'], cloudId: state.cloudId, cloudVersion: state.cloudVersion }
      }
      setStatuses(resolved)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const unsub = onAuthStateChanged(() => void refresh())
    return unsub
  }, [refresh])

  return { guides, statuses, loading, refresh }
}
