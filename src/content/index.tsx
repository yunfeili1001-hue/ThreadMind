import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MessageType } from '../types'
import { sendMessage } from '../shared/runtime'
import { Sidebar } from '../sidebar/Sidebar'
import { startCollector } from './collector'
import { startObserver } from './observer'
import { createRootElement, reserveMainSpace, waitForMain } from './inject'
import './content.css'

async function verifyRuntime(): Promise<void> {
  try {
    const ping = await sendMessage<{ ok: boolean; pong: number }>({
      type: MessageType.PING,
    })
    console.info('[ThreadMind] PING ok', ping.pong)

    const storage = await sendMessage<{
      ok: boolean
      written: string
      read: string
    }>({ type: MessageType.TEST_STORAGE })
    console.info('[ThreadMind] storage test', storage.ok ? 'ok' : 'fail', storage)
  } catch (err) {
    console.error('[ThreadMind] runtime verification failed', err)
  }
}

async function bootstrap(): Promise<void> {
  const main = await waitForMain()
  if (!main) {
    console.warn('[ThreadMind] main element not found, injecting sidebar anyway')
  }

  await reserveMainSpace()
  const host = createRootElement()
  const root = createRoot(host)
  root.render(
    <StrictMode>
      <Sidebar />
    </StrictMode>
  )

  startObserver()
  startCollector()
  await verifyRuntime()
}

void bootstrap()
