import { useState } from 'react'
import { GuideAdapterProvider, Guides, Settings, TopNav } from '@cs2ann/ui'
import { createLocalAdapter } from './adapters/LocalAdapter'
import AuthButton from './components/AuthButton'
import CloudPanel from './components/CloudPanel'
import { useCloudStatus } from './hooks/useCloudStatus'
import { useFeaturedGuides } from './hooks/useFeaturedGuides'
import { useSavedGuides } from './hooks/useSavedGuides'

const adapter = createLocalAdapter()

function AppInner() {
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [syncDotColor, setSyncDotColor] = useState('')
  const [syncStatusText, setSyncStatusText] = useState('')

  const cloudStatus = useCloudStatus()
  const featuredGuides = useFeaturedGuides()
  const savedGuides = useSavedGuides()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <TopNav
        onOpenSettings={() => setShowSettings(true)}
        authSlot={<AuthButton />}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        syncDotColor={syncDotColor}
        syncStatusText={syncStatusText}
      />
      <main className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-4">
          <Guides
            cloudStatuses={cloudStatus.statuses}
            onCloudRefresh={cloudStatus.refresh}
            featuredGuides={featuredGuides.guides}
            featuredGuidesLoading={featuredGuides.loading}
            onFeaturedFork={async (guideId, title) => {
              const result = await (window.electronAPI as any).featuredFork(guideId, title)
              if (result?.error) return { error: result.error }
              cloudStatus.refresh()
            }}
            savedGuides={savedGuides.guides}
            savedGuidesLoading={savedGuides.loading}
            onSavedRefresh={savedGuides.refresh}
            onSavedPull={async (guide) => {
              if (!guide.downloadUrl) return { error: 'No download URL available' }
              const result = await (window.electronAPI as any).savedPullGuide({
                guideId: guide.id,
                title: guide.title,
                downloadUrl: guide.downloadUrl,
              })
              if (result?.error) return { error: result.error }
              cloudStatus.refresh()
            }}
          />
        </div>

        {sidebarOpen && (
          <div className="w-72 shrink-0 border-l border-zinc-800 flex flex-col overflow-hidden">
            <CloudPanel
              guides={cloudStatus.guides}
              statuses={cloudStatus.statuses}
              loading={cloudStatus.loading}
              onRefresh={cloudStatus.refresh}
              onStatusChange={(color, text) => { setSyncDotColor(color); setSyncStatusText(text) }}
            />
            <div className="mt-auto shrink-0 p-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => void window.electronAPI.openCommunity()}
                className="w-full text-xs px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors text-left"
              >
                Browse community →
              </button>
            </div>
          </div>
        )}
      </main>

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false) }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60 shrink-0">
              <h2
                className="text-base font-bold text-zinc-100 m-0"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Settings
              </h2>
              <button
                type="button"
                className="text-zinc-500 hover:text-zinc-200 text-lg leading-none"
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-4 overflow-y-auto">
              <Settings />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <GuideAdapterProvider adapter={adapter}>
      <AppInner />
    </GuideAdapterProvider>
  )
}
