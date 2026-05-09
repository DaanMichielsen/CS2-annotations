// apps/web/src/components/MapFilterBar.tsx
import Image from 'next/image'
import Link from 'next/link'
import { KNOWN_MAPS, getMapColor, getMapLabel } from '@/lib/mapColors'

interface MapFilterBarProps {
  activeMap: string | null | undefined
  buildHref: (map: string | null) => string
}

const pillBase = 'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors'
const pillActive = 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
const pillInactive = 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'

export function MapFilterBar({ activeMap, buildHref }: MapFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={buildHref(null)} className={`${pillBase} ${!activeMap ? pillActive : pillInactive}`}>
        All maps
      </Link>
      {KNOWN_MAPS.map((m) => {
        const { icon } = getMapColor(m)
        return (
          <Link
            key={m}
            href={buildHref(m)}
            className={`${pillBase} ${activeMap === m ? pillActive : pillInactive}`}
          >
            {icon && (
              <Image src={icon} alt="" width={14} height={14} className="rounded-sm opacity-80" unoptimized />
            )}
            {getMapLabel(m)}
          </Link>
        )
      })}
    </div>
  )
}
