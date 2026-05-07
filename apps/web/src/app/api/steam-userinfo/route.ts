import { NextResponse } from 'next/server'

// NextAuth v5 (via openid-client) GETs here with Authorization: Bearer <steamId>
// after a successful token exchange. We fetch the Steam profile and return it.
// profile() in auth.ts then maps this to a standard NextAuth user object.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization') ?? ''
  const steamId = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''

  if (!/^\d{17}$/.test(steamId)) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }

  const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002')
  url.searchParams.set('key', process.env.STEAM_API_KEY!)
  url.searchParams.set('steamids', steamId)

  const res = await fetch(url.toString())
  const data = await res.json()
  const player = data.response?.players?.[0]

  if (!player) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(player)
}
