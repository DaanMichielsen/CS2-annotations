import type { Metadata } from 'next'
import { Rajdhani, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import './globals.css'

const rajdhani = Rajdhani({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const ibmSans = IBM_Plex_Sans({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const ibmMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CS2 Annotations',
  description: 'Community platform for CS2 nade guides',
}

// NOTE: deliberately not async and deliberately does not call auth().
// Calling auth() here reads cookies, which opts the ENTIRE app out of static
// rendering — every route below this layout became dynamic and hit Postgres on
// every request, including anonymous crawler traffic. SessionProvider without a
// `session` prop fetches /api/auth/session from the client instead, which keeps
// this layout static. See docs/dev/database-cost.md.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rajdhani.variable} ${ibmSans.variable} ${ibmMono.variable}`}>
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
