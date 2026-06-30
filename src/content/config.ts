import { STREAMING_IDLE_MS } from '../shared/constants'

export { STREAMING_IDLE_MS }

/** ChatGPT DOM 选择器集中配置（DOM 变更时只改此文件） */
export const CHATGPT_SELECTORS = {
  main: 'main',
  userMessage: '[data-message-author-role="user"]',
  assistantMessage: '[data-message-author-role="assistant"]',
} as const
