import { classNames } from '../../../utils/classNames'
import type { ViewName } from '../../../types'
import styles from './AppHeader.module.css'

type AppHeaderProps = {
  activeView: ViewName
  apiStatus: 'checking' | 'online' | 'offline'
  onNavigate: (view: ViewName) => void
}

const navItems: ViewName[] = ['capture', 'sources', 'settings']

export function AppHeader({ activeView, apiStatus, onNavigate }: AppHeaderProps) {
  return (
    <header
      className={classNames(
        styles.topbar,
        activeView === 'sources' && styles.topbarSources,
        activeView === 'settings' && styles.topbarSettings,
      )}
    >
      <button className={styles.brand} type="button" onClick={() => onNavigate('capture')}>
        <span className={styles.brandMark}>CH</span>
        <span className={styles.brandName}>Context Hub</span>
      </button>

      <nav className={styles.topbarNav} aria-label="Primary">
        {navItems.map((view) => (
          <button
            aria-current={activeView === view ? 'page' : undefined}
            className={activeView === view ? styles.current : undefined}
            key={view}
            onClick={() => onNavigate(view)}
            type="button"
          >
            {view === 'capture' ? 'Capture' : titleCase(view)}
          </button>
        ))}
      </nav>

      {activeView === 'settings' ? null : (
        <div className={classNames(styles.statusPill, styles[apiStatus])}>{apiStatus}</div>
      )}
    </header>
  )
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
