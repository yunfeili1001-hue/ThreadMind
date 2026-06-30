import type { Block, GenerateBlockResponse } from '../types'
import { getStoredApiKey, normalizeApiKey } from '../shared/apiKey'
import {
  API_TIMEOUT_MS,
  CLAUDE_MODEL_FALLBACK,
  CLAUDE_MODEL_PRIMARY,
} from '../shared/constants'
import { normalizeAiTitle } from '../shared/blockUtils'

const MODEL_CANDIDATES = [CLAUDE_MODEL_PRIMARY, CLAUDE_MODEL_FALLBACK] as const

const SYSTEM_PROMPT = `你是一个知识提炼助手。根据对话上下文判断三种处理方式之一，并按要求生成字段。

## 第一步：这个问题脱离「上一条 AI 回答」lastAiMsg 还能独立成立吗？
- **能** → shouldCreate: true，进入「新建 Block」流程（判断 level、title、summary）
- **不能** → 进入第二步

## 第二步（问题不能独立成立时）：当前 AI 回答用户事后会单独回顾吗？
- **会**（引入了新概念或新机制）→ shouldCreate: true，level 在「最近一个 Block」的 level 基础上加深一级（L1→2，L2→3；若无最近 Block 则 level 2）
- **不会**（举例、换个方式解释、追问细节、补充说明）→ appendToPrevious: true，只输出 summary，不新建 Block

## 第三步（忽略）
纯寒暄、无知识价值、或用户仅要求重复上一句而无新信息 → shouldCreate: false, appendToPrevious: false

---

### 新建 Block（shouldCreate: true）时额外规则

**level**（结合 lastAiMsg 与历史目录）：
- 可独立理解的新话题 → level 1
- 同一话题深入、仍不依赖 lastAiMsg 才能懂 → level 2
- 必须依赖上文才能理解，且值得单独成节 → 有最近 L2 则 level 3，否则 level 2

**title**（≤12 字，章节名）：
- 去掉疑问语气与口语前缀
- 示例：「React 里 Hook 到底是啥」→「React Hook 概念」

**summary**（结构化提取，非段落摘要）：
- 用 · 表示条目，换行表示层级；总长度 ≤150 字
- 纯文本，不用 markdown 标题

### 追加到上一 Block（appendToPrevious: true）时
- 只输出 summary，格式同上，提取本轮回答中值得沉淀的要点

---

只返回 JSON，无其他文字。示例：

{"shouldCreate": true, "appendToPrevious": false, "level": 1, "title": "React Hook 概念", "summary": "..."}

{"shouldCreate": false, "appendToPrevious": true, "summary": "..."}

{"shouldCreate": false, "appendToPrevious": false}`

function isModelNotFound(status: number, body: string): boolean {
  return status === 404 && (body.includes('model') || body.includes('not_found'))
}

function parseAnthropicError(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: { type?: string; message?: string }
    }
    const msg = json.error?.message
    if (msg) {
      if (status === 401 || json.error?.type === 'authentication_error') {
        return `API Key 无效：${msg}。请在 Anthropic 控制台确认 Key 正确。`
      }
      if (isModelNotFound(status, body)) {
        return `模型不可用：${msg}`
      }
      return `Claude API (${status})：${msg}`
    }
  } catch {
    // 非 JSON
  }

  if (status === 401) {
    return 'API Key 认证失败 (401)。请检查 Key 是否完整。'
  }

  if (isModelNotFound(status, body)) {
    return `模型不存在 (404)：${body.slice(0, 120)}`
  }

  return `Claude API 错误 (${status})：${body.slice(0, 200)}`
}

function sanitizeGenerateResponse(
  raw: GenerateBlockResponse
): GenerateBlockResponse {
  if (raw.shouldCreate) {
    if (!raw.level || !raw.summary) {
      return {
        shouldCreate: false,
        appendToPrevious: false,
        error: 'Claude 返回缺少 level / summary',
      }
    }

    const title = raw.title?.trim()
    if (!title) {
      return {
        shouldCreate: false,
        appendToPrevious: false,
        error: 'Claude 返回缺少 title',
      }
    }

    return {
      shouldCreate: true,
      appendToPrevious: false,
      level: raw.level,
      title: normalizeAiTitle(title),
      summary: raw.summary.trim(),
    }
  }

  if (raw.appendToPrevious) {
    if (!raw.summary?.trim()) {
      return {
        shouldCreate: false,
        appendToPrevious: false,
        error: 'Claude 返回缺少 summary（appendToPrevious）',
      }
    }
    return {
      shouldCreate: false,
      appendToPrevious: true,
      summary: raw.summary.trim(),
    }
  }

  return { shouldCreate: false, appendToPrevious: false }
}

