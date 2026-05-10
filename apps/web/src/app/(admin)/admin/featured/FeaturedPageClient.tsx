'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import FeaturedGuideCard from './FeaturedGuideCard'
import type { FeaturedItem } from './FeaturedGuideCard'
import GuideBrowserModal from './GuideBrowserModal'
import { reorderFeaturedGuides } from './actions'

export default function FeaturedPageClient({ initialItems }: { initialItems: FeaturedItem[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [showBrowser, setShowBrowser] = useState(false)

  // Sync local state when server re-renders (after add/remove)
  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)
    void reorderFeaturedGuides(reordered.map((i) => i.id))
  }

  const featuredGuideIds = new Set(items.map((i) => i.guideId))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-white">Featured Guides</h1>
        <button
          type="button"
          onClick={() => setShowBrowser(true)}
          className="px-4 py-2 bg-violet-700 hover:bg-violet-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Add featured guide
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-zinc-500 text-sm">
          No featured guides yet. Click &quot;Add featured guide&quot; to get started.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {items.map((item) => (
              <FeaturedGuideCard key={item.id} item={item} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {showBrowser && (
        <GuideBrowserModal
          featuredGuideIds={featuredGuideIds}
          onClose={() => {
            setShowBrowser(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
