import { useEffect, useState } from 'react'

interface AuthState {
  token: string | null
  name: string
  avatar: string
}

export default function AuthButton() {
  const [auth, setAuth] = useState<AuthState>({ token: null, name: '', avatar: '' })
  const [showDialog, setShowDialog] = useState(false)

  useEffect(() => {
    window.electronAPI.getAuthState().then(setAuth)
    return window.electronAPI.onAuthStateChanged((state) => {
      setAuth(state)
      setShowDialog(false)
    })
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
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="px-2.5 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors"
      >
        Sign in
      </button>

      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 flex flex-col items-center gap-5 shadow-2xl w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-1">
              <h2 className="text-sm font-semibold text-zinc-100">Sign in to CS2 Annotations</h2>
              <p className="text-xs text-zinc-400">Sync and share your nade guides</p>
            </div>

            <button
              onClick={() => {
                window.electronAPI.openSteamSignIn()
                setShowDialog(false)
              }}
              className="hover:opacity-90 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <img
                src="https://community.fastly.steamstatic.com/public/images/signinthroughsteam/sits_02.png"
                alt="Sign in through Steam"
                width={180}
                height={35}
              />
            </button>

            <p className="text-xs text-zinc-500 text-center leading-relaxed">
              Your Steam display name and avatar are stored to identify your account.
            </p>

            <button
              onClick={() => setShowDialog(false)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
