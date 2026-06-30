/** 从 ChatGPT URL 解析会话 ID：/c/{uuid} */
const SESSION_PATH_RE = /^\/c\/([0-9a-f-]+)/i

/** 新对话尚未分配 /c/id 时使用 */
export const DRAFT_SESSION_ID = 'draft'

export function getSessionId(): string {
  const match = location.pathname.match(SESSION_PATH_RE)
  return match?.[1] ?? DRAFT_SESSION_ID
}

export function watchSessionId(onChange: (sessionId: string) => void): () => void {
  let last = getSessionId()

  const check = () => {
    const next = getSessionId()
    if (next !== last) {
      last = next
      onChange(next)
    }
  }

  const observer = new MutationObserver(check)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('popstate', check)
  const timer = window.setInterval(check, 1000)

  return () => {
    observer.disconnect()
    window.removeEventListener('popstate', check)
    window.clearInterval(timer)
  }
}
