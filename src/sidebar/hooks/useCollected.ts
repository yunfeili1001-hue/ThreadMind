import { useCallback } from 'react'
import { addCollectedToSession } from '../../shared/collected'
import type { CollectedItemType } from '../../types'

/** 侧栏内主动追加收集（与 content collector 共用存储逻辑） */
export function useCollected(sessionId: string) {
  const addCollected = useCallback(
    async (
      blockId: string,
      content: string,
      itemType: CollectedItemType
    ) => {
      return addCollectedToSession(sessionId, blockId, content, itemType)
    },
    [sessionId]
  )

  return { addCollected }
}
