import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Steam from 'next-auth-steam'
import { db } from './db'

// next-auth-steam@0.4.0 appends `/${providerId}` to the callbackUrl internally
// (steam.js line 15: returnTo = `${callbackUrl.href}/${STEAM_PROVIDER_ID}`).
// So we must pass the base path WITHOUT the provider segment.
function makeSteamProvider(request: Parameters<typeof Steam>[0]) {
  const baseUrl = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const provider = Steam(request, {
    clientSecret: process.env.STEAM_API_KEY!,
    callbackUrl: `${baseUrl}/api/auth/callback`
  })
  // next-auth-steam targets NextAuth v4. v5 assertConfig requires token.url and
  // userinfo.url to be present. The package's custom request() functions do the
  // real work — we add url fields only to satisfy the validator.
  return {
    ...provider,
    token: {
      ...(provider.token as object),
      url: 'https://steamcommunity.com/openid/login'
    },
    userinfo: {
      ...(provider.userinfo as object),
      url: 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002'
    }
  } as typeof provider
}

export const { handlers, auth, signIn, signOut } = NextAuth((request) => ({
  adapter: PrismaAdapter(db),
  providers: [makeSteamProvider(request!)],
  callbacks: {
    async signIn({ user, account }) {
      // PrismaAdapter creates the User row first (without steamId since it's not
      // a standard NextAuth field), then this callback runs. We backfill it here.
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
