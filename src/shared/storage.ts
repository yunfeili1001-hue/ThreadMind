import type { BlockSession } from '../types'
import { createEmptySession, storageKey } from '../types'

function backfillProcessedKeysFromBlocks(session: BlockSession): BlockSession {
  const keys = new Set(session.processedAssistantKeys)
  for (const block of session.blocks) {
    if (block.messageId) keys.add(`id:${block.messageId}`)
  }
  const processedAssistantKeys = [...keys]
  if (processedAssistantKeys.length === session.processedAssistantKeys.length) {
    return session
  }
  return { ...session, processedAssistantKeys }
}

export async function getSession(sessionId: string): Promise<BlockSession> {
  const key = storageKey(sessionId)
  const result = await chrome.storage.local.get(key)
  const data = result[key] as BlockSession | undefined
  const base = data ?? createEmptySession(sessionId)
  const normalized: BlockSession = {
    ...base,
    processedAssistantKeys: base.processedAssistantKeys ?? [],
  }
  return backfillProcessedKeysFromBlocks(normalized)
}

export async function saveSession(session: BlockSession): Promise<void> {
  const key = storageKey(session.sessionId)
  await chrome.storage.local.set({
    [key]: { ...session, updatedAt: Date.now() },
  })
}

export async function testStorageRoundTrip(
  testValue: string
): Promise<{ written: string; read: string }> {
  const key = 'threadmind:__test__'
  await chrome.storage.local.set({ [key]: testValue })
  const result = await chrome.storage.local.get(key)
  const read = (result[key] as string | undefined) ?? ''
  await chrome.storage.local.remove(key)
  return { written: testValue, read }
}
