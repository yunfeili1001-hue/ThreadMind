export const API_KEY_STORAGE = 'claudeApiKey'

/** 去除首尾空格、引号、Bearer 前缀等常见粘贴错误 */
export function normalizeApiKey(raw: string): string {
  let key = raw.trim()
  if (/^bearer\s+/i.test(key)) {
    key = key.replace(/^bearer\s+/i, '').trim()
  }
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim()
  }
  return key
}

export async function getStoredApiKey(): Promise<string> {
  const result = await chrome.storage.local.get(API_KEY_STORAGE)
  return normalizeApiKey((result[API_KEY_STORAGE] as string | undefined) ?? '')
}

export async function setStoredApiKey(raw: string): Promise<string> {
  const key = normalizeApiKey(raw)
  await chrome.storage.local.set({ [API_KEY_STORAGE]: key })
  return key
}
