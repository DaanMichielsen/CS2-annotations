import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Steam OpenID 2.0 verification:
// NextAuth v5 beta.31 requires an OAuth `code` in the callback before it calls
// any custom token.request(). Steam uses OpenID 2.0 which has no `code`.
// This route sits between Steam's redirect and NextAuth's callback:
//  1. Steam redirects here with openid.* params
//  2. We verify the signature with Steam's check_authentication endpoint
//  3. We pass the verified steamId to NextAuth as a synthetic OAuth code

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login'
const STEAM_ID_PATTERN = /https:\/\/steamcommunity\.com\/openid\/id\/(\d+)/

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const params = url.searchParams

  // Must have OpenID params from Steam
  if (!params.get('openid.claimed_id') || !params.get('openid.sig')) {
    return NextResponse.redirect(new URL('/auth/signin?error=verification', url.origin))
  }

  // Re-send all params back to Steam with mode=check_authentication to verify signature
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

  // Hand off to NextAuth's OAuth callback with the verified steamId as the code
  const callbackUrl = new URL('/api/auth/callback/steam', url.origin)
  callbackUrl.searchParams.set('code', steamId)
  return NextResponse.redirect(callbackUrl)
}
