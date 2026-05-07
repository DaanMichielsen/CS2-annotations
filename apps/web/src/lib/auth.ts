import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from './db'

// NextAuth v5 beta.31 unconditionally calls openid-client's oauthCallback() for
// OAuth providers, which makes a real HTTP request to token.url regardless of any
// custom token.request() function we provide. Steam's endpoint isn't an OAuth
// token server, so that call fails.
//
// Architecture:
//   1. /api/steam-auth/callback  — verifies Steam's OpenID 2.0 signature,
//                                  signs the steamId with HMAC (NEXTAUTH_SECRET),
//                                  redirects to /api/auth/callback/steam?code=<signed>
//   2. /api/steam-token          — NextAuth POSTs here to exchange the code;
//                                  verifies HMAC, returns access_token = steamId
//   3. /api/steam-userinfo       — NextAuth GETs here with Bearer <steamId>;
//                                  fetches Steam profile and returns it
//   4. profile()                 — maps the Steam player object to a NextAuth user

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
    // Synthetic emails (steamid@steamcommunity.com) are unforgeable, so linking
    // an existing User to a new Account is safe and prevents OAuthAccountNotLinked.
    allowDangerousEmailAccountLinking: true,
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
    // Real HTTP endpoints within this app — openid-client calls these successfully
    token:    { url: `${baseUrl}/api/steam-token` },
    userinfo: { url: `${baseUrl}/api/steam-userinfo` },
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
      // Backfill it here — account.providerAccountId = profile.id = steamId.
      if (account?.provider === 'steam' && account.providerAccountId && user.id) {
        try {
          await db.user.update({
            where: { id: user.id },
            data: {
              steamId:  account.providerAccountId,
              username: user.name  ?? undefined,
              avatar:   user.image ?? undefined,
            },
          })
        } catch {
          // Non-fatal: user is still signed in, fields backfilled on next sign-in.
        }
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
