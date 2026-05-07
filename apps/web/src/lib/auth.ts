import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from './db'

// NextAuth v5 beta.31 unconditionally checks for an OAuth `code` parameter in
// the callback before it reaches any custom token.request(). Steam uses OpenID
// 2.0 which has no code — next-auth-steam@0.4.0 therefore fails at that check.
//
// Fix: /api/steam-auth/callback verifies the Steam OpenID assertion directly and
// redirects to /api/auth/callback/steam?code=<steamId> so NextAuth sees a code.
// token.request() then extracts the steamId from ctx.params.code and returns it
// as the access_token, which userinfo.request() uses to fetch the Steam profile.

function getBaseUrl(request?: Request): string {
  if (request?.url) {
    try { return new URL(request.url).origin } catch { /* fall through */ }
  }
  const explicit = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  if (explicit) return explicit.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeSteamProvider(request?: Request): any {
  const baseUrl = getBaseUrl(request)
  return {
    id: 'steam',
    name: 'Steam',
    type: 'oauth',
    clientId: 'steam',
    clientSecret: process.env.STEAM_API_KEY!,
    checks: ['none'],
    authorization: {
      url: 'https://steamcommunity.com/openid/login',
      params: {
        'openid.ns':         'http://specs.openid.net/auth/2.0',
        'openid.mode':       'checkid_setup',
        'openid.return_to':  `${baseUrl}/api/steam-auth/callback`,
        'openid.realm':      baseUrl,
        'openid.identity':   'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
      },
    },
    token: {
      url: 'https://steamcommunity.com/openid/login',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async request(ctx: any) {
        // ctx.params.code is the steamId set by /api/steam-auth/callback
        const steamId: string = ctx?.params?.code ?? ''
        return { tokens: { access_token: steamId, token_type: 'bearer' } }
      },
    },
    userinfo: {
      url: 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async request(ctx: any) {
        const steamId: string = ctx?.tokens?.access_token ?? ''
        const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002')
        url.searchParams.set('key', process.env.STEAM_API_KEY!)
        url.searchParams.set('steamids', steamId)
        const res = await fetch(url.toString())
        const data = await res.json()
        return data.response.players[0]
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profile(profile: any) {
      return {
        id:    profile.steamid,
        name:  profile.personaname,
        image: profile.avatarfull,
        email: `${profile.steamid}@steamcommunity.com`,
      }
    },
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth((request) => ({
  adapter: PrismaAdapter(db),
  providers: [makeSteamProvider(request)],
  callbacks: {
    async signIn({ user, account }) {
      // PrismaAdapter creates User without steamId (non-standard field).
      // Backfill it here using account.providerAccountId = profile.id = steamId.
      if (account?.provider === 'steam' && account.providerAccountId && user.id) {
        await db.user.update({
          where: { id: user.id },
          data: {
            steamId:  account.providerAccountId,
            username: user.name  ?? undefined,
            avatar:   user.image ?? undefined,
          },
        })
      }
      return true
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        const dbUser = await db.user.findUnique({ where: { id: user.id } })
        session.user.steamId = dbUser?.steamId ?? ''
        session.user.image   = dbUser?.avatar   ?? session.user.image
        session.user.name    = dbUser?.username  ?? session.user.name
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url
      if (url.startsWith('/'))     return `${baseUrl}${url}`
      return baseUrl
    },
  },
  pages: { signIn: '/auth/signin' },
}))
