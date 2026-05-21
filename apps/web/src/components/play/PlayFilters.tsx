'use client'
import type { GrenadeType } from '@cs2ann/shared/web'

const GRENADE_TYPES: { value: GrenadeType; label: string; icon: string }[] = [
  { value: 'smoke',   label: 'Smoke',   icon: '/nades/smoke.png' },
  { value: 'flash',   label: 'Flash',   icon: '/nades/flash.png' },
  { value: 'he',      label: 'HE',      icon: '/nades/hegrenade.png' },
  { value: 'molotov', label: 'Molotov', icon: '/nades/molotov.png' },
  { value: 'decoy',   label: 'Decoy',   icon: '/nades/decoy.png' },
]
const SIDES = [
  { value: 'T',  label: 'T' },
  { value: 'CT', label: 'CT' },
]

interface Props {
  grenadeType: GrenadeType | null
  side: 'T' | 'CT' | null
  pinMode: 'throw' | 'landing'
  onGrenadeType(v: GrenadeType | null): void
  onSide(v: 'T' | 'CT' | null): void
  onPinMode(v: 'throw' | 'landing'): void
}

const pill = (active: boolean) =>
  `flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${
    active ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
           : 'border-zinc-700 text-zinc-500 hover:border-zinc-400 hover:text-zinc-200'
  }`

export default function PlayFilters({ grenadeType, side, pinMode, onGrenadeType, onSide, onPinMode }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {GRENADE_TYPES.map(({ value, label, icon }) => (
        <button key={value} type="button" className={pill(grenadeType === value)}
          onClick={() => onGrenadeType(grenadeType === value ? null : value)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt="" width={13} height={13} className="opacity-75" />
          {label}
        </button>
      ))}
      <span className="w-px h-4 bg-zinc-700" />
      {SIDES.map(({ value, label }) => (
        <button key={value} type="button" className={pill(side === value)}
          onClick={() => onSide(side === value ? null : value as 'T' | 'CT')}>
          {label}
        </button>
      ))}
      <span className="w-px h-4 bg-zinc-700" />
      <button type="button" className={pill(pinMode === 'landing')}
        onClick={() => onPinMode(pinMode === 'landing' ? 'throw' : 'landing')}
        title="Toggle between throw position and landing position pins">
        {pinMode === 'landing' ? 'Landing pins' : 'Throw pins'}
      </button>
    </div>
  )
}
