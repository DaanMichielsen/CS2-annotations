import type { Metadata } from 'next'
import { Rajdhani, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth'
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <html lang="en" className={`${rajdhani.variable} ${ibmSans.variable} ${ibmMono.variable}`}>
      <body>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
