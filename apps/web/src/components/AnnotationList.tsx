'use client'
import { useState } from 'react'
import { nodeLabel, inferThrowType, THROW_TYPE_SHORT } from '@cs2ann/shared/web'
import type { AnnotationNode, GrenadeType } from '@cs2ann/shared/web'

const GRENADE_ORDER: GrenadeType[] = ['smoke', 'flash', 'he', 'molotov', 'decoy']
const GRENADE_LABELS: Record<GrenadeType, string> = {
  smoke: 'Smoke', flash: 'Flash', he: 'HE Grenade', molotov: 'Molotov', decoy: 'Decoy',
}

interface Props {
  nodes: AnnotationNode[]
}

export default function AnnotationList({ nodes }: Props) {
  const [open, setOpen] = useState(true)
  const [search, setSearch] = useState('')

  // Build aim_target lookup by MasterNodeId for throw type inference
  const aimByMaster = new Map(
    nodes
      .filter((n) => n.Type === 'grenade' && n.SubType === 'aim_target')
      .map((n) => [n.MasterNodeId, n])
  )

  // Only main grenade nodes (the lineup heads)
  const mainNodes = nodes.filter(
    (n) => n.Type === 'grenade' && n.SubType !== 'aim_target' && n.SubType !== 'destination'
  )

  if (mainNodes.length === 0) return null

  const query = search.toLowerCase()
  const matchedNodes = query
    ? mainNodes.filter((n) => nodeLabel(n).toLowerCase().includes(query))
    : mainNodes

  // Group matched nodes by grenade type
  const grouped = GRENADE_ORDER.reduce<Partial<Record<GrenadeType, AnnotationNode[]>>>(
    (acc, gt) => {
      const group = matchedNodes.filter((n) => n.GrenadeType === gt)
      if (group.length > 0) acc[gt] = group
      return acc
    },
    {}
  )

  return (
    <div className="mt-6">
      <button
        type="button"
        className="w-full flex items-center gap-2 mb-3 group"
        onClick={() => setOpen((v) => !v)}
      >
        <h2 className="font-display font-semibold text-base text-zinc-400 uppercase tracking-wider m-0">
          Lineup list · {mainNodes.length}
        </h2>
        <span className="ml-auto text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lineups…"
            className="w-full mb-4 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600"
          />
          <div className="flex flex-col gap-4">
            {GRENADE_ORDER.map((gt) => {
              const group = grouped[gt]
              if (!group) return null
              return (
                <div key={gt}>
                  <p className="text-[0.65rem] font-data uppercase tracking-wider text-zinc-500 mb-1.5">
                    {GRENADE_LABELS[gt]}
                  </p>
                  <ul className="list-none m-0 p-0 space-y-0.5">
                    {group.map((node) => {
                      const aim = aimByMaster.get(node.Id)
                      const throwType = aim ? inferThrowType(aim) : null
                      return (
                        <li
                          key={node.Id}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-zinc-900/50 hover:bg-zinc-800/60 transition-colors"
                        >
                          <span className="flex-1 text-xs text-zinc-200 truncate">
                            {nodeLabel(node)}
                          </span>
                          {throwType && (
                            <span className="shrink-0 text-[0.6rem] font-data uppercase tracking-wide text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                              {THROW_TYPE_SHORT[throwType]}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
            {query && matchedNodes.length === 0 && (
              <p className="text-xs text-zinc-600">No lineups match &quot;{search}&quot;</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
