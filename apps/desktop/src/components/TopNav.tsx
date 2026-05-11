interface TopNavProps {
  onOpenSettings: () => void
}

export default function TopNav({ onOpenSettings }: TopNavProps) {
  return (
    <div className="flex items-center justify-between px-4 shrink-0 h-9 bg-zinc-900 border-b border-zinc-700/60">
      <span className="text-sm font-semibold text-zinc-300 tracking-wide">CS2 <span style={{ color: 'var(--color-brand)' }}>Annotations</span></span>
      <button
        type="button"
        className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors text-base leading-none"
        title="Settings"
        onClick={onOpenSettings}
      >
        ⚙
      </button>
    </div>
  )
}
