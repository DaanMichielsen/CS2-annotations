import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      steamId: string
      roles: string[]
    } & DefaultSession['user']
  }
}
