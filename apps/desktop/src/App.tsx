import { useState } from 'react'
import { GuideAdapterProvider, Guides, Settings, TopNav } from '@cs2ann/ui'
import type { OpenGuideInfo } from '@cs2ann/ui'
import { createLocalAdapter } from './adapters/LocalAdapter'
import AuthButton from './components/AuthButton'
import CloudPanel from './components/CloudPanel'

const adapter = createLocalAdapter()

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [openGuide, setOpenGuide] = useState<OpenGuideInfo | null>(null)

  return (
    <GuideAdapterProvider adapter={adapter}>
      <div className="h-full flex flex-col overflow-hidden">
        <TopNav onOpenSettings={() => setShowSettings(true)} authSlot={<AuthButton />} />
        <main className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-4">
            <Guides onGuideChange={setOpenGuide} />
          </div>

          {/* Right sidebar — always visible */}
          <div className="w-56 shrink-0 border-l border-zinc-800 flex flex-col overflow-y-auto">
            {openGuide ? (
              <CloudPanel guide={openGuide} />
            ) : (
              <div className="p-4 text-xs text-zinc-600">
                Open a guide to manage cloud sync.
              </div>
            )}
            <div className="mt-auto p-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => void window.electronAPI.openCommunity()}
                className="w-full text-xs px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors text-left"
              >
                Browse community →
              </button>
            </div>
          </div>
        </main>

        {showSettings && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false) }}
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60 shrink-0">
                <h2 className="text-base font-semibold text-zinc-100 m-0">Settings</h2>
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
    </GuideAdapterProvider>
  )
}
