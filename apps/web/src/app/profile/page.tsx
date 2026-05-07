import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Image from 'next/image'

export default async function ProfilePage() {
  const session = await auth()
  if (!session) redirect('/api/auth/signin')

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="flex items-center gap-4">
        {session.user.image && (
          <Image
            src={session.user.image}
            alt="Steam avatar"
            width={80}
            height={80}
            className="rounded-full"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold">{session.user.name}</h1>
          <p className="text-sm text-gray-400">Steam ID: {session.user.steamId}</p>
        </div>
      </div>
    </main>
  )
}
