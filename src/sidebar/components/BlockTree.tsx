import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useMemo, useRef, useState } from 'react'
import type { Block, BlockLevel } from '../../types'
import {
  moveSubtreeInFlatList,
  resolveLevelFromDragDelta,
} from '../../shared/blockDrag'
import { flattenBlockTree } from '../../shared/blockTree'
import styles from '../Sidebar.module.css'
import { BlockItem } from './BlockItem'

interface BlockTreeProps {
  blocks: Block[]
  onToggleExpand: (id: string) => void
  onDelete: (id: string) => void
  onNoteChange: (id: string, noteContent: string) => void
  onReorderBlocks: (
    reorderedFlat: Block[],
    activeId: string,
    dragLevel: BlockLevel | null
  ) => void
}

export function BlockTree({
  blocks,
  onToggleExpand,
  onDelete,
  onNoteChange,
  onReorderBlocks,
}: BlockTreeProps) {
  const flatBlocks = useMemo(() => flattenBlockTree(blocks), [blocks])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragLevel, setDragLevel] = useState<BlockLevel | null>(null)
  const startLevelRef = useRef<BlockLevel | null>(null)

  const activeBlock = useMemo(
    () => flatBlocks.find((b) => b.id === activeId),
    [flatBlocks, activeId]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const clearDragState = () => {
    setActiveId(null)
    setDragLevel(null)
    startLevelRef.current = null
  }

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    const block = flatBlocks.find((b) => b.id === id)
    const startLevel = block?.level ?? 1
    startLevelRef.current = startLevel
    setActiveId(id)
    setDragLevel(resolveLevelFromDragDelta(startLevel, 0))
  }

  const handleDragMove = (event: DragMoveEvent) => {
    const startLevel = startLevelRef.current
    if (startLevel === null) return
    setDragLevel(resolveLevelFromDragDelta(startLevel, event.delta.x))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const startLevel = startLevelRef.current
    const levelOnDrop =
      startLevel !== null
        ? resolveLevelFromDragDelta(startLevel, event.delta.x)
        : dragLevel ?? activeBlock?.level ?? null

    const activeKey = String(active.id)

    if (over && active.id !== over.id) {
      const reordered = moveSubtreeInFlatList(
        flatBlocks,
        activeKey,
        String(over.id)
      )
      onReorderBlocks(reordered, activeKey, levelOnDrop)
    } else if (
      activeBlock &&
      levelOnDrop !== null &&
      levelOnDrop !== activeBlock.level
    ) {
      onReorderBlocks(flatBlocks, activeKey, levelOnDrop)
    }

    clearDragState()
  }

  if (flatBlocks.length === 0) {
    return (
      <p className={styles.emptyState}>
        No blocks yet. Start chatting with ChatGPT to generate them.
      </p>
    )
  }

  const previewLevel =
    dragLevel ?? activeBlock?.level ?? null

  return (
    <div className={styles.dndRoot}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={clearDragState}
      >
        <SortableContext
          items={flatBlocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {flatBlocks.map((block) => (
            <BlockItem
              key={block.id}
              block={block}
              onToggleExpand={onToggleExpand}
              onDelete={onDelete}
              onNoteChange={onNoteChange}
            />
          ))}
        </SortableContext>

        <DragOverlay
          adjustScale={false}
          dropAnimation={{ duration: 150, easing: 'ease' }}
          className={styles.dragOverlayLayer}
        >
          {activeBlock && previewLevel ? (
            <BlockItem
              block={activeBlock}
              onToggleExpand={() => undefined}
              onDelete={() => undefined}
              onNoteChange={() => undefined}
              readOnly
              overlay
              overrideLevel={previewLevel}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
