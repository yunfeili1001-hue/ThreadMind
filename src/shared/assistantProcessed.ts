import type { Block } from '../types'
import { getSession, saveSession } from './storage'

/** 为 assistant 消息生成稳定去重 key（优先 DOM messageId，否则 user+ai 指纹） */
export function makeAssistantKey(
  messageId: string | undefined,
  userMsg: string,
  aiMsg: string
): string {
  if (messageId) return `id:${messageId}`
  const user = userMsg.trim().slice(0, 120)
  const ai = aiMsg.trim().slice(0, 200)
  return `fp:${user}::${ai}`
}

export function sessionHasBlockForMessage(
  blocks: Block[],
  messageId: string | undefined
): boolean {
  if (!messageId) return false
  return blocks.some((b) => b.messageId === messageId)
}

export async function markAssistantProcessed(
  sessionId: string,
  key: string
): Promise<void> {
  const session = await getSession(sessionId)
  if (session.processedAssistantKeys.includes(key)) return
  await saveSession({
    ...session,
    processedAssistantKeys: [...session.processedAssistantKeys, key],
  })
}
