export const STREAMING_IDLE_MS = 1500
export const API_TIMEOUT_MS = 30_000

export const LAST_AI_MSG_MAX = 800
export const CURRENT_AI_MSG_MAX = 4000

/** Anthropic Messages API 模型 */
export const CLAUDE_MODEL_PRIMARY = 'claude-sonnet-4-6'
export const CLAUDE_MODEL_FALLBACK = 'claude-3-5-sonnet-20241022'

/** Prompt 要求 AI 标题 ≤12 字（仅约束模型，代码不硬切） */
export const BLOCK_TITLE_PROMPT_MAX = 12

/** 展示层安全上限（AI 超长时兜底） */
export const BLOCK_TITLE_DISPLAY_MAX = 18

/** 选区至少多少字符才显示「+ 收集」 */
export const COLLECT_MIN_CHARS = 5
