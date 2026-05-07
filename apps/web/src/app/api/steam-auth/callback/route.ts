import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { signSteamCode } from '@/lib/steam-code'

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login'
const STEAM_ID_PATTERN = /https:\/\/steamcommunity\.com\/openid\/id\/(\d+)/

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const params = url.searchParams

  if (!params.get('openid.claimed_id') || !params.get('openid.sig')) {
    return NextResponse.redirect(new URL('/auth/signin?error=verification', url.origin))
  }

  // Verify the OpenID assertion with Steam's check_authentication endpoint
  const verifyParams = new URLSearchParams()
  for (const [key, value] of params.entries()) {
    verifyParams.set(key, key === 'openid.mode' ? 'check_authentication' : value)
  }

  let steamId: string | null = null
  try {
    const response = await fetch(STEAM_OPENID_URL, {
      method: 'POST',
      body: verifyParams.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const text = await response.text()
    if (text.includes('is_valid:true')) {
      steamId = STEAM_ID_PATTERN.exec(params.get('openid.claimed_id') ?? '')?.[1] ?? null
    }
  } catch {
    steamId = null
  }

  if (!steamId) {
    return NextResponse.redirect(new URL('/auth/signin?error=verification', url.origin))
  }

  // HMAC-sign the steamId so the /api/steam-token endpoint can verify it
  const code = signSteamCode(steamId)
  const callbackUrl = new URL('/api/auth/callback/steam', url.origin)
  callbackUrl.searchParams.set('code', code)
  return NextResponse.redirect(callbackUrl)
}
