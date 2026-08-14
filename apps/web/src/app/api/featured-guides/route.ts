import { NextResponse } from 'next/server'
import { getFeaturedGuides } from '@/lib/queries'

// The desktop apps poll this every 30 minutes, so the previous 60s window
// guaranteed every single poll was a cache miss that woke the database.
// Safe to make long because getFeaturedGuides is tag-invalidated: the admin
// featured actions and guide mutations both clear it immediately.
export const revalidate = 3600

export async function GET() {
  return NextResponse.json({ guides: await getFeaturedGuides() })
}
