/** ThreadMind 全局类型与消息协议 */

export type BlockLevel = 1 | 2 | 3

export type CollectedItemType = 'text' | 'code' | 'image'

export interface CollectedItem {
  id: string
  blockId: string
  type: CollectedItemType
  content: string
  createdAt: number
}

export interface Block {
  id: string
  level: BlockLevel
  /** AI 生成的章节式标题（≤12 字） */
  title: string
  /** AI 结构化提取（· 与换行，非摘要段落） */
  summary: string
  /** 用户收集片段 */
  collected: CollectedItem[]
  /** Pre 沉淀区完整内容（摘要 + 收集 + 用户编辑） */
  noteContent: string
  isExpanded: boolean
  parentId: string | null
  order: number
  createdAt: number
  /** 预留：滚动定位 ChatGPT 消息 */
  messageId?: string
}

export interface BlockSession {
  sessionId: string
  blocks: Block[]
  /** 已处理过的 assistant 消息 key，刷新后避免重复生成 Block */
  processedAssistantKeys: string[]
  updatedAt: number
}

// —— 消息类型 ——

export const MessageType = {
  PING: 'PING',
  TEST_STORAGE: 'TEST_STORAGE',
  GENERATE_BLOCK: 'GENERATE_BLOCK',
  ADD_COLLECTED: 'ADD_COLLECTED',
  VERIFY_API_KEY: 'VERIFY_API_KEY',
} as const

export type MessageTypeName = (typeof MessageType)[keyof typeof MessageType]

export interface PingRequest {
  type: typeof MessageType.PING
}

export interface PingResponse {
  ok: true
  pong: number
}

export interface TestStorageRequest {
  type: typeof MessageType.TEST_STORAGE
  payload?: string
}

export interface TestStorageResponse {
  ok: boolean
  written: string
  read: string
}

export interface GenerateBlockRequest {
  type: typeof MessageType.GENERATE_BLOCK
  userMsg: string
  aiMsg: string
  /** 上一条 AI 回答（截断），用于层级判断 */
  lastAiMsg: string
  sessionId: string
}

export interface GenerateBlockResponse {
  shouldCreate: boolean
  /** 追问细节：追加到会话最后一个 Block 的 noteContent */
  appendToPrevious?: boolean
  level?: BlockLevel
  /** ≤12 字章节标题 */
  title?: string
  summary?: string
  error?: string
}

export interface AddCollectedRequest {
  type: typeof MessageType.ADD_COLLECTED
  blockId: string
  content: string
  itemType: CollectedItemType
  sessionId: string
}

export interface AddCollectedResponse {
  ok: boolean
  itemId?: string
  error?: string
}

export interface VerifyApiKeyRequest {
  type: typeof MessageType.VERIFY_API_KEY
  apiKey?: string
}

export interface VerifyApiKeyResponse {
  ok: boolean
  error?: string
}

export type RuntimeMessage =
  | PingRequest
  | TestStorageRequest
  | GenerateBlockRequest
  | AddCollectedRequest
  | VerifyApiKeyRequest

export type RuntimeResponse =
  | PingResponse
  | TestStorageResponse
  | GenerateBlockResponse
  | AddCollectedResponse
  | VerifyApiKeyResponse

// —— 常量 ——

export const SIDEBAR_WIDTH_DEFAULT = 232
/** @deprecated 使用 SIDEBAR_WIDTH_DEFAULT */
export const SIDEBAR_WIDTH = SIDEBAR_WIDTH_DEFAULT
export const SIDEBAR_WIDTH_MIN = 180
export const SIDEBAR_WIDTH_MAX = 480
export const SIDEBAR_WIDTH_STORAGE_KEY = 'threadmind:sidebarWidth'
export const ROOT_ID = 'threadmind-root'
export const STORAGE_KEY_PREFIX = 'threadmind:'

export function storageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${sessionId}`
}

export function createEmptySession(sessionId: string): BlockSession {
  return {
    sessionId,
    blocks: [],
    processedAssistantKeys: [],
    updatedAt: Date.now(),
  }
}
