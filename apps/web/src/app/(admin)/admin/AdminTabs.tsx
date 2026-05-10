'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/admin/featured', label: 'Featured Guides' },
  { href: '/admin/users',    label: 'Users' },
]

export default function AdminTabs() {
  const pathname = usePathname()
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950 px-6">
      <div className="max-w-5xl mx-auto flex gap-1">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                active
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
