import Link from 'next/link'

const GRENADE_TYPES = [
  { value: 'smoke', label: 'Smoke', icon: '/nades/smoke.png' },
  { value: 'flash', label: 'Flash', icon: '/nades/flash.png' },
  { value: 'he', label: 'HE', icon: '/nades/hegrenade.png' },
  { value: 'molotov', label: 'Molotov', icon: '/nades/molotov.png' },
  { value: 'decoy', label: 'Decoy', icon: '/nades/decoy.png' },
] as const

interface GrenadeTypeFilterBarProps {
  activeType: string | null | undefined
  buildHref: (type: string | null) => string
}

const pill = (active: boolean) =>
  `flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
    active
      ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-200'
  }`

export function GrenadeTypeFilterBar({ activeType, buildHref }: GrenadeTypeFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={buildHref(null)} className={pill(!activeType)}>
        All types
      </Link>
      {GRENADE_TYPES.map(({ value, label, icon }) => (
        <Link key={value} href={buildHref(value)} className={pill(activeType === value)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt="" width={13} height={13} className="opacity-75" />
          {label}
        </Link>
      ))}
    </div>
  )
}
