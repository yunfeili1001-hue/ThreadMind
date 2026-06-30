export const THREADMIND_ERROR = 'threadmind:error'

export function emitThreadMindError(message: string): void {
  window.dispatchEvent(
    new CustomEvent(THREADMIND_ERROR, { detail: message })
  )
}
