import { open } from '@tauri-apps/plugin-shell'
import { onOpenUrl } from '@tauri-apps/plugin-deep-link'
import type { AuthState } from '@cs2ann/shared'
import { getSetting, setSetting, deleteSetting } from './settingsStore'

export async function getAuthState(): Promise<AuthState> {
  return {
    token: (await getSetting<string>('authToken')) ?? null,
    name: (await getSetting<string>('authName')) ?? '',
    avatar: (await getSetting<string>('authAvatar')) ?? '',
  }
}

export async function signOut(): Promise<void> {
  await deleteSetting('authToken')
  await deleteSetting('authName')
  await deleteSetting('authAvatar')
}

export async function openSteamSignIn(): Promise<void> {
  // `client=tauri` must travel *inside* the `callbackUrl` value (not as a
  // sibling query param) because the web app's /auth/signin page only reads
  // `callbackUrl` out of its own search params and threads that single string
  // through NextAuth's `redirectTo` — any params written as separate top-level
  // query params here (e.g. `...&client=tauri`) are dropped before the
  // desktop-callback page ever sees them. See apps/web/src/app/auth/signin
  // and apps/web/src/app/auth/desktop-callback for the receiving side.
  const callbackUrl = encodeURIComponent('/auth/desktop-callback?client=tauri')
  await open(`https://cs2annotations.com/auth/signin?callbackUrl=${callbackUrl}`)
}

type AuthListener = (state: AuthState) => void
const listeners = new Set<AuthListener>()
let deepLinkRegistered = false

function parseCallbackUrl(url: string): AuthState | null {
  try {
    const parsed = new URL(url)
    if (parsed.pathname !== '/callback') return null
    const token = parsed.searchParams.get('token')
    if (!token) return null
    return {
      token,
      name: parsed.searchParams.get('name') ?? '',
      avatar: parsed.searchParams.get('avatar') ?? '',
    }
  } catch {
    return null
  }
}

export function onAuthStateChanged(callback: AuthListener): () => void {
  listeners.add(callback)

  if (!deepLinkRegistered) {
    deepLinkRegistered = true
    void onOpenUrl(async (urls) => {
      for (const url of urls) {
        const state = parseCallbackUrl(url)
        if (!state) continue
        await setSetting('authToken', state.token)
        await setSetting('authName', state.name)
        await setSetting('authAvatar', state.avatar)
        listeners.forEach((l) => l(state))
      }
    })
  }

  return () => listeners.delete(callback)
}
