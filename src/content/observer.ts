import { CHATGPT_SELECTORS, STREAMING_IDLE_MS } from './config'
import { getSessionId } from './sessionId'
import { sendMessage } from '../shared/runtime'
import { appendBlockFromAI } from '../shared/sessionBlocks'
import { emitThreadMindError } from '../shared/events'
import {
  makeAssistantKey,
  markAssistantProcessed,
  sessionHasBlockForMessage,
} from '../shared/assistantProcessed'
import { getSession } from '../shared/storage'
import { LAST_AI_MSG_MAX, CURRENT_AI_MSG_MAX } from '../shared/constants'
import {
  MessageType,
  type GenerateBlockResponse,
} from '../types'

const processedAssistants = new WeakSet<Element>()

function getMessageText(el: Element): string {
  return (el as HTMLElement).innerText?.trim() ?? ''
}

function getMessageId(el: Element): string | undefined {
  const node = el as HTMLElement
  return (
    node.dataset.messageId ??
    node.getAttribute('data-message-id') ??
    node.dataset.testid ??
    undefined
  )
}

function findPreviousUserMessage(assistantEl: Element): Element | null {
  const all = document.querySelectorAll(
    `${CHATGPT_SELECTORS.userMessage}, ${CHATGPT_SELECTORS.assistantMessage}`
  )
  let prevUser: Element | null = null
  for (const node of all) {
    if (node === assistantEl) break
    if (node.matches(CHATGPT_SELECTORS.userMessage)) {
      prevUser = node
    }
  }
  return prevUser
}

/** 当前 assistant 之前最近一条 AI 回答（用于 lastAiMsg） */
function findLastAssistantBefore(assistantEl: Element): string {
  const all = document.querySelectorAll(
    `${CHATGPT_SELECTORS.userMessage}, ${CHATGPT_SELECTORS.assistantMessage}`
  )
  let lastText = ''
  for (const node of all) {
    if (node === assistantEl) break
    if (node.matches(CHATGPT_SELECTORS.assistantMessage)) {
      lastText = getMessageText(node)
    }
  }
  return Array.from(lastText).slice(0, LAST_AI_MSG_MAX).join('')
}

function detectStreamingEnd(element: Element, callback: () => void): void {
  let timer: ReturnType<typeof setTimeout>
  const observer = new MutationObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      observer.disconnect()
      callback()
    }, STREAMING_IDLE_MS)
  })
  observer.observe(element, { childList: true, subtree: true })
}

async function onAssistantComplete(assistantEl: Element): Promise<void> {
  if (processedAssistants.has(assistantEl)) return
  processedAssistants.add(assistantEl)

  const userEl = findPreviousUserMessage(assistantEl)
  if (!userEl) {
    console.warn('[ThreadMind] no user message before assistant')
    return
  }

  const userMsg = getMessageText(userEl)
  const aiMsg = Array.from(getMessageText(assistantEl))
    .slice(0, CURRENT_AI_MSG_MAX)
    .join('')
  const lastAiMsg = findLastAssistantBefore(assistantEl)

  if (!userMsg || !aiMsg) return

  const sessionId = getSessionId()
  const messageId = getMessageId(assistantEl)
  const assistantKey = makeAssistantKey(messageId, userMsg, aiMsg)

  const session = await getSession(sessionId)
  if (session.processedAssistantKeys.includes(assistantKey)) {
    console.info('[ThreadMind] skip already processed assistant')
    return
  }
  if (sessionHasBlockForMessage(session.blocks, messageId)) {
    await markAssistantProcessed(sessionId, assistantKey)
    console.info('[ThreadMind] skip block exists for message', messageId)
    return
  }

  let result: GenerateBlockResponse
  try {
    result = await sendMessage<GenerateBlockResponse>({
      type: MessageType.GENERATE_BLOCK,
      userMsg,
      aiMsg,
      lastAiMsg,
      sessionId,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    emitThreadMindError(msg)
    return
  }

  if (result.error) {
    emitThreadMindError(result.error)
    return
  }

  if (!result.shouldCreate && !result.appendToPrevious) {
    await markAssistantProcessed(sessionId, assistantKey)
    console.info('[ThreadMind] ignored (no block, no append)')
    return
  }

  const block = await appendBlockFromAI(
    sessionId,
    userMsg,
    result,
    messageId
  )

  if (block) {
    await markAssistantProcessed(sessionId, assistantKey)
    if (result.appendToPrevious) {
      console.info('[ThreadMind] appended to block', block.title)
    } else {
      console.info('[ThreadMind] block added', block.title, `L${block.level}`)
    }
  }
}

function watchAssistantNode(node: Element): void {
  if (!node.matches(CHATGPT_SELECTORS.assistantMessage)) return
  if (processedAssistants.has(node)) return

  detectStreamingEnd(node, () => {
    void onAssistantComplete(node)
  })
}

function scanExistingMessages(root: ParentNode): void {
  root
    .querySelectorAll(CHATGPT_SELECTORS.assistantMessage)
    .forEach((el) => watchAssistantNode(el))
}

let observer: MutationObserver | null = null

export function startObserver(): void {
  if (observer) return

  const root = document.querySelector(CHATGPT_SELECTORS.main) ?? document.body

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return
        if (node.matches(CHATGPT_SELECTORS.assistantMessage)) {
          watchAssistantNode(node)
        }
        node
          .querySelectorAll(CHATGPT_SELECTORS.assistantMessage)
          .forEach((el) => watchAssistantNode(el))
      })
    }
  })

  observer.observe(root, { childList: true, subtree: true })
  scanExistingMessages(root)
  console.info('[ThreadMind] observer started')
}

export function stopObserver(): void {
  observer?.disconnect()
  observer = null
}
