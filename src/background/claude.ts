import type { Block, GenerateBlockResponse } from '../types'
import { getStoredApiKey, normalizeApiKey } from '../shared/apiKey'
import {
  API_TIMEOUT_MS,
  CLAUDE_MODEL_FALLBACK,
  CLAUDE_MODEL_PRIMARY,
} from '../shared/constants'
import { normalizeAiTitle } from '../shared/blockUtils'

const MODEL_CANDIDATES = [CLAUDE_MODEL_PRIMARY, CLAUDE_MODEL_FALLBACK] as const

const SYSTEM_PROMPT = `You are a knowledge-extraction assistant for ThreadMind. Based on the conversation context, choose one of three actions and return the required fields.

## Language (mandatory)
Write **title** and **summary** in the **same language as the current user question**.
- User question in Chinese → Chinese title and summary
- User question in English → English title and summary
- If mixed, follow the dominant language of the user question
- Never translate into a different language

## Step 1: Can this question stand alone without lastAiMsg?
- **Yes** → shouldCreate: true (new Block: decide level, title, summary)
- **No** → go to Step 2

## Step 2 (question depends on context): Will the user revisit this AI answer on its own?
- **Yes** (new concept or mechanism) → shouldCreate: true, level = most recent Block level + 1 (L1→2, L2→3; if no recent Block, level 2)
- **No** (example, rephrase, follow-up detail, clarification) → appendToPrevious: true, summary only, no new Block

## Step 3 (ignore)
Small talk, no knowledge value, or user only asks to repeat with no new info → shouldCreate: false, appendToPrevious: false

---

### New Block (shouldCreate: true)

**level** (use lastAiMsg + history):
- New standalone topic → level 1
- Same topic, deeper, still understandable without lastAiMsg → level 2
- Requires prior context and worth its own section → level 3 if recent L2 exists, else level 2

**title** (short chapter name):
- Chinese: ≤12 characters; English: ≤8 words
- Remove question tone and filler prefixes
- Example (EN): "What exactly is a React Hook?" → "React Hook Basics"
- Example (ZH): "React 里 Hook 到底是啥" → "React Hook 概念"

**summary** (structured extraction, not a prose paragraph):
- Use · for bullets; line breaks for hierarchy; ≤150 characters total
- Plain text only, no markdown headings

### Append to previous Block (appendToPrevious: true)
- Output summary only, same format; extract key points worth keeping

---

Return JSON only, no other text. Examples:

{"shouldCreate": true, "appendToPrevious": false, "level": 1, "title": "React Hook Basics", "summary": "..."}

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
        return `Invalid API Key: ${msg}. Please confirm your key in the Anthropic console.`
      }
      if (isModelNotFound(status, body)) {
        return `Model unavailable: ${msg}`
      }
      return `Claude API (${status})：${msg}`
    }
  } catch {
    // 非 JSON
  }

  if (status === 401) {
    return 'API Key authentication failed (401). Please check that your key is complete.'
  }

  if (isModelNotFound(status, body)) {
    return `Model not found (404): ${body.slice(0, 120)}`
  }

  return `Claude API error (${status}): ${body.slice(0, 200)}`
}

function sanitizeGenerateResponse(
  raw: GenerateBlockResponse
): GenerateBlockResponse {
  if (raw.shouldCreate) {
    if (!raw.level || !raw.summary) {
      return {
        shouldCreate: false,
        appendToPrevious: false,
        error: 'Claude response missing level / summary',
      }
    }

    const title = raw.title?.trim()
    if (!title) {
      return {
        shouldCreate: false,
        appendToPrevious: false,
        error: 'Claude response missing title',
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
        error: 'Claude response missing summary (appendToPrevious)',
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
  if (blocks.length === 0) return '(none)'
  const last = blocks.reduce((a, b) => (b.createdAt >= a.createdAt ? b : a))
  return `"${last.title}", level=${last.level}`
}

/** Infer output language from the current turn (user question takes priority). */
function inferOutputLanguage(userMsg: string, aiMsg: string): string {
  const text = userMsg.trim() || aiMsg.trim()
  if (!text) return 'Match the user question language'

  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length
  const latin = (text.match(/[a-zA-Z]/g) ?? []).length

  if (cjk > 0 && cjk >= latin) return 'Chinese (中文)'
  if (latin > 0 && latin > cjk * 2) return 'English'
  if (cjk > latin) return 'Chinese (中文)'
  if (latin > 0) return 'English'
  return 'Match the user question language'
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
      : '(none — before the first AI reply in this thread)'

  const outputLanguage = inferOutputLanguage(userMsg, aiMsg)

  return `Output language for title & summary: ${outputLanguage}

History block titles: ${JSON.stringify(historyTitles)}

Most recent Block (for Step 2 level depth & appendToPrevious target): ${formatLastBlock(historyBlocks)}

Previous AI reply (lastAiMsg — Step 1 standalone test):
${lastSection}

Current user question:
${userMsg}

Current AI reply (source for title & summary):
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
      return { shouldCreate: false, error: 'Claude returned empty content' }
    }

    try {
      return parseModelJson(text)
    } catch {
      console.error('[ThreadMind] invalid JSON from Claude', text)
      return { shouldCreate: false, error: 'Invalid response format from Claude, please retry' }
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
    error: 'Claude request failed',
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
    return { ok: false, error: 'Please enter an API Key first' }
  }
  if (!apiKey.startsWith('sk-ant-')) {
    return {
      ok: false,
      error: 'Invalid key format: Anthropic keys usually start with sk-ant-',
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
        return { ok: false, error: 'Verification timed out, please check your network' }
      }
      return { ok: false, error: `Verification failed: ${msg}` }
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    ok: false,
    error: 'Your account cannot use the configured Claude models. Check available models in the Anthropic console.',
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
      error: 'Please configure your Claude API Key first (click the settings icon in the sidebar)',
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
        return { shouldCreate: false, error: 'Generation timed out, please try again later' }
      }
      return { shouldCreate: false, error: 'Generation failed, please try again later' }
    }
  }
}
