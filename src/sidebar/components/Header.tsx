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
          title="API Key settings"
          aria-label="Settings"
          onClick={onSettingsClick}
        >
          <IconSettings size={14} stroke={1.75} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title={exportDisabled ? 'Nothing to export' : 'Copy Markdown'}
          aria-label="Copy Markdown"
          disabled={exportDisabled}
          onClick={onCopyClick}
        >
          <IconCopy size={14} stroke={1.75} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title={exportDisabled ? 'Nothing to export' : 'Export Markdown'}
          aria-label="Export"
          disabled={exportDisabled}
          onClick={onExportClick}
        >
          <IconDownload size={14} stroke={1.75} />
        </button>
      </div>
    </header>
  )
}
