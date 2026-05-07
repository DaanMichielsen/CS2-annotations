'use client'

import { GuideAdapterProvider } from '@cs2ann/ui'
import { createCloudAdapter } from '@/adapters/CloudAdapter'

const adapter = createCloudAdapter()

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <GuideAdapterProvider adapter={adapter}>{children}</GuideAdapterProvider>
}
