import type { Block, CollectedItem, CollectedItemType } from '../types'
import { appendToNoteContent } from './blockUtils'
import { getSession, saveSession } from './storage'

export function formatCollectedForNote(
  type: CollectedItemType,
  content: string
): string {
  const trimmed = content.trim()
  if (!trimmed) return ''
  if (type === 'code') {
    return `\`\`\`\n${trimmed}\n\`\`\``
  }
  return trimmed
}

function noteIncludesAllCollected(note: string, block: Block): boolean {
  return block.collected.every((item) => note.includes(item.content.trim()))
}

function summaryAnchor(summary: string): string {
  const line = summary.split('\n').find((l) => l.trim())?.trim() ?? ''
  return line.slice(0, Math.min(24, line.length))
}

/** noteContent 是否丢失 summary / collected，需要重新合并（仅修复空/残缺内容，不覆盖用户有效编辑） */
export function shouldRehydrateNote(block: Block): boolean {
  const merged = mergeSummaryAndCollected(block)
  const note = block.noteContent.trim()
  if (!merged) return false
  if (!note) return true
  // 用户已编辑且 note 比 summary 更长：视为有效内容，不强制覆盖
  if (note.length > block.summary.trim().length + 16) return false
  const anchor = summaryAnchor(block.summary)
  if (anchor && !note.includes(anchor)) return true
  if (block.collected.length > 0 && !noteIncludesAllCollected(note, block)) {
    return true
  }
  return false
}

/** 收集后同步 noteContent：展开 / 自动展开时保证侧栏可见 */
function syncNoteAfterCollect(block: Block, piece: string): Block {
  const merged = mergeSummaryAndCollected(block)

  if (!block.noteContent.trim()) {
    return { ...block, noteContent: merged }
  }

  if (!noteIncludesAllCollected(block.noteContent, block)) {
    return { ...block, noteContent: merged }
  }

  if (!block.noteContent.includes(piece.trim())) {
    return appendToNoteContent(block, piece)
  }

  return block
}

/** 将 summary 与 collected[] 合并为一段文本（用于 noteContent 同步与展示兜底） */
export function mergeSummaryAndCollected(block: Block): string {
  const parts: string[] = []
  if (block.summary.trim()) parts.push(block.summary.trim())
  for (const item of block.collected) {
    const piece = formatCollectedForNote(item.type, item.content)
    if (piece) parts.push(piece)
  }
  return parts.join('\n\n')
}

/** noteContent 为空时，用 summary + collected 填充（不限于已展开） */
export function ensureBlockNoteContent(block: Block): Block {
  if (!shouldRehydrateNote(block)) return block
  const merged = mergeSummaryAndCollected(block)
  if (!merged) return block
  return { ...block, noteContent: merged }
}

export function ensureBlocksNoteContent(blocks: Block[]): Block[] {
  return blocks.map(ensureBlockNoteContent)
}

/** 修复 noteContent，保留层级结构（供 loadSession / onChanged 使用） */
export function repairSessionBlocks(blocks: Block[]): Block[] {
  return ensureBlocksNoteContent(blocks)
}

/** 展开区展示：优先完整合并视图，避免 note 丢失 summary */
export function buildExpandPreviewContent(block: Block): string {
  const merged = mergeSummaryAndCollected(block)
  const note = block.noteContent.trim()
  if (!note) return merged
  if (shouldRehydrateNote(block)) return merged
  return note
}

export async function addCollectedToSession(
  sessionId: string,
  blockId: string,
  content: string,
  itemType: CollectedItemType
): Promise<{ ok: true; itemId: string } | { ok: false; error: string }> {
  const trimmed = content.trim()
  if (!trimmed) {
    return { ok: false, error: 'Nothing to collect' }
  }

  const session = await getSession(sessionId)
  const index = session.blocks.findIndex((b) => b.id === blockId)
  if (index < 0) {
    return { ok: false, error: 'Target block not found' }
  }

  const block = session.blocks[index]
  const item: CollectedItem = {
    id: crypto.randomUUID(),
    blockId,
    type: itemType,
    content: trimmed,
    createdAt: Date.now(),
  }

  let updated: Block = {
    ...block,
    collected: [...block.collected, item],
    isExpanded: true,
  }

  const piece = formatCollectedForNote(itemType, trimmed)
  updated = ensureBlockNoteContent(syncNoteAfterCollect(updated, piece))

  const blocks = session.blocks.map((b, i) => (i === index ? updated : b))
  await saveSession({ ...session, blocks })

  return { ok: true, itemId: item.id }
}
