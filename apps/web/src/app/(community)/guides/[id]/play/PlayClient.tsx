'use client'
import { useState } from 'react'
import type { AnnotationNode, AnnotationMedia, GrenadeType } from '@cs2ann/shared/web'
import InteractiveMapView from '@/components/InteractiveMapView'
import PlayFilters from '@/components/play/PlayFilters'
import MediaPanel from '@/components/play/MediaPanel'

interface Props {
  guideId: string
  mapName: string
  nodes: AnnotationNode[]
  mediaMap: Record<string, AnnotationMedia[]>
}

export default function PlayClient({ mapName, nodes, mediaMap }: Props) {
  const [grenadeType, setGrenadeType] = useState<GrenadeType | null>(null)
  const [side,        setSide]        = useState<'T' | 'CT' | null>(null)
  const [pinMode,     setPinMode]     = useState<'throw' | 'landing'>('throw')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const filterTypes = grenadeType ? [grenadeType] : undefined
  const selectedMedia = selectedNodeId ? (mediaMap[selectedNodeId] ?? []) : []

  return (
    <div className="flex flex-1 min-h-0">
      {/* map area */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
          <PlayFilters
            grenadeType={grenadeType}
            side={side}
            pinMode={pinMode}
            onGrenadeType={setGrenadeType}
            onSide={setSide}
            onPinMode={setPinMode}
          />
        </div>
        <div className="flex-1 min-h-0">
          <InteractiveMapView
            nodes={nodes}
            mapName={mapName}
            filterTypes={filterTypes}
            mediaMap={mediaMap}
            pinMode={pinMode}
            className="h-full"
            onPinClick={(nodeId) => setSelectedNodeId(nodeId)}
          />
        </div>
      </div>

      {/* fixed media panel */}
      <MediaPanel media={selectedMedia} />
    </div>
  )
}
