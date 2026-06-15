import type { LocalPathEntry } from '../../../types'
import styles from './LocalPathPickerModal.module.css'

type LocalPathPickerModalProps = {
  currentPath: string
  entries: LocalPathEntry[]
  isLoading: boolean
  isOpen: boolean
  parentPath: string | null
  roots: LocalPathEntry[]
  selectedPaths: string[]
  onApply: () => void
  onCancel: () => void
  onNavigate: (path: string) => void
  onTogglePath: (path: string) => void
}

export function LocalPathPickerModal({
  currentPath,
  entries,
  isLoading,
  isOpen,
  parentPath,
  roots,
  selectedPaths,
  onApply,
  onCancel,
  onNavigate,
  onTogglePath,
}: LocalPathPickerModalProps) {
  if (!isOpen) return null

  const selectedSet = new Set(selectedPaths)

  return (
    <div
      aria-labelledby="local-path-picker-title"
      aria-modal="true"
      className={styles.backdrop}
      onMouseDown={onCancel}
      role="dialog"
    >
      <div className={styles.dialog} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 id="local-path-picker-title">Select local source</h2>
            <p>{currentPath || 'Loading'}</p>
          </div>
          <button className={styles.iconButton} onClick={onCancel} type="button" aria-label="Close">
            x
          </button>
        </div>

        <div className={styles.toolbar}>
          <button className={styles.secondaryButton} disabled={!parentPath || isLoading} onClick={() => parentPath && onNavigate(parentPath)} type="button">
            Up
          </button>
          {roots.map((root) => (
            <button className={styles.secondaryButton} key={root.path} disabled={isLoading} onClick={() => onNavigate(root.path)} type="button">
              {root.name}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {isLoading ? (
            <div className={styles.emptyState}>Loading paths.</div>
          ) : entries.length ? (
            <div className={styles.entryList}>
              {entries.map((entry) => (
                <div className={styles.entryRow} key={entry.path}>
                  <label className={styles.checkCell}>
                    <input
                      checked={selectedSet.has(entry.path)}
                      onChange={() => onTogglePath(entry.path)}
                      type="checkbox"
                    />
                    <span>{entry.is_dir ? 'Folder' : 'File'}</span>
                  </label>
                  <button
                    className={entry.is_dir ? styles.entryNameButton : styles.entryName}
                    disabled={!entry.is_dir}
                    onClick={() => entry.is_dir && onNavigate(entry.path)}
                    title={entry.path}
                    type="button"
                  >
                    {entry.name}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>No files or folders found.</div>
          )}
        </div>

        <div className={styles.footer}>
          <span>{selectedPaths.length} selected</span>
          <div className={styles.actions}>
            <button className={styles.secondaryButton} onClick={onCancel} type="button">
              Cancel
            </button>
            <button className={styles.primaryButton} disabled={!selectedPaths.length} onClick={onApply} type="button">
              Add selected
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