function parseModelJson(text: string): GenerateBlockResponse {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  const parsed = JSON.parse(cleaned) as GenerateBlockResponse
  return sanitizeGenerateResponse(parsed)
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

function formatLastBlock(blocks: Block[]): string {
  if (blocks.length === 0) return '（无）'
  const last = blocks.reduce((a, b) => (b.createdAt >= a.createdAt ? b : a))
  return `"${last.title}", level=${last.level}`
}

function buildUserPrompt(
  historyBlocks: Block[],
  userMsg: string,
  aiMsg: string,
  lastAiMsg: string
): string {
  const historyTitles = historyBlocks.map((b) => b.title)
  const lastSection =
    lastAiMsg.length > 0
      ? lastAiMsg
      : '（无，这是本轮对话的第一条 AI 回答之前）'

  return `历史目录标题：${JSON.stringify(historyTitles)}

最近一个 Block（用于第二步 level 加深与 appendToPrevious 目标）：${formatLastBlock(historyBlocks)}

上一条 AI 回答（lastAiMsg，用于第一步能否独立成立）：
${lastSection}

当前用户问题：
${userMsg}

当前 AI 回答（用于 title 与 summary 提取）：
${aiMsg}`
}

async function callClaudeOnce(
  apiKey: string,
  model: string,
  userMsg: string,
  aiMsg: string,
  lastAiMsg: string,
  historyBlocks: Block[]
): Promise<GenerateBlockResponse & { modelNotFound?: boolean }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildUserPrompt(
              historyBlocks,
              userMsg,
              aiMsg,
              lastAiMsg
            ),
          },
        ],
      }),
      signal: controller.signal,
    })

    const body = await response.text()

    if (!response.ok) {
      console.error('[ThreadMind] Claude API error', model, response.status, body)
      return {
        shouldCreate: false,
        error: parseAnthropicError(response.status, body),
        modelNotFound: isModelNotFound(response.status, body),
      }
    }

    const data = JSON.parse(body) as {
      content?: Array<{ type: string; text?: string }>
    }
    const text = data.content?.[0]?.text
    if (!text) {
      return { shouldCreate: false, error: 'Claude 返回内容为空' }
    }

    try {
      return parseModelJson(text)
    } catch {
      console.error('[ThreadMind] invalid JSON from Claude', text)
      return { shouldCreate: false, error: 'Claude 返回格式异常，请重试' }
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function callWithModelFallback(
  apiKey: string,
  userMsg: string,
  aiMsg: string,
  lastAiMsg: string,
  historyBlocks: Block[]
): Promise<GenerateBlockResponse> {
  let lastError: GenerateBlockResponse = {
    shouldCreate: false,
    error: 'Claude 请求失败',
  }

  for (const model of MODEL_CANDIDATES) {
    const result = await callClaudeOnce(
      apiKey,
      model,
      userMsg,
      aiMsg,
      lastAiMsg,
      historyBlocks
    )
    if (!result.error) {
      if (model !== CLAUDE_MODEL_PRIMARY) {
        console.info('[ThreadMind] using fallback model', model)
      }
      return result
    }
    lastError = result
    if (!result.modelNotFound) {
      return result
    }
    console.warn('[ThreadMind] model not found, try next', model)
  }

  return lastError
}

export async function verifyApiKey(rawKey?: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = rawKey ? normalizeApiKey(rawKey) : await getStoredApiKey()
  if (!apiKey) {
    return { ok: false, error: '请先输入 API Key' }
  }
  if (!apiKey.startsWith('sk-ant-')) {
    return {
      ok: false,
      error: 'Key 格式异常：Anthropic Key 通常以 sk-ant- 开头',
    }
  }

  for (const model of MODEL_CANDIDATES) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify({
          model,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: controller.signal,
      })

      const body = await response.text()
      if (response.ok) {
        console.info('[ThreadMind] API key verified with model', model)
        return { ok: true }
      }

      if (isModelNotFound(response.status, body)) {
        console.warn('[ThreadMind] verify: model not found', model)
        continue
      }

      return { ok: false, error: parseAnthropicError(response.status, body) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('abort')) {
        return { ok: false, error: '验证超时，请检查网络' }
      }
      return { ok: false, error: `验证失败：${msg}` }
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    ok: false,
    error: '当前账号无法使用配置的 Claude 模型，请在 Anthropic 控制台查看可用模型',
  }
}

export async function getApiKey(): Promise<string> {
  return getStoredApiKey()
}

export async function generateBlockWithClaude(
  userMsg: string,
  aiMsg: string,
  lastAiMsg: string,
  historyBlocks: Block[]
): Promise<GenerateBlockResponse> {
  const apiKey = await getStoredApiKey()
  if (!apiKey) {
    return {
      shouldCreate: false,
      error: '请先配置 Claude API Key（点击侧栏设置图标）',
    }
  }

  try {
    return await callWithModelFallback(
      apiKey,
      userMsg,
      aiMsg,
      lastAiMsg,
      historyBlocks
    )
  } catch (firstErr) {
    console.warn('[ThreadMind] Claude first attempt failed', firstErr)
    try {
      return await callWithModelFallback(
        apiKey,
        userMsg,
        aiMsg,
        lastAiMsg,
        historyBlocks
      )
    } catch (retryErr) {
      const msg =
        retryErr instanceof Error ? retryErr.message : String(retryErr)
      if (msg.includes('abort')) {
        return { shouldCreate: false, error: '生成超时，请稍后重试' }
      }
      return { shouldCreate: false, error: '生成失败，请稍后重试' }
    }
  }
}
