import type { SourceMode } from '../../../types'
import styles from './ModeTabs.module.css'

type ModeTabsProps = {
  mode: SourceMode
  onModeChange: (mode: SourceMode) => void
}

export function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
  return (
    <div className={styles.modeTabs} role="tablist" aria-label="Source type">
      <button
        aria-selected={mode === 'local'}
        className={mode === 'local' ? styles.active : undefined}
        onClick={() => onModeChange('local')}
        role="tab"
        type="button"
      >
        Local folder
      </button>
      <button
        aria-selected={mode === 'web'}
        className={mode === 'web' ? styles.active : undefined}
        onClick={() => onModeChange('web')}
        role="tab"
        type="button"
      >
        Remote URL
      </button>
    </div>
  )
}
