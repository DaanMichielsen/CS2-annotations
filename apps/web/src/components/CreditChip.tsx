const TWITCH_PATH =
  'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z'
const YOUTUBE_PATH =
  'M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z'
const X_PATH =
  'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 7.184zm-1.285 19.378h2.04L6.463 3.24H4.282z'
const STEAM_PATH =
  'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z'

type Platform = 'twitch' | 'youtube' | 'x' | 'steam' | 'person'

function inferPlatform(handle: string): Platform {
  if (handle.includes('twitch.tv')) return 'twitch'
  if (handle.includes('youtube.com') || handle.includes('youtu.be')) return 'youtube'
  if (handle.includes('twitter.com') || handle.includes('x.com') || handle.startsWith('@')) return 'x'
  if (handle.includes('steamcommunity.com')) return 'steam'
  return 'person'
}

const PLATFORM_COLORS: Record<Platform, string> = {
  twitch:  '#9146ff',
  youtube: '#ff0000',
  x:       '#e7e7e7',
  steam:   '#c7d5e0',
  person:  '#71717a',
}

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform === 'person') {
    return (
      <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor" aria-hidden>
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    )
  }
  const paths: Record<Exclude<Platform, 'person'>, string> = {
    twitch:  TWITCH_PATH,
    youtube: YOUTUBE_PATH,
    x:       X_PATH,
    steam:   STEAM_PATH,
  }
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor" aria-hidden>
      <path d={paths[platform]} />
    </svg>
  )
}

function isUrl(handle: string): boolean {
  return handle.startsWith('http://') || handle.startsWith('https://') || handle.includes('.com') || handle.includes('.tv')
}

interface CreditChipProps {
  handle: string
  label?: string | null
}

export function CreditChip({ handle, label }: CreditChipProps) {
  const platform = inferPlatform(handle)
  const display = label || handle
  const color = PLATFORM_COLORS[platform]
  const clickable = isUrl(handle)

  const inner = (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300"
      style={{ color }}
    >
      <PlatformIcon platform={platform} />
      <span className="text-zinc-300">{display}</span>
    </span>
  )

  if (clickable) {
    const href = handle.startsWith('http') ? handle : `https://${handle}`
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="no-underline">
        {inner}
      </a>
    )
  }
  return inner
}
