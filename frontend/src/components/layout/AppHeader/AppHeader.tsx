import { NavLink } from 'react-router'
import { classNames } from '../../../utils/classNames'
import type { ViewName } from '../../../types'
import styles from './AppHeader.module.css'

type AppHeaderProps = {
  activeView: ViewName
  apiStatus: 'checking' | 'online' | 'offline'
}

const navItems: ViewName[] = ['capture', 'sources', 'settings']

export function AppHeader({ activeView, apiStatus }: AppHeaderProps) {
  return (
    <header
      className={classNames(
        styles.topbar,
        activeView === 'sources' && styles.topbarSources,
        activeView === 'settings' && styles.topbarSettings,
      )}
    >
      <NavLink className={styles.brand} to="/capture">
        <span className={styles.brandMark}>CH</span>
        <span className={styles.brandName}>Context Hub</span>
      </NavLink>

      <nav className={styles.topbarNav} aria-label="Primary">
        {navItems.map((view) => (
          <NavLink
            aria-current={activeView === view ? 'page' : undefined}
            className={activeView === view ? styles.current : undefined}
            key={view}
            to={`/${view}`}
          >
            {view === 'capture' ? 'Capture' : titleCase(view)}
          </NavLink>
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
