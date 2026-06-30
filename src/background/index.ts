import { generateBlockWithClaude, verifyApiKey } from './claude'
import { addCollectedToSession } from '../shared/collected'
import {
  MessageType,
  type AddCollectedRequest,
  type AddCollectedResponse,
  type GenerateBlockRequest,
  type GenerateBlockResponse,
  type PingResponse,
  type RuntimeMessage,
  type TestStorageResponse,
} from '../types'
import { getSession } from '../shared/storage'
import { testStorageRoundTrip } from '../shared/storage'

console.info('[ThreadMind] background service worker started')

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : String(err)
        console.error('[ThreadMind] message handler error', error)
        sendResponse({ shouldCreate: false, error } satisfies GenerateBlockResponse)
      })
    return true
  }
)

async function handleMessage(message: RuntimeMessage): Promise<unknown> {
  switch (message.type) {
    case MessageType.PING:
      return handlePing()
    case MessageType.TEST_STORAGE:
      return handleTestStorage(message.payload)
    case MessageType.GENERATE_BLOCK:
      return handleGenerateBlock(message)
    case MessageType.VERIFY_API_KEY:
      return verifyApiKey(message.apiKey)
    case MessageType.ADD_COLLECTED:
      return handleAddCollected(message)
    default:
      return { shouldCreate: false, error: 'Unknown message type' }
  }
}

function handlePing(): PingResponse {
  return { ok: true, pong: Date.now() }
}

async function handleTestStorage(
  payload?: string
): Promise<TestStorageResponse> {
  const value = payload ?? `threadmind-test-${Date.now()}`
  const { written, read } = await testStorageRoundTrip(value)
  return {
    ok: written === read,
    written,
    read,
  }
}

async function handleGenerateBlock(
  req: GenerateBlockRequest
): Promise<GenerateBlockResponse> {
  const session = await getSession(req.sessionId)
  return generateBlockWithClaude(
    req.userMsg,
    req.aiMsg,
    req.lastAiMsg,
    session.blocks
  )
}

async function handleAddCollected(
  req: AddCollectedRequest
): Promise<AddCollectedResponse> {
  const result = await addCollectedToSession(
    req.sessionId,
    req.blockId,
    req.content,
    req.itemType
  )
  if (!result.ok) {
    return { ok: false, error: result.error }
  }
  return { ok: true, itemId: result.itemId }
}
