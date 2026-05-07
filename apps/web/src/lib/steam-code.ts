import { createHmac, timingSafeEqual } from 'node:crypto'

const STEAM_ID_RE = /^\d{17}$/

export function signSteamCode(steamId: string): string {
  const mac = createHmac('sha256', process.env.NEXTAUTH_SECRET!)
    .update(steamId)
    .digest('base64url')
  return `${steamId}.${mac}`
}

export function verifySteamCode(code: string): string | null {
  const dot = code.lastIndexOf('.')
  if (dot === -1) return null
  const steamId = code.slice(0, dot)
  const provided = code.slice(dot + 1)
  if (!STEAM_ID_RE.test(steamId)) return null
  const expected = createHmac('sha256', process.env.NEXTAUTH_SECRET!)
    .update(steamId)
    .digest('base64url')
  try {
    const a = Buffer.from(provided, 'base64url')
    const b = Buffer.from(expected, 'base64url')
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return steamId
}
