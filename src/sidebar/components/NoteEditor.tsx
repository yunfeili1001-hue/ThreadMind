import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  NOTE_PLACEHOLDER,
  htmlToNoteContent,
  noteContentToHtml,
} from '../../shared/noteContent'
import styles from '../Sidebar.module.css'

interface NoteEditorProps {
  blockId: string
  content: string
  readOnly?: boolean
  autoFocus?: boolean
  /** 与标题层级对齐的左侧缩进（仅查看态） */
  expandIndentPx?: number
  onChange: (blockId: string, noteContent: string) => void
}

export function NoteEditor({
  blockId,
  content,
  readOnly = false,
  autoFocus = false,
  expandIndentPx = 0,
  onChange,
}: NoteEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const focusedRef = useRef(false)
  const debounceRef = useRef<number | null>(null)
  const lastSyncedContentRef = useRef('')
  const seedContentRef = useRef(content)
  const [isEmpty, setIsEmpty] = useState(() => !content.trim())
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    seedContentRef.current = content
  }, [content])

  const syncFromProp = useCallback(() => {
    const el = editorRef.current
    if (!el || focusedRef.current) return
    if (lastSyncedContentRef.current === content) return
    const html = noteContentToHtml(content)
    el.innerHTML = html || ''
    lastSyncedContentRef.current = content
    setIsEmpty(!content.trim())
  }, [content])

  useLayoutEffect(() => {
    syncFromProp()
  }, [syncFromProp, blockId])

  useEffect(() => {
    if (!autoFocus || readOnly || !content.trim()) return
    const el = editorRef.current
    if (!el) return
    const id = window.requestAnimationFrame(() => {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
    return () => window.cancelAnimationFrame(id)
  }, [autoFocus, readOnly, blockId, content])

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const setEditorRef = useCallback(
    (el: HTMLDivElement | null) => {
      editorRef.current = el
      if (!el || focusedRef.current) return
      if (content.trim() && el.innerHTML === '') {
        el.innerHTML = noteContentToHtml(content)
        lastSyncedContentRef.current = content
        setIsEmpty(false)
      }
    },
    [content]
  )

  const persist = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const next = htmlToNoteContent(el)
    if (!next.trim() && seedContentRef.current.trim()) return
    lastSyncedContentRef.current = next
    setIsEmpty(!next.trim())
    onChange(blockId, next)
  }, [blockId, onChange])

  const handleInput = () => {
    if (readOnly) return
    const el = editorRef.current
    if (el) {
      setIsEmpty(!htmlToNoteContent(el).trim())
    }
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current)
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      persist()
    }, 250)
  }

  const handleBlur = () => {
    focusedRef.current = false
    setIsFocused(false)
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    persist()
  }

  const handleFocus = () => {
    focusedRef.current = true
    setIsFocused(true)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (readOnly) return
    const el = editorRef.current
    if (!el) return
    if (!focusedRef.current) {
      el.focus()
    }
  }

  const isEditing = isFocused && !readOnly
  const indentStyle =
    !isEditing && expandIndentPx > 0
      ? { paddingLeft: expandIndentPx }
      : undefined

  return (
    <div
      className={`${styles.noteEditorWrap} ${
        isEditing ? styles.noteEditorWrapEditing : ''
      }`}
    >
      <div
        ref={setEditorRef}
        className={`${styles.noteEditor} ${
          isEditing ? styles.noteEditorEditing : styles.noteEditorView
        } ${isEmpty ? styles.noteEditorEmpty : ''}`}
        style={indentStyle}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label="Notes editor"
        data-placeholder={NOTE_PLACEHOLDER}
        onInput={handleInput}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onPointerDown={handlePointerDown}
        onKeyDown={(e) => e.stopPropagation()}
      />
      {!readOnly && !isFocused && (
        <span
          className={styles.noteEditorHint}
          style={indentStyle}
          aria-hidden
        >
          Click to edit · Auto-saves
        </span>
      )}
    </div>
  )
}
