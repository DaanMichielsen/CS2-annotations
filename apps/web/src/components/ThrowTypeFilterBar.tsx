import Link from 'next/link'
import { THROW_TYPE_SHORT, THROW_TYPE_LABEL } from '@cs2ann/shared/web'
import type { ThrowType } from '@cs2ann/shared/web'

const THROW_TYPES: ThrowType[] = [
  'stand', 'walk', 'run', 'stand_jump', 'w_jump',
  'crouch_jump', 'run_jump', 'm2', 'm2_jump', 'm1m2_jump',
]

interface ThrowTypeFilterBarProps {
  activeType: string | null | undefined
  buildHref: (type: string | null) => string
}

const pill = (active: boolean) =>
  `text-xs px-3 py-1.5 rounded-full border transition-colors ${
    active
      ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-200'
  }`

export function ThrowTypeFilterBar({ activeType, buildHref }: ThrowTypeFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={buildHref(null)} className={pill(!activeType)}>
        All
      </Link>
      {THROW_TYPES.map((t) => (
        <Link
          key={t}
          href={buildHref(t)}
          className={pill(activeType === t)}
          title={THROW_TYPE_LABEL[t]}
        >
          {THROW_TYPE_SHORT[t]}
        </Link>
      ))}
    </div>
  )
}
