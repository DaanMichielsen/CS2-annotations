import TopNav from '@/components/TopNav'

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <TopNav />

      <main>{children}</main>

      <footer className="border-t border-zinc-800/60 mt-24 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-zinc-600">
          <span>
            <span className="font-display font-bold text-zinc-500">CS2</span>
            <span className="font-display font-semibold text-violet-800"> Annotations</span>
          </span>
          <span>Community annotation guides for Counter-Strike 2</span>
        </div>
      </footer>
    </div>
  )
}
