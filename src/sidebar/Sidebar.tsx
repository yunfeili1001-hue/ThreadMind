import { useEffect, useState } from 'react'
import { MessageType, type VerifyApiKeyResponse } from '../types'
import { setStoredApiKey, normalizeApiKey } from '../shared/apiKey'
import { sendMessage } from '../shared/runtime'
import { Header } from './components/Header'
import { BlockTree } from './components/BlockTree'
import { useBlocks } from './hooks/useBlocks'
import { useExport } from './hooks/useExport'
import { useSidebarWidth } from './hooks/useSidebarWidth'
import styles from './Sidebar.module.css'

export function Sidebar() {
  const { width, resizing, startResize } = useSidebarWidth()
  const {
    blocks,
    error,
    clearError,
    setError,
    toggleExpand,
    updateNoteContent,
    reorderBlocks,
    deleteBlock,
  } = useBlocks()
  const { exportMarkdown, copyMarkdown } = useExport(blocks)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settingsOpen) return
    void chrome.storage.local.get('claudeApiKey').then((res) => {
      setApiKeyInput((res.claudeApiKey as string | undefined) ?? '')
    })
  }, [settingsOpen])

  const handleSaveApiKey = async () => {
    const key = normalizeApiKey(apiKeyInput)
    if (!key) {
      setError('Please enter an API Key')
      return
    }

    setSaving(true)
    clearError()

    try {
      const result = await sendMessage<VerifyApiKeyResponse>({
        type: MessageType.VERIFY_API_KEY,
        apiKey: key,
      })

      if (!result.ok) {
        setError(result.error ?? 'API Key verification failed')
        return
      }

      await setStoredApiKey(key)
      setSettingsOpen(false)
      setError('API Key saved and verified')
      window.setTimeout(() => clearError(), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification request failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyMarkdown = async () => {
    const ok = await copyMarkdown()
    if (ok) {
      setError('Markdown copied to clipboard')
      window.setTimeout(() => clearError(), 2500)
      return
    }
    setError('Copy failed, please try again')
  }

  return (
    <aside
      className={`${styles.sidebar} ${resizing ? styles.sidebarResizing : ''}`}
      id="threadmind-sidebar"
      style={{ width }}
    >
      <div
        className={styles.resizeHandle}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={startResize}
      />
      <Header
        exportDisabled={blocks.length === 0}
        onSettingsClick={() => setSettingsOpen((v) => !v)}
        onCopyClick={() => void handleCopyMarkdown()}
        onExportClick={() => exportMarkdown()}
      />

      {settingsOpen && (
        <div className={styles.settingsPanel}>
          <label className={styles.settingsLabel}>Claude API Key</label>
          <input
            className={styles.settingsInput}
            type="password"
            placeholder="sk-ant-api03-..."
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <p className={styles.settingsHint}>
            Create a key at console.anthropic.com. If you still get 401, enable browser access for that key.
          </p>
          <button
            type="button"
            className={styles.settingsSave}
            disabled={saving}
            onClick={() => void handleSaveApiKey()}
          >
            {saving ? 'Verifying…' : 'Save & verify'}
          </button>
        </div>
      )}

      {error && (
        <div
          className={`${styles.toast} ${
            error.includes('saved') || error.includes('copied')
              ? styles.toastOk
              : ''
          }`}
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            className={styles.toastClose}
            aria-label="Close"
            onClick={clearError}
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.body}>
        <div className={styles.tree}>
          <BlockTree
            blocks={blocks}
            onToggleExpand={(id) => void toggleExpand(id)}
            onDelete={(id) => void deleteBlock(id)}
            onNoteChange={(id, note) => void updateNoteContent(id, note)}
            onReorderBlocks={(flat, activeId, dragLevel) =>
              void reorderBlocks(flat, activeId, dragLevel)
            }
          />
        </div>
      </div>
    </aside>
  )
}
