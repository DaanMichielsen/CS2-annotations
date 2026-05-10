import { auth } from '@/lib/auth'
import { requireRole } from '@/lib/roles'
import Image from 'next/image'
import AdminTabs from './admin/AdminTabs'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  requireRole(session, 'admin')

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950 px-6 h-14 flex items-center justify-between">
        <span className="font-display font-bold text-white text-lg">
          CS2 <span className="text-violet-400">Annotations</span>
          <span className="text-zinc-600 text-sm font-normal ml-3">Admin</span>
        </span>
        <div className="flex items-center gap-3">
          {session?.user?.image && (
            <Image
              src={session.user.image}
              alt="avatar"
              width={28}
              height={28}
              className="rounded-full ring-1 ring-zinc-700"
              unoptimized
            />
          )}
          <span className="text-sm text-zinc-400">{session?.user?.name}</span>
        </div>
      </header>
      <AdminTabs />
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
