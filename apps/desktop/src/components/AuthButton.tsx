import { useEffect, useState } from 'react'

interface AuthState {
  token: string | null
  name: string
  avatar: string
}

export default function AuthButton() {
  const [auth, setAuth] = useState<AuthState>({ token: null, name: '', avatar: '' })

  useEffect(() => {
    window.electronAPI.getAuthState().then(setAuth)
    return window.electronAPI.onAuthStateChanged(setAuth)
  }, [])

  if (auth.token) {
    return (
      <div className="flex items-center gap-2">
        {auth.avatar && (
          <img src={auth.avatar} alt="avatar" className="w-6 h-6 rounded-full" />
        )}
        <span className="text-xs text-zinc-300">{auth.name}</span>
        <button
          onClick={() =>
            window.electronAPI.signOut().then(() =>
              setAuth({ token: null, name: '', avatar: '' })
            )
          }
          className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => window.electronAPI.openSteamSignIn()}
      className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
    >
      Sign in with Steam
    </button>
  )
}
