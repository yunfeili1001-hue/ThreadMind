import type { Block, GenerateBlockResponse } from '../types'
import { ensureBlockNoteContent } from './collected'
import {
  appendToNoteContent,
  createBlockFromAI,
  getLastBlockInSession,
  normalizeAiTitle,
  truncateTitle,
} from './blockUtils'
import { getSession, saveSession } from './storage'

export async function appendBlockFromAI(
  sessionId: string,
  userMsg: string,
  result: GenerateBlockResponse,
  messageId?: string
): Promise<Block | null> {
  if (result.appendToPrevious && result.summary?.trim()) {
    return appendSummaryToLastBlock(sessionId, result.summary)
  }

  if (!result.shouldCreate || !result.level || !result.summary) {
    return null
  }

  const session = await getSession(sessionId)
  if (messageId) {
    const existing = session.blocks.find((b) => b.messageId === messageId)
    if (existing) return existing
  }

  const title =
    result.title?.trim() ||
    normalizeAiTitle(truncateTitle(userMsg, 18))

  const block = createBlockFromAI(
    session.blocks,
    title,
    result.level,
    result.summary,
    messageId
  )

  // 写入前再读一次，避免与侧栏 loadSession 修复写入互相覆盖
  const latest = await getSession(sessionId)
  await saveSession({
    ...latest,
    blocks: [...latest.blocks, block],
  })
  return block
}

/** 将 summary 追加到会话最后一个 Block */
export async function appendSummaryToLastBlock(
  sessionId: string,
  summary: string
): Promise<Block | null> {
  const session = await getSession(sessionId)
  const last = getLastBlockInSession(session.blocks)
  if (!last) {
    console.warn('[ThreadMind] appendToPrevious: no block in session')
    return null
  }

  const piece = summary.trim()
  const newSummary = last.summary.trim()
    ? `${last.summary.trim()}\n\n${piece}`
    : piece

  let noteContent = last.noteContent.trim()
  if (!noteContent) {
    noteContent = newSummary
  } else if (!noteContent.includes(piece)) {
    noteContent = appendToNoteContent(last, piece).noteContent
  }

  const updated = ensureBlockNoteContent({
    ...last,
    summary: newSummary,
    noteContent,
  })

  const latest = await getSession(sessionId)
  const blocks = latest.blocks.map((b) => (b.id === last.id ? updated : b))
  await saveSession({ ...latest, blocks })
  return updated
}
