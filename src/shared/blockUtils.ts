import type { Block, BlockLevel } from '../types'
import { BLOCK_TITLE_DISPLAY_MAX } from './constants'
import { buildBlockTree, type BlockNode } from './blockTree'

/** 兜底：AI 未返回 title 时从用户问题截取 */
export function truncateTitle(text: string, max = 30): string {
  const chars = Array.from(text.trim())
  if (chars.length <= max) return chars.join('')
  return chars.slice(0, max).join('')
}

/**
 * 保存/展示用标题：不按 12 字硬切（避免「React Hook 概念与作用」→「React Hook 概」）。
 * 仅 trim；超长时放宽到 DISPLAY_MAX。
 */
export function normalizeAiTitle(title: string): string {
  const trimmed = title.trim()
  const chars = Array.from(trimmed)
  if (chars.length <= BLOCK_TITLE_DISPLAY_MAX) return trimmed
  return chars.slice(0, BLOCK_TITLE_DISPLAY_MAX).join('')
}

export function resolveParentId(
  blocks: Block[],
  level: BlockLevel
): string | null {
  if (level === 1) return null

  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if (level === 2 && b.level === 1) return b.id
    if (level === 3 && b.level === 2) return b.id
  }

  return null
}

export function nextOrder(blocks: Block[], parentId: string | null): number {
  const siblings = blocks.filter((b) => b.parentId === parentId)
  if (siblings.length === 0) return 0
  return Math.max(...siblings.map((b) => b.order)) + 1
}

export function createBlockFromAI(
  blocks: Block[],
  title: string,
  level: BlockLevel,
  summary: string,
  messageId?: string
): Block {
  const parentId = resolveParentId(blocks, level)
  const trimmedSummary = summary.trim()
  return {
    id: crypto.randomUUID(),
    level,
    title: normalizeAiTitle(title),
    summary: trimmedSummary,
    collected: [],
    noteContent: trimmedSummary,
    isExpanded: false,
    parentId,
    order: nextOrder(blocks, parentId),
    createdAt: Date.now(),
    messageId,
  }
}

/** 向 Block.noteContent 末尾追加文本（与收集追加共用） */
export function appendToNoteContent(block: Block, text: string): Block {
  const piece = text.trim()
  if (!piece) return block

  const existing = block.noteContent.trim()
  const noteContent = existing ? `${existing}\n\n${piece}` : piece
  return { ...block, noteContent }
}

/** 会话中最近创建的 Block（用于 appendToPrevious） */
export function getLastBlockInSession(blocks: Block[]): Block | undefined {
  if (blocks.length === 0) return undefined
  return blocks.reduce((latest, b) =>
    b.createdAt >= latest.createdAt ? b : latest
  )
}

/** 删除指定 Block 及其所有子 Block */
export function removeBlockTree(blocks: Block[], rootId: string): Block[] {
  const idsToRemove = new Set<string>()
  const queue = [rootId]

  while (queue.length > 0) {
    const id = queue.pop()!
    if (idsToRemove.has(id)) continue
    idsToRemove.add(id)
    for (const child of blocks) {
      if (child.parentId === id) queue.push(child.id)
    }
  }

  return blocks.filter((b) => !idsToRemove.has(b.id))
}

function levelFromTreeDepth(depth: number): BlockLevel {
  return Math.min(3, Math.max(1, depth)) as BlockLevel
}

function treeToBlocks(nodes: BlockNode[]): Block[] {
  const flat: Block[] = []
  const walk = (list: BlockNode[], parentId: string | null, depth: number) => {
    list.forEach((node, index) => {
      const { children, ...block } = node
      flat.push({
        ...block,
        parentId,
        order: index,
        level: levelFromTreeDepth(depth),
      })
      walk(children, node.id, depth + 1)
    })
  }
  walk(nodes, null, 1)
  return flat
}

/** 按 parentId/order 重建树并同步 level、order */
export function enforceBlockHierarchy(blocks: Block[]): Block[] {
  if (blocks.length === 0) return blocks
  return treeToBlocks(buildBlockTree(blocks))
}

/**
 * Step 1：按扁平列表新顺序重算各 parent 下的 order（暂不调整 parentId/level）
 */
export function reorderBlocksByFlatOrder(
  blocks: Block[],
  reorderedFlat: Block[]
): Block[] {
  const byId = new Map(blocks.map((b) => [b.id, b]))
  const orderCounter = new Map<string | null, number>()

  return reorderedFlat.map((item) => {
    const block = byId.get(item.id)
    if (!block) return item
    const parentId = block.parentId
    const order = orderCounter.get(parentId) ?? 0
    orderCounter.set(parentId, order + 1)
    return { ...block, order }
  })
}
