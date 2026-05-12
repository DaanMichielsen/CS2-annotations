'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  isAuthenticated: boolean
  isAdmin: boolean
}

function linkClass(active: boolean) {
  return `text-sm font-medium transition-colors ${
    active ? 'text-white' : 'text-zinc-400 hover:text-white'
  }`
}

export function LeftNavLinks() {
  const pathname = usePathname()
  const active = (href: string) => pathname === href || pathname.startsWith(href + '/')
  return (
    <>
      <Link href="/guides" className={linkClass(active('/guides'))}>Browse</Link>
      <Link href="/library" className={linkClass(active('/library'))}>Library</Link>
    </>
  )
}

export function RightNavLinks({ isAuthenticated, isAdmin }: Props) {
  const pathname = usePathname()
  const active = (href: string) => pathname === href || pathname.startsWith(href + '/')
  if (!isAuthenticated) return null
  return (
    <>
      <Link href="/for-you" className={linkClass(active('/for-you'))}>For You</Link>
      <Link href="/my-guides" className={linkClass(active('/my-guides'))}>My Guides</Link>
      <Link href="/saved" className={linkClass(active('/saved'))}>Saved</Link>
      {isAdmin && (
        <Link href="/admin" className={`text-sm font-medium transition-colors ${active('/admin') ? 'text-violet-300' : 'text-violet-400 hover:text-violet-300'}`}>
          Admin
        </Link>
      )}
    </>
  )
}
