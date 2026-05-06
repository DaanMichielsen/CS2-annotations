import { createContext, useContext, type ReactNode } from 'react'
import type { GuideAdapter } from '@cs2ann/shared'

const GuideAdapterContext = createContext<GuideAdapter | null>(null)

export function GuideAdapterProvider({ adapter, children }: { adapter: GuideAdapter; children: ReactNode }) {
  return <GuideAdapterContext.Provider value={adapter}>{children}</GuideAdapterContext.Provider>
}

export function useGuideAdapter(): GuideAdapter {
  const ctx = useContext(GuideAdapterContext)
  if (!ctx) {
    throw new Error('useGuideAdapter must be used within GuideAdapterProvider')
  }
  return ctx
}
