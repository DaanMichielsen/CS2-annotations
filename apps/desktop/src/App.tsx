import { useState } from 'react'
import { GuideAdapterProvider, Guides, Settings, TopNav } from '@cs2ann/ui'
import { createLocalAdapter } from './adapters/LocalAdapter'

const adapter = createLocalAdapter()

export default function App() {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <GuideAdapterProvider adapter={adapter}>
      <div className="h-full flex flex-col overflow-hidden">
        <TopNav onOpenSettings={() => setShowSettings(true)} />
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden p-4">
          <Guides />
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
