import type { Account } from '@shared/types'

export type View = 'library' | 'settings'

const ICONS: Record<View, React.JSX.Element> = {
  library: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

interface Props {
  view: View
  onView: (v: View) => void
  accounts: Account[]
  demo: boolean
}

export function Sidebar({ view, onView, accounts, demo }: Props): React.JSX.Element {
  return (
    <nav className="sidebar">
      <div className="logo" title="Plateforme Gaming">
        <span>PG</span>
      </div>
      {(Object.keys(ICONS) as View[]).map((v) => (
        <button key={v} className={`nav-btn ${view === v ? 'active' : ''}`} onClick={() => onView(v)} title={v === 'library' ? 'Bibliothèque' : 'Paramètres'}>
          {ICONS[v]}
        </button>
      ))}
      <div className="sidebar-spacer" />
      {demo && <span className="demo-pill">DÉMO</span>}
      {accounts.map((a) => (
        <div key={a.platform} className={`sidebar-avatar ring-${a.platform}`} title={`${a.name} (${a.platform})`}>
          {a.avatarUrl ? <img src={a.avatarUrl} alt="" /> : a.name.slice(0, 1)}
        </div>
      ))}
    </nav>
  )
}
