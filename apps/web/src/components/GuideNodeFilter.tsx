'use client'
import { useState } from 'react'
import { inferThrowType, THROW_TYPE_SHORT, THROW_TYPE_LABEL } from '@cs2ann/shared/web'
import GuideAnnotationPreview from '@/components/GuideAnnotationPreview'
import type { AnnotationNode, ThrowType, GrenadeType } from '@cs2ann/shared/web'

const THROW_TYPES: ThrowType[] = [
  'stand', 'walk', 'run', 'stand_jump', 'w_jump',
  'crouch_jump', 'run_jump', 'm2', 'm2_jump', 'm1m2_jump',
]

const GRENADE_TYPES: GrenadeType[] = ['smoke', 'flash', 'he', 'molotov', 'decoy']
const GRENADE_ICONS: Record<GrenadeType, string> = {
  smoke:   '/nades/smoke.png',
  flash:   '/nades/flash.png',
  he:      '/nades/hegrenade.png',
  molotov: '/nades/molotov.png',
  decoy:   '/nades/decoy.png',
}

interface Props {
  nodes: AnnotationNode[]
  mapName: string | null | undefined
}

const pill = (active: boolean) =>
  `text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
    active
      ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-200'
  }`

export function GuideNodeFilter({ nodes, mapName }: Props) {
  const [throwFilter, setThrowFilter] = useState<ThrowType | 'all'>('all')
  const [grenadeFilter, setGrenadeFilter] = useState<GrenadeType | 'all'>('all')

  const hasGrenades = nodes.some((n) => n.Type === 'grenade')
  if (!hasGrenades) {
    return <GuideAnnotationPreview nodes={nodes} mapName={mapName} />
  }

  // Map aim_target nodes by MasterNodeId for throw type lookup
  const aimByMaster = new Map(
    nodes
      .filter((n) => n.Type === 'grenade' && n.SubType === 'aim_target')
      .map((n) => [n.MasterNodeId, n])
  )

  // Main grenade nodes (the "group" head)
  const mainNodes = nodes.filter(
    (n) => n.Type === 'grenade' && n.SubType !== 'aim_target' && n.SubType !== 'destination'
  )

  // Compute which main node IDs pass the current filters
  const visibleMainIds = new Set(
    mainNodes
      .filter((n) => grenadeFilter === 'all' || n.GrenadeType === grenadeFilter)
      .filter((n) => {
        if (throwFilter === 'all') return true
        const aim = aimByMaster.get(n.Id)
        return aim ? inferThrowType(aim) === throwFilter : false
      })
      .map((n) => n.Id)
  )

  // Keep all linked nodes for visible groups; keep all non-grenade nodes
  const filteredNodes = nodes.filter((n) => {
    if (n.Type !== 'grenade') return true
    if (n.SubType === 'aim_target' || n.SubType === 'destination') {
      return visibleMainIds.has(n.MasterNodeId ?? '')
    }
    return visibleMainIds.has(n.Id ?? '')
  })

  return (
    <div>
      {/* Grenade type filter */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button className={pill(grenadeFilter === 'all')} onClick={() => setGrenadeFilter('all')}>
          All
        </button>
        {GRENADE_TYPES.map((gt) => (
          <button key={gt} className={pill(grenadeFilter === gt)} onClick={() => setGrenadeFilter(gt)}>
            <span className="inline-flex items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GRENADE_ICONS[gt]} alt="" width={12} height={12} className="opacity-75" />
              {gt.charAt(0).toUpperCase() + gt.slice(1)}
            </span>
          </button>
        ))}
      </div>

      {/* Throw type filter */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button className={pill(throwFilter === 'all')} onClick={() => setThrowFilter('all')}>
          All throws
        </button>
        {THROW_TYPES.map((t) => (
          <button
            key={t}
            className={pill(throwFilter === t)}
            onClick={() => setThrowFilter(t)}
            title={THROW_TYPE_LABEL[t]}
          >
            {THROW_TYPE_SHORT[t]}
          </button>
        ))}
      </div>

      <GuideAnnotationPreview nodes={filteredNodes} mapName={mapName} />
    </div>
  )
}
