import { IconCopy, IconDownload, IconNotebook, IconSettings } from '@tabler/icons-react'
import styles from '../Sidebar.module.css'

interface HeaderProps {
  exportDisabled?: boolean
  onSettingsClick?: () => void
  onCopyClick?: () => void
  onExportClick?: () => void
}

export function Header({
  exportDisabled = true,
  onSettingsClick,
  onCopyClick,
  onExportClick,
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          <IconNotebook size={9} stroke={2} />
        </div>
        <span className={styles.brandName}>ThreadMind</span>
      </div>
      <div className={styles.headerActions}>
        <button
          type="button"
          className={styles.iconBtn}
          title="设置 API Key"
          aria-label="设置"
          onClick={onSettingsClick}
        >
          <IconSettings size={14} stroke={1.75} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title={exportDisabled ? '暂无内容' : '复制 Markdown'}
          aria-label="复制 Markdown"
          disabled={exportDisabled}
          onClick={onCopyClick}
        >
          <IconCopy size={14} stroke={1.75} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title={exportDisabled ? '暂无内容' : '导出 Markdown'}
          aria-label="导出"
          disabled={exportDisabled}
          onClick={onExportClick}
        >
          <IconDownload size={14} stroke={1.75} />
        </button>
      </div>
    </header>
  )
}
