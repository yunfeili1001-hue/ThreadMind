/** Pre 沉淀区：plain text（含 ``` 代码块）↔ contenteditable HTML */

const CODE_FENCE_RE = /```\n?([\s\S]*?)```/g

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function plainSegmentToHtml(text: string): string {
  if (!text) return ''
  return escapeHtml(text).replace(/\n/g, '<br>')
}

/** 将 noteContent 转为 contenteditable 内 HTML */
export function noteContentToHtml(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const parts: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const re = new RegExp(CODE_FENCE_RE.source, 'g')

  while ((match = re.exec(trimmed)) !== null) {
    if (match.index > lastIndex) {
      parts.push(plainSegmentToHtml(trimmed.slice(lastIndex, match.index)))
    }
    const code = match[1] ?? ''
    parts.push(
      `<pre class="noteCode" spellcheck="false"><code>${escapeHtml(code)}</code></pre>`
    )
    lastIndex = re.lastIndex
  }

  if (lastIndex < trimmed.length) {
    parts.push(plainSegmentToHtml(trimmed.slice(lastIndex)))
  }

  return parts.join('')
}

/** 从 contenteditable 根节点序列化为 plain text noteContent */
export function htmlToNoteContent(root: HTMLElement): string {
  const chunks: string[] = []

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      chunks.push(node.textContent ?? '')
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement

    if (el.tagName === 'BR') {
      chunks.push('\n')
      return
    }

    if (el.tagName === 'PRE' && el.classList.contains('noteCode')) {
      const code = el.textContent ?? ''
      chunks.push(`\n\`\`\`\n${code}\n\`\`\`\n`)
      return
    }

    if (el.tagName === 'DIV' || el.tagName === 'P') {
      if (chunks.length > 0 && !chunks[chunks.length - 1]!.endsWith('\n')) {
        chunks.push('\n')
      }
      el.childNodes.forEach(walk)
      return
    }

    el.childNodes.forEach(walk)
  }

  root.childNodes.forEach(walk)

  return chunks
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const NOTE_PLACEHOLDER =
  'Select text or code in ChatGPT and click "+ Collect" to add it here'
