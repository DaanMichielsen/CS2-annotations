import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Steam from 'next-auth-steam'
import { db } from './db'

// Resolve the app's base URL in priority order:
// 1. request.url origin  — accurate during actual auth API calls
// 2. AUTH_URL / NEXTAUTH_URL — explicitly configured env var
// 3. VERCEL_URL            — auto-injected by Vercel on every deployment
// 4. localhost             — local dev fallback
function getBaseUrl(request?: Request): string {
  if (request?.url) {
    try { return new URL(request.url).origin } catch { /* fall through */ }
  }
  const explicit = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  if (explicit) return explicit.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

// next-auth-steam@0.4.0 targets NextAuth v4. NextAuth v5 beta.31 requires
// token.url and userinfo.url to be present (assertConfig line 81/83).
// The package provides custom request() functions that do the real work —
// we only add url fields to satisfy the validator.
function makeSteamProvider(request?: Request) {
  const baseUrl = getBaseUrl(request)
  const provider = Steam(request as Parameters<typeof Steam>[0], {
    clientSecret: process.env.STEAM_API_KEY!,
    callbackUrl: `${baseUrl}/api/auth/callback/steam`
  })
  // next-auth-steam targets NextAuth v4. v5 assertConfig requires token.url and
  // userinfo.url to be present. The package's custom request() functions do the
  // real work — we add url fields only to satisfy the validator.
  return {
    ...provider,
    token: { ...(provider.token as object), url: 'https://steamcommunity.com/openid/login' },
    userinfo: { ...(provider.userinfo as object), url: 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002' }
  } as typeof provider
}

export const { handlers, auth, signIn, signOut } = NextAuth((request) => ({
  adapter: PrismaAdapter(db),
  providers: [makeSteamProvider(request)],
  callbacks: {
    async signIn({ user, account }) {
      // PrismaAdapter creates the User row first (without steamId since it's not
      // a standard NextAuth field), then this callback runs. We update the row
      // to populate our Steam-specific fields.
      if (account?.provider === 'steam' && account.providerAccountId && user.id) {
        await db.user.update({
          where: { id: user.id },
          data: {
            steamId: account.providerAccountId,
            username: user.name ?? undefined,
            avatar: user.image ?? undefined
          }
        })
      }
      return true
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        const dbUser = await db.user.findUnique({ where: { id: user.id } })
        session.user.steamId = dbUser?.steamId ?? ''
        session.user.image = dbUser?.avatar ?? session.user.image
        session.user.name = dbUser?.username ?? session.user.name
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url
      if (url.startsWith('/')) return `${baseUrl}${url}`
      return baseUrl
    }
  },
  pages: {
    signIn: '/auth/signin'
  }
}))
