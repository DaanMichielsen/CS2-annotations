import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Steam from 'next-auth-steam'
import { db } from './db'

export const { handlers, auth, signIn, signOut } = NextAuth((request) => ({
  adapter: PrismaAdapter(db),
  providers: [
    Steam(request!, {
      clientSecret: process.env.STEAM_API_KEY!,
      callbackUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/steam`
    })
  ],
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
