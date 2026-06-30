import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from '../types'

export function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, width))
}

export function applyMainMargin(width: number): void {
  const main = document.querySelector('main')
  if (main instanceof HTMLElement) {
    main.style.marginRight = `${width}px`
  }
}

export async function loadSidebarWidth(): Promise<number> {
  const res = await chrome.storage.local.get(SIDEBAR_WIDTH_STORAGE_KEY)
  const raw = res[SIDEBAR_WIDTH_STORAGE_KEY]
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return clampSidebarWidth(raw)
  }
  return SIDEBAR_WIDTH_DEFAULT
}

export async function saveSidebarWidth(width: number): Promise<void> {
  await chrome.storage.local.set({
    [SIDEBAR_WIDTH_STORAGE_KEY]: clampSidebarWidth(width),
  })
}
