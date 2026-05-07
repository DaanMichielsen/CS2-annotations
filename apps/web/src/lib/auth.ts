import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Steam from 'next-auth-steam'
import { db } from './db'

// next-auth-steam@0.4.0 targets NextAuth v4. NextAuth v5 beta.31 requires
// both token.url and userinfo.url to be present (assertConfig line 81/83).
// The package already provides custom request() functions that handle the
// actual Steam OpenID flow — we just add the url fields to pass validation.
function makeSteamProvider(request: Parameters<typeof Steam>[0]) {
  const provider = Steam(request, {
    clientSecret: process.env.STEAM_API_KEY!,
    callbackUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/steam`
  })
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
