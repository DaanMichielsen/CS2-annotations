import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CS2 Annotations',
  description: 'Community platform for CS2 nade guides'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}