import { CHATGPT_SELECTORS } from './config'
import { COLLECT_MIN_CHARS } from '../shared/constants'
import { emitThreadMindError } from '../shared/events'
import { getLastBlockInSession } from '../shared/blockUtils'
import { sendMessage } from '../shared/runtime'
import { getSession } from '../shared/storage'
import { getSessionId } from './sessionId'
import {
  MessageType,
  type AddCollectedResponse,
  type CollectedItemType,
} from '../types'

const OVERLAY_ID = 'threadmind-collect-overlay'
const MARK_CLASS = 'threadmind-collected-mark'

interface PendingCollect {
  text: string
  itemType: CollectedItemType
  range: Range
  blockId: string
}

let overlayEl: HTMLButtonElement | null = null
let pending: PendingCollect | null = null
let listening = false

function getAssistantMessageForNode(node: Node): Element | null {
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement
  return el?.closest(CHATGPT_SELECTORS.assistantMessage) ?? null
}

function isSelectionInAssistantMessage(sel: Selection): boolean {
  if (!sel.rangeCount) return false
  const range = sel.getRangeAt(0)
  const start = getAssistantMessageForNode(range.startContainer)
  const end = getAssistantMessageForNode(range.endContainer)
  return start !== null && start === end
}

function detectCollectedType(range: Range): CollectedItemType {
  const probe =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as Element)
      : range.commonAncestorContainer.parentElement

  if (probe?.closest('code, pre')) return 'code'

  const fragment = range.cloneContents()
  if (fragment.querySelector('code, pre')) return 'code'

  return 'text'
}

function hideOverlay(): void {
  overlayEl?.remove()
  overlayEl = null
}

/** ChatGPT 选区上方原生工具栏大约高度，用于避让 */
const NATIVE_TOOLBAR_CLEARANCE_PX = 48
const VIEWPORT_EDGE_PX = 8
const GAP_PX = 10

function positionOverlay(rect: DOMRect): void {
  if (!overlayEl) return

  const btnW = overlayEl.offsetWidth
  const btnH = overlayEl.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight

  // 优先：选区下方（避开 ChatGPT 上方「询问 / 写作」白条）
  let top = rect.bottom + GAP_PX
  let left = rect.left

  // 下方空间不足 → 放到选区右侧
  if (top + btnH > vh - VIEWPORT_EDGE_PX) {
    top = rect.top
    left = rect.right + GAP_PX
  }

  // 右侧也不够 → 放到选区左侧
  if (left + btnW > vw - VIEWPORT_EDGE_PX) {
    left = rect.left - btnW - GAP_PX
    top = rect.top
  }

  // 仍可能与上方工具栏重叠 → 再下移
  if (top < NATIVE_TOOLBAR_CLEARANCE_PX && rect.bottom + GAP_PX + btnH < vh - VIEWPORT_EDGE_PX) {
    top = rect.bottom + GAP_PX
    left = rect.left
  }

  top = Math.max(VIEWPORT_EDGE_PX, Math.min(top, vh - btnH - VIEWPORT_EDGE_PX))
  left = Math.max(VIEWPORT_EDGE_PX, Math.min(left, vw - btnW - VIEWPORT_EDGE_PX))

  overlayEl.style.position = 'fixed'
  overlayEl.style.top = `${top}px`
  overlayEl.style.left = `${left}px`
}

function showOverlay(rect: DOMRect, onCollect: () => void): void {
  hideOverlay()

  const btn = document.createElement('button')
  btn.id = OVERLAY_ID
  btn.type = 'button'
  btn.className = 'threadmind-collect-btn'
  btn.textContent = '+ Collect'
  btn.addEventListener('mousedown', (e) => e.preventDefault())
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    onCollect()
  })

  document.body.appendChild(btn)
  overlayEl = btn
  requestAnimationFrame(() => {
    positionOverlay(rect)
  })
}

function applyMarkToRange(range: Range): void {
  const mark = document.createElement('mark')
  mark.className = MARK_CLASS

  try {
    range.surroundContents(mark)
  } catch {
    const fragment = range.extractContents()
    mark.appendChild(fragment)
    range.insertNode(mark)
  }
}

async function resolveTargetBlockId(): Promise<string | null> {
  const sessionId = getSessionId()
  const session = await getSession(sessionId)
  const last = getLastBlockInSession(session.blocks)
  return last?.id ?? null
}

async function submitCollect(data: PendingCollect): Promise<void> {
  const sessionId = getSessionId()
  try {
    const res = await sendMessage<AddCollectedResponse>({
      type: MessageType.ADD_COLLECTED,
      sessionId,
      blockId: data.blockId,
      content: data.text,
      itemType: data.itemType,
    })

    if (!res.ok) {
      emitThreadMindError(res.error ?? 'Collection failed')
    }
  } catch (err) {
    emitThreadMindError(
      err instanceof Error ? err.message : 'Collection request failed'
    )
  }
}

async function onCollectClick(): Promise<void> {
  if (!pending) return

  const data = pending
  pending = null
  hideOverlay()

  try {
    applyMarkToRange(data.range)
  } catch (err) {
    console.warn('[ThreadMind] mark wrap failed', err)
  }

  window.getSelection()?.removeAllRanges()
  await submitCollect(data)
}

async function onMouseUp(): Promise<void> {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
    hideOverlay()
    pending = null
    return
  }

  if (!isSelectionInAssistantMessage(sel)) {
    hideOverlay()
    pending = null
    return
  }

  const text = sel.toString().trim()
  if (text.length < COLLECT_MIN_CHARS) {
    hideOverlay()
    pending = null
    return
  }

  const blockId = await resolveTargetBlockId()
  if (!blockId) {
    hideOverlay()
    pending = null
    emitThreadMindError('Start a ChatGPT conversation to generate blocks before collecting')
    return
  }

  const range = sel.getRangeAt(0).cloneRange()
  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    hideOverlay()
    pending = null
    return
  }

  pending = {
    text,
    itemType: detectCollectedType(range),
    range,
    blockId,
  }

  showOverlay(rect, () => {
    void onCollectClick()
  })
}

function onDocumentMouseDown(e: MouseEvent): void {
  const target = e.target
  if (target instanceof Node && overlayEl?.contains(target)) return
  hideOverlay()
  pending = null
}

function onDocumentKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    hideOverlay()
    pending = null
  }
}

export function startCollector(): void {
  if (listening) return
  listening = true

  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('mousedown', onDocumentMouseDown, true)
  document.addEventListener('keydown', onDocumentKeyDown)
  window.addEventListener('scroll', hideOverlay, true)

  console.info('[ThreadMind] collector started')
}

export function stopCollector(): void {
  if (!listening) return
  listening = false

  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
  document.removeEventListener('keydown', onDocumentKeyDown)
  window.removeEventListener('scroll', hideOverlay, true)

  hideOverlay()
  pending = null
}
