import { useCallback, useEffect, useState } from 'react'
import { getSessionId, watchSessionId } from '../../shared/sessionId'
import { applyFlatDragResult } from '../../shared/blockDrag'
import { enforceBlockHierarchy, removeBlockTree } from '../../shared/blockUtils'
import type { BlockLevel } from '../../types'
import { THREADMIND_ERROR } from '../../shared/events'
import {
  repairSessionBlocks,
  mergeSummaryAndCollected,
  shouldRehydrateNote,
} from '../../shared/collected'
import { getSession, saveSession } from '../../shared/storage'
import type { Block } from '../../types'
import { storageKey } from '../../types'

export function useBlocks() {
  const [sessionId, setSessionId] = useState(getSessionId)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadSession = useCallback(async (sid: string) => {
    const session = await getSession(sid)
    const repaired = repairSessionBlocks(enforceBlockHierarchy(session.blocks))
    setBlocks(repaired)

    const needsPersist =
      JSON.stringify(session.blocks) !== JSON.stringify(repaired)
    if (!needsPersist) return

    const latest = await getSession(sid)
    const latestRepaired = repairSessionBlocks(
      enforceBlockHierarchy(latest.blocks)
    )
    setBlocks(latestRepaired)

    if (JSON.stringify(latest.blocks) !== JSON.stringify(latestRepaired)) {
      await saveSession({ ...latest, blocks: latestRepaired })
    }
  }, [])

  const persistBlocks = useCallback(
    async (nextBlocks: Block[]) => {
      const session = await getSession(sessionId)
      await saveSession({ ...session, blocks: nextBlocks })
      setBlocks(nextBlocks)
    },
    [sessionId]
  )

  useEffect(() => {
    void loadSession(sessionId)
  }, [sessionId, loadSession])

  useEffect(() => {
    return watchSessionId((nextId) => {
      setSessionId(nextId)
      setError(null)
    })
  }, [])

  useEffect(() => {
    const onStorage = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== 'local') return
      const key = storageKey(sessionId)
      const change = changes[key]
      if (!change) return
      const next = change.newValue as { blocks?: Block[] } | undefined
      setBlocks(
        repairSessionBlocks(enforceBlockHierarchy(next?.blocks ?? []))
      )
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [sessionId])

  useEffect(() => {
    const onError = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (detail) setError(detail)
    }
    window.addEventListener(THREADMIND_ERROR, onError)
    return () => window.removeEventListener(THREADMIND_ERROR, onError)
  }, [])

  const toggleExpand = useCallback(
    async (id: string) => {
      const session = await getSession(sessionId)
      const next = session.blocks.map((b) => {
        if (b.id !== id) return b
        const expanding = !b.isExpanded
        if (!expanding) return { ...b, isExpanded: false }
        const merged = mergeSummaryAndCollected(b)
        const noteContent =
          shouldRehydrateNote(b) && merged ? merged : b.noteContent
        return { ...b, isExpanded: true, noteContent }
      })
      await saveSession({ ...session, blocks: next })
      setBlocks(repairSessionBlocks(next))
    },
    [sessionId]
  )

  const updateNoteContent = useCallback(
    async (id: string, noteContent: string) => {
      const session = await getSession(sessionId)
      const next = session.blocks.map((b) => {
        if (b.id !== id) return b
        const trimmed = noteContent.trim()
        if (!trimmed) {
          const fallback = mergeSummaryAndCollected(b)
          if (fallback) return { ...b, noteContent: fallback }
        }
        return { ...b, noteContent }
      })
      await saveSession({ ...session, blocks: next })
      setBlocks(repairSessionBlocks(next))
    },
    [sessionId]
  )

  const reorderBlocks = useCallback(
    async (
      reorderedFlat: Block[],
      activeId: string,
      dragLevel: BlockLevel | null
    ) => {
      const next = enforceBlockHierarchy(
        applyFlatDragResult(blocks, activeId, reorderedFlat, dragLevel)
      )
      await persistBlocks(next)
    },
    [blocks, persistBlocks]
  )

  const deleteBlock = useCallback(
    async (blockId: string) => {
      const next = removeBlockTree(blocks, blockId)
      if (next.length === blocks.length) return
      await persistBlocks(next)
    },
    [blocks, persistBlocks]
  )

  const clearError = useCallback(() => setError(null), [])
  const setErrorMsg = useCallback((msg: string) => setError(msg), [])

  return {
    blocks,
    sessionId,
    error,
    clearError,
    setError: setErrorMsg,
    toggleExpand,
    updateNoteContent,
    reorderBlocks,
    deleteBlock,
    loadSession,
  }
}
