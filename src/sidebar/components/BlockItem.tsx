import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconGripVertical, IconTrash } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { buildExpandPreviewContent } from '../../shared/collected'
import {
  expandPanelMarginPx,
  rowBodyIndentPx,
} from '../../shared/blockLayout'
import { noteContentToHtml } from '../../shared/noteContent'
import type { Block, BlockLevel } from '../../types'
import styles from '../Sidebar.module.css'
import { NoteEditor } from './NoteEditor'

interface BlockItemProps {
  block: Block
  onToggleExpand: (id: string) => void
  onDelete: (id: string) => void
  onNoteChange: (id: string, noteContent: string) => void
  readOnly?: boolean
  /** DragOverlay 克隆体：无 sortable / 无 grip 事件 */
  overlay?: boolean
  /** 拖动时临时层级（横向偏移预览，Step 3） */
  overrideLevel?: BlockLevel
}

function titleClassForLevel(level: number): string {
  if (level <= 1) return styles.titleL1
  if (level === 2) return styles.titleL2
  return styles.titleL3
}

function BlockItemContent({
  block,
  effectiveLevel,
  indentPx,
  expandMarginPx,
  readOnly,
  overlay,
  confirmDelete,
  setConfirmDelete,
  onToggleExpand,
  onDelete,
  onNoteChange,
  dragHandleProps,
  showLevelPreview,
}: {
  block: Block
  effectiveLevel: BlockLevel
  indentPx: number
  expandMarginPx: number
  readOnly: boolean
  overlay: boolean
  showLevelPreview?: boolean
  confirmDelete: boolean
  setConfirmDelete: (v: boolean) => void
  onToggleExpand: (id: string) => void
  onDelete: (id: string) => void
  onNoteChange: (id: string, noteContent: string) => void
  expandIndentPx?: number
  dragHandleProps?: Record<string, unknown>
}) {
  const displayContent = buildExpandPreviewContent(block)

  useEffect(() => {
    if (overlay || readOnly || !block.isExpanded) return
    if (!block.noteContent.trim() && displayContent.trim()) {
      onNoteChange(block.id, displayContent)
    }
  }, [
    block.id,
    block.isExpanded,
    block.noteContent,
    displayContent,
    overlay,
    readOnly,
    onNoteChange,
  ])

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    onDelete(block.id)
    setConfirmDelete(false)
  }

  return (
    <>
      <div
        className={`${styles.blockRow} ${
          block.isExpanded ? styles.blockRowActive : ''
        }`}
      >
        <span
          className={`${styles.dragHandle} ${overlay ? styles.dragHandleOverlay : ''}`}
          aria-hidden={overlay}
          aria-label={overlay ? undefined : '拖动排序'}
          {...(overlay ? {} : dragHandleProps)}
        >
          <IconGripVertical size={11} stroke={1.75} />
        </span>

        <div
          className={`${styles.rowBody} ${overlay ? styles.rowBodyIndentTransition : ''}`}
          style={{ paddingLeft: indentPx }}
        >
          <button
            type="button"
            className={`${styles.chevron} ${block.isExpanded ? styles.chevronOpen : ''}`}
            aria-expanded={block.isExpanded}
            aria-label={block.isExpanded ? '折叠' : '展开 Pre 沉淀'}
            onClick={() => onToggleExpand(block.id)}
            disabled={readOnly || overlay}
          >
            ▶
          </button>
          <span
            className={`${styles.blockTitle} ${titleClassForLevel(effectiveLevel)}`}
            title={block.title}
          >
            {block.title}
          </span>
        </div>

        {showLevelPreview && (
          <span className={styles.overlayLevelBadge} aria-hidden>
            L{effectiveLevel}
          </span>
        )}

        {!readOnly && !overlay && (
          <div className={styles.rowTrailing}>
            {confirmDelete && (
              <span className={styles.deleteConfirmLabel}>确认删除</span>
            )}
            <button
              type="button"
              className={`${styles.deleteBtn} ${
                confirmDelete ? styles.deleteBtnConfirm : ''
              } ${confirmDelete ? styles.deleteBtnVisible : ''}`}
              aria-label={confirmDelete ? '确认删除' : '删除'}
              onClick={handleDeleteClick}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <IconTrash size={11} stroke={1.75} />
            </button>
          </div>
        )}
      </div>

      {block.isExpanded && (
        <div
          className={`${styles.expandPanel} ${overlay ? styles.rowBodyIndentTransition : ''}`}
        >
          {overlay ? (
            <div
              className={`${styles.noteEditor} ${styles.noteEditorView}`}
              style={{ paddingLeft: expandMarginPx }}
              dangerouslySetInnerHTML={{
                __html: noteContentToHtml(displayContent),
              }}
            />
          ) : (
            <NoteEditor
              blockId={block.id}
              content={displayContent}
              readOnly={readOnly}
              expandIndentPx={expandMarginPx}
              onChange={onNoteChange}
            />
          )}
        </div>
      )}
    </>
  )
}

export function BlockItem({
  block,
  onToggleExpand,
  onDelete,
  onNoteChange,
  readOnly = false,
  overlay = false,
  overrideLevel,
}: BlockItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const effectiveLevel = overrideLevel ?? block.level
  const indentPx = rowBodyIndentPx(effectiveLevel)
  const expandMarginPx = expandPanelMarginPx(effectiveLevel)

  if (overlay) {
    return (
      <div className={`${styles.blockWrap} ${styles.blockWrapOverlay}`}>
        <BlockItemContent
          block={block}
          effectiveLevel={effectiveLevel}
          indentPx={indentPx}
          expandMarginPx={expandMarginPx}
          readOnly
          overlay
          showLevelPreview
          confirmDelete={false}
          setConfirmDelete={() => undefined}
          onToggleExpand={onToggleExpand}
          onDelete={onDelete}
          onNoteChange={onNoteChange}
        />
      </div>
    )
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    disabled: readOnly,
  })

  const setRef = (el: HTMLElement | null) => {
    wrapRef.current = el instanceof HTMLDivElement ? el : null
    setNodeRef(el)
  }

  const style = isDragging
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      }

  return (
    <div
      ref={setRef}
      style={style}
      className={`${styles.blockWrap} ${
        isDragging ? styles.blockWrapDragging : ''
      }`}
      onMouseLeave={() => setConfirmDelete(false)}
    >
      <BlockItemContent
        block={block}
        effectiveLevel={effectiveLevel}
        indentPx={indentPx}
        expandMarginPx={expandMarginPx}
        readOnly={readOnly}
        overlay={false}
        confirmDelete={confirmDelete}
        setConfirmDelete={setConfirmDelete}
        onToggleExpand={onToggleExpand}
        onDelete={onDelete}
        onNoteChange={onNoteChange}
        dragHandleProps={
          readOnly ? undefined : { ...attributes, ...listeners }
        }
      />
    </div>
  )
}
