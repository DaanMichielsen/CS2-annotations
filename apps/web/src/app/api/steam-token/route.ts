import { NextResponse } from 'next/server'
import { verifySteamCode } from '@/lib/steam-code'

// NextAuth v5 (via openid-client) POSTs here to exchange the OAuth code for
// tokens. The "code" is an HMAC-signed steamId set by /api/steam-auth/callback.
export async function POST(request: Request) {
  const body = await request.text()
  const params = new URLSearchParams(body)
  const code = params.get('code') ?? ''

  const steamId = verifySteamCode(code)
  if (!steamId) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 })
  }

  return NextResponse.json({
    access_token: steamId,
    token_type: 'Bearer',
    expires_in: 3600,
  })
}
