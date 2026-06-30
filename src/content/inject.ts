import { applyMainMargin, loadSidebarWidth } from '../shared/sidebarWidth'
import { ROOT_ID } from '../types'

export async function reserveMainSpace(): Promise<void> {
  const width = await loadSidebarWidth()
  applyMainMargin(width)
}

export function createRootElement(): HTMLElement {
  let root = document.getElementById(ROOT_ID)
  if (root) return root

  root = document.createElement('div')
  root.id = ROOT_ID
  document.body.appendChild(root)
  return root
}

export function waitForMain(timeoutMs = 15000): Promise<HTMLElement | null> {
  const existing = document.querySelector('main')
  if (existing instanceof HTMLElement) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs
    const observer = new MutationObserver(() => {
      const main = document.querySelector('main')
      if (main instanceof HTMLElement) {
        observer.disconnect()
        resolve(main)
      } else if (Date.now() > deadline) {
        observer.disconnect()
        resolve(null)
      }
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
  })
}
