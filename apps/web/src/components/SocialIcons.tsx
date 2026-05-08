export type SocialLinks = {
  steam?: string
  youtube?: string
  twitch?: string
  kick?: string
  discord?: string
  faceit?: string
  leetify?: string
  esportal?: string
  esea?: string
}

export type PlatformDef = {
  label: string
  color: string
  placeholder: string
  href: (v: string) => string
  icon: React.ReactNode
}

export const SOCIAL_PLATFORMS: Record<keyof SocialLinks, PlatformDef> = {
  steam: {
    label: 'Steam',
    color: '#c7d5e0',
    placeholder: 'steamcommunity.com/id/yourname or username',
    href: (v) => v.startsWith('http') ? v : `https://steamcommunity.com/id/${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.524s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.711L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
      </svg>
    ),
  },
  youtube: {
    label: 'YouTube',
    color: '#ff0000',
    placeholder: '@yourchannel or full URL',
    href: (v) => v.startsWith('http') ? v : `https://youtube.com/@${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  twitch: {
    label: 'Twitch',
    color: '#9146ff',
    placeholder: 'your Twitch username',
    href: (v) => v.startsWith('http') ? v : `https://twitch.tv/${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
      </svg>
    ),
  },
  kick: {
    label: 'Kick',
    color: '#53fc18',
    placeholder: 'your Kick username',
    href: (v) => v.startsWith('http') ? v : `https://kick.com/${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2 2h4v8l4-8h4l-5 9 5 11h-4l-4-9v9H2z" />
      </svg>
    ),
  },
  discord: {
    label: 'Discord',
    color: '#5865f2',
    placeholder: 'your Discord username',
    href: (v) => v.startsWith('http') ? v : `https://discord.com/users/${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.101 18.08.113 18.1.132 18.114a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
  faceit: {
    label: 'FACEIT',
    color: '#FF5500',
    placeholder: 'your FACEIT username',
    href: (v) => v.startsWith('http') ? v : `https://faceit.com/en/players/${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.5 2L5 13.5h7L9.5 22 20 10h-7L13.5 2z" />
      </svg>
    ),
  },
  leetify: {
    label: 'Leetify',
    color: '#6C63FF',
    placeholder: 'your Leetify profile URL or Steam ID',
    href: (v) => v.startsWith('http') ? v : `https://leetify.com/app/profile/${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 20h18v-2H5V4H3v16zm3-2h2V11H6v7zm4 0h2V8h-2v10zm4 0h2v-5h-2v5zm4 0h2V6h-2v12z" />
      </svg>
    ),
  },
  esportal: {
    label: 'Esportal',
    color: '#4A90D9',
    placeholder: 'your Esportal username',
    href: (v) => v.startsWith('http') ? v : `https://esportal.com/profile/${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L4 6v7c0 4.97 3.44 9.62 8 11 4.56-1.38 8-6.03 8-11V6L12 2zm0 2.18l6 2.91V13c0 3.9-2.62 7.51-6 8.77C8.62 20.51 6 16.9 6 13V7.09l6-2.91z" />
      </svg>
    ),
  },
  esea: {
    label: 'ESEA',
    color: '#00A651',
    placeholder: 'your ESEA username',
    href: (v) => v.startsWith('http') ? v : `https://play.esea.net/users/${v}`,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 4v16h16v-3H7v-3h10v-3H7V7h13V4H4z" />
      </svg>
    ),
  },
}
