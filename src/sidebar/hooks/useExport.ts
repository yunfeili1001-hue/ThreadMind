import { useCallback } from 'react'
import {
  blocksToMarkdown,
  copyMarkdownToClipboard,
  downloadMarkdown,
  exportMarkdownFilename,
} from '../../shared/exportMarkdown'
import type { Block } from '../../types'

export function useExport(blocks: Block[]) {
  const getMarkdown = useCallback(() => {
    if (blocks.length === 0) return ''
    return blocksToMarkdown(blocks)
  }, [blocks])

  const exportMarkdown = useCallback(() => {
    const markdown = getMarkdown()
    if (!markdown.trim()) return
    downloadMarkdown(markdown, exportMarkdownFilename())
  }, [getMarkdown])

  const copyMarkdown = useCallback(async (): Promise<boolean> => {
    const markdown = getMarkdown()
    if (!markdown.trim()) return false
    return copyMarkdownToClipboard(markdown)
  }, [getMarkdown])

  return { exportMarkdown, copyMarkdown }
}
