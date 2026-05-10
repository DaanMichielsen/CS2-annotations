import type { Session } from 'next-auth'
import { redirect } from 'next/navigation'

export function hasRole(session: Session | null, role: string): boolean {
  return session?.user?.roles?.includes(role) ?? false
}

export function requireRole(session: Session | null, role: string): void {
  if (!hasRole(session, role)) redirect('/')
}
