import type { ReactNode } from 'react'
import { Settings } from 'lucide-react'

interface TopNavProps {
  onOpenSettings: () => void
  authSlot?: ReactNode
  onToggleSidebar?: () => void
  sidebarOpen?: boolean
  syncDotColor?: string
  syncStatusText?: string
}

export default function TopNav({ onOpenSettings, authSlot, onToggleSidebar, sidebarOpen, syncDotColor, syncStatusText }: TopNavProps) {
  return (
    <div className="flex items-center justify-between px-4 shrink-0 h-10 bg-zinc-950 border-b border-zinc-800">
      <span
        className="text-base font-bold tracking-wide select-none"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        <span className="text-white">CS2</span>
        <span style={{ color: 'var(--color-brand)' }}> Annotations</span>
      </span>

      <div className="flex items-center gap-1">
        {authSlot && <div className="mr-2">{authSlot}</div>}
        {onToggleSidebar && (
          <div className="relative group">
            <button
              type="button"
              onClick={onToggleSidebar}
              className={`relative p-1.5 rounded transition-colors text-base leading-none ${
                sidebarOpen ? 'text-zinc-200 bg-zinc-700/80' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58q0-1.95 1.17-3.48 1.18-1.53 3.08-1.95.51-2.24 2.3-3.7Q9.34 4 11.5 4q2.55 0 4.28 1.73Q17.5 7.45 17.5 10q1.75.2 2.87 1.47Q21.5 12.75 21.5 14.5q0 1.87-1.31 3.18Q18.87 19 17 19H13v-6.15l1.6 1.55L16 13l-3.5-3.5L9 13l1.4 1.4 1.6-1.55V19H6.5Z"/>
              </svg>
              {syncDotColor && (
                <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-950 ${syncDotColor}`} />
              )}
            </button>
            <div className="absolute right-0 top-full mt-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {syncStatusText ? `Cloud: ${syncStatusText}` : sidebarOpen ? 'Hide cloud panel' : 'Show cloud panel'}
            </div>
          </div>
        )}
        <button
          type="button"
          className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
          title="Settings"
          onClick={onOpenSettings}
        >
          <Settings size={15} />
        </button>
      </div>
    </div>
  )
}
