'use client'
import { useState } from 'react'
import { nodeLabel, inferThrowType, THROW_TYPE_SHORT } from '@cs2ann/shared/web'
import type { AnnotationNode, GrenadeType, AnnotationMedia, MediaSlot } from '@cs2ann/shared/web'
import { MediaViewer } from '@cs2ann/ui'

const GRENADE_ORDER: GrenadeType[] = ['smoke', 'flash', 'he', 'molotov', 'decoy']
const GRENADE_LABELS: Record<GrenadeType, string> = {
  smoke: 'Smoke', flash: 'Flash', he: 'HE Grenade', molotov: 'Molotov', decoy: 'Decoy',
}

interface Props {
  nodes: AnnotationNode[]
  mediaMap?: Record<string, AnnotationMedia[]>
  canAddMedia?: boolean
  onAddMedia?: (nodeId: string) => void
}

export default function AnnotationList({ nodes, mediaMap, canAddMedia, onAddMedia }: Props) {
  const [open, setOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
                        <li key={node.Id} className="flex flex-col rounded bg-zinc-900/50 hover:bg-zinc-800/60 transition-colors">
                          <button type="button"
                            className="flex items-center gap-2 px-2.5 py-1.5 w-full text-left"
                            onClick={() => setExpandedId((id) => id === node.Id ? null : (node.Id ?? null))}>
                            <span className="flex-1 text-xs text-zinc-200 truncate">{nodeLabel(node)}</span>
                            {throwType && (
                              <span className="shrink-0 text-[0.6rem] font-data uppercase tracking-wide text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                                {THROW_TYPE_SHORT[throwType]}
                              </span>
                            )}
                            {mediaMap && node.Id && (mediaMap[node.Id]?.length ?? 0) > 0 && (
                              <span className="text-[0.65rem] text-violet-400" title="Has media">📷</span>
                            )}
                            <span className="text-zinc-600 text-[0.6rem]">{expandedId === node.Id ? '▲' : '▼'}</span>
                          </button>

                          {expandedId === node.Id && (
                            <div className="px-3 pb-3 border-t border-zinc-800/60 mt-0.5">
                              {mediaMap && node.Id && (mediaMap[node.Id]?.length ?? 0) > 0 ? (() => {
                                const items = mediaMap[node.Id!]!
                                const bySlot = Object.fromEntries(items.map((m) => [m.slot, m])) as Partial<Record<MediaSlot, AnnotationMedia>>
                                const notes = items.find((m) => m.notes)?.notes
                                return (
                                  <div className="mt-2">
                                    <MediaViewer mediaBySlot={bySlot} notes={notes} />
                                  </div>
                                )
                              })() : (
                                <p className="text-[0.65rem] text-zinc-600 mt-2">No media for this lineup yet.</p>
                              )}
                              {canAddMedia && onAddMedia && node.Id && (
                                <button type="button"
                                  onClick={() => onAddMedia(node.Id!)}
                                  className="mt-2 text-xs px-2.5 py-1 bg-zinc-800 hover:bg-violet-900/40 border border-zinc-700 hover:border-violet-700 text-zinc-400 hover:text-violet-300 rounded transition-colors">
                                  {(mediaMap?.[node.Id]?.length ?? 0) > 0 ? 'Edit media' : '+ Add media'}
                                </button>
                              )}
                            </div>
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
