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
      setError('请输入 API Key')
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
        setError(result.error ?? 'API Key 验证失败')
        return
      }

      await setStoredApiKey(key)
      setSettingsOpen(false)
      setError('API Key 已保存并验证通过')
      window.setTimeout(() => clearError(), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证请求失败')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyMarkdown = async () => {
    const ok = await copyMarkdown()
    if (ok) {
      setError('Markdown 已复制到剪贴板')
      window.setTimeout(() => clearError(), 2500)
      return
    }
    setError('复制失败，请重试')
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
        aria-label="调节侧栏宽度"
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
            需在 console.anthropic.com 创建 Key；若仍 401，请为该 Key 开启浏览器访问。
          </p>
          <button
            type="button"
            className={styles.settingsSave}
            disabled={saving}
            onClick={() => void handleSaveApiKey()}
          >
            {saving ? '验证中...' : '保存并验证'}
          </button>
        </div>
      )}

      {error && (
        <div
          className={`${styles.toast} ${
            error.includes('已保存') || error.includes('已复制')
              ? styles.toastOk
              : ''
          }`}
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            className={styles.toastClose}
            aria-label="关闭"
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
