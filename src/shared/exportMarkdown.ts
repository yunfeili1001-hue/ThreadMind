import { buildExpandPreviewContent } from './collected'
import { buildBlockTree, type BlockNode } from './blockTree'
import type { Block, BlockLevel } from '../types'

/** L1 → ##，L2 → ###，L3 → #### */
export function headingPrefix(level: BlockLevel): string {
  return '#'.repeat(level + 1)
}

const UNICODE_BULLET_RE = /^(\s*)[·•\u00b7\u2022]\s*/

/** 将 AI 摘要中的 · / • 转为标准 Markdown 无序列表 `- ` */
export function normalizeUnorderedLists(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let inCodeBlock = false

  for (const line of lines) {
    const trimmed = line.trimStart()
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      out.push(line)
      continue
    }
    if (inCodeBlock) {
      out.push(line)
      continue
    }

    if (/^\s*#/.test(line)) {
      out.push(line)
      continue
    }
    if (/^\s*>/.test(line)) {
      out.push(line)
      continue
    }
    if (/^\s*\d+\.\s/.test(line)) {
      out.push(line)
      continue
    }
    if (/^\s*[-*+]\s/.test(line)) {
      out.push(line)
      continue
    }

    const bulletMatch = line.match(UNICODE_BULLET_RE)
    if (bulletMatch) {
      const indent = bulletMatch[1] ?? ''
      const content = line.slice(bulletMatch[0].length)
      out.push(`${indent}- ${content}`)
      continue
    }

    out.push(line)
  }

  return out.join('\n')
}

/** 剥离 HTML / 颜色残留，保留纯文本与 ``` 代码块 */
export function serializeNoteContentForExport(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  let plain = trimmed
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html')
    plain = (doc.body.textContent ?? trimmed)
      .replace(/\u00a0/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  return normalizeUnorderedLists(plain)
}

/** 单个 Block 导出正文：优先 noteContent，兜底 summary + collected */
export function getBlockExportBody(block: Block): string {
  return serializeNoteContentForExport(buildExpandPreviewContent(block))
}

function documentTitle(tree: BlockNode[]): string {
  const firstL1 = tree.find((n) => n.level === 1)
  return firstL1?.title ?? tree[0]?.title ?? 'ThreadMind'
}

function appendBlock(lines: string[], block: Block): void {
  lines.push(`${headingPrefix(block.level)} ${block.title}`, '')
  const body = getBlockExportBody(block)
  if (body) {
    lines.push(body, '')
  }
}

function walkTree(nodes: BlockNode[], lines: string[]): void {
  for (const node of nodes) {
    const { children, ...block } = node
    appendBlock(lines, block)
    walkTree(children, lines)
  }
}

/** 按树深度 + order 遍历，生成 Obsidian 可用 Markdown */
export function blocksToMarkdown(blocks: Block[]): string {
  if (blocks.length === 0) return ''

  const tree = buildBlockTree(blocks)
  const lines: string[] = [`# ${documentTitle(tree)}`, '']

  walkTree(tree, lines)

  return `${lines.join('\n').trim()}\n`
}

export function exportMarkdownFilename(date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `ThreadMind_${yyyy}-${mm}-${dd}.md`
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function copyMarkdownToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }
}
