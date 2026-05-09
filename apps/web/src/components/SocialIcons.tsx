// SocialLinks only contains platforms the user can manually edit.
// Steam is handled separately — it is always derived from the authenticated steamId.
// Other platforms are commented out until OAuth integrations are added.
export type SocialLinks = {
  [key: string]: string | undefined
  // TODO: enable each entry once its OAuth connection is implemented
  // youtube?: string
  // twitch?: string
  // kick?: string
  // discord?: string
  // faceit?: string
  // leetify?: string
  // esportal?: string
  // esea?: string
}

export type PlatformDef = {
  label: string
  color: string
  placeholder: string
  href: (v: string) => string
  iconSrc: string
  /** When true the icon renders at natural width (fixed height only) — for wide lockup logos */
  iconWide?: boolean
}

// Steam is always displayed on profiles but is NOT user-editable.
// Its URL is constructed from the authenticated steamId.
export const STEAM_PLATFORM: PlatformDef = {
  label: 'Steam',
  color: '#c7d5e0',
  placeholder: '',
  href: (v) => v.startsWith('http') ? v : `https://steamcommunity.com/profiles/${v}`,
  iconSrc: '/socials/steam.svg',
}

// Editable social platforms — add entries here as OAuth integrations are completed.
// Definitions for commented-out platforms are preserved below for reference.
export const SOCIAL_PLATFORMS: Record<string, PlatformDef> = {
  // youtube: {
  //   label: 'YouTube',
  //   color: '#ff0000',
  //   placeholder: '@yourchannel or full URL',
  //   href: (v) => v.startsWith('http') ? v : `https://youtube.com/@${v}`,
  //   iconSrc: '/socials/youtube.svg',
  // },
  // twitch: {
  //   label: 'Twitch',
  //   color: '#9146ff',
  //   placeholder: 'your Twitch username',
  //   href: (v) => v.startsWith('http') ? v : `https://twitch.tv/${v}`,
  //   iconSrc: '/socials/twitch.svg',
  // },
  // kick: {
  //   label: 'Kick',
  //   color: '#53fc18',
  //   placeholder: 'your Kick username',
  //   href: (v) => v.startsWith('http') ? v : `https://kick.com/${v}`,
  //   iconSrc: '/socials/kick.svg',
  // },
  // discord: {
  //   label: 'Discord',
  //   color: '#5865f2',
  //   placeholder: 'your Discord username',
  //   href: (v) => v.startsWith('http') ? v : `https://discord.com/users/${v}`,
  //   iconSrc: '/socials/discord.svg',
  // },
  // faceit: {
  //   label: 'FACEIT',
  //   color: '#FF5500',
  //   placeholder: 'your FACEIT username',
  //   href: (v) => v.startsWith('http') ? v : `https://faceit.com/en/players/${v}`,
  //   iconSrc: '/socials/faceit.svg',
  // },
  // leetify: {
  //   label: 'Leetify',
  //   color: '#6C63FF',
  //   placeholder: 'your Leetify profile URL or Steam ID',
  //   href: (v) => v.startsWith('http') ? v : `https://leetify.com/app/profile/${v}`,
  //   iconSrc: '/socials/leetify.png',
  //   iconWide: true,
  // },
  // esportal: {
  //   label: 'Esportal',
  //   color: '#4A90D9',
  //   placeholder: 'your Esportal username',
  //   href: (v) => v.startsWith('http') ? v : `https://esportal.com/profile/${v}`,
  //   iconSrc: '/socials/esportal.svg',
  // },
  // esea: {
  //   label: 'ESEA',
  //   color: '#00A651',
  //   placeholder: 'your ESEA username',
  //   href: (v) => v.startsWith('http') ? v : `https://play.esea.net/users/${v}`,
  //   iconSrc: '/socials/esea.svg',
  // },
}

/** Renders a platform icon. Wide logos get fixed height + auto width. */
export function SocialIcon({ def, size = 14 }: { def: PlatformDef; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={def.iconSrc}
      alt={def.label}
      height={size}
      style={def.iconWide ? { height: size, width: 'auto', maxWidth: size * 4 } : { height: size, width: size }}
    />
  )
}
