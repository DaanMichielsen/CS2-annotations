import { signIn } from '@/lib/auth'
import Image from 'next/image'

interface Props {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}

export default async function SignInPage({ searchParams }: Props) {
  const { callbackUrl, error } = await searchParams

  // Only allow relative paths to prevent open-redirect attacks
  const safeRedirect = callbackUrl?.startsWith('/') ? callbackUrl : '/'

  async function steamSignIn() {
    'use server'
    await signIn('steam', { redirectTo: safeRedirect })
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-zinc-950">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-zinc-100">CS2 Annotations</h1>
          <p className="text-sm text-zinc-400">
            Sign in to sync and share your nade guides
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/40 rounded-lg px-4 py-2 w-full text-center">
            Sign-in failed — please try again.
          </p>
        )}

        <form action={steamSignIn}>
          <button
            type="submit"
            className="hover:opacity-90 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            <Image
              src="https://community.fastly.steamstatic.com/public/images/signinthroughsteam/sits_01.png"
              alt="Sign in through Steam"
              width={180}
              height={35}
              priority
              unoptimized
            />
          </button>
        </form>

        <p className="text-xs text-zinc-500 text-center leading-relaxed">
          Your Steam display name and avatar are stored to identify your account.
          No passwords are stored.
        </p>
      </div>
    </main>
  )
}
