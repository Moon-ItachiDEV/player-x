import { useEffect, useState } from 'react'
import type { Account, FriendPlatform } from '@shared/types'
import type { SidebarProps, View } from '../contracts'
import { SideFriends } from './friends/SideFriends'
import { Avatar } from './ui/Avatar'
import { Icon, type IconName } from './ui/Icon'
import './chrome.css'

export type { SidebarProps }

const PRIORITY: FriendPlatform[] = ['steam', 'discord', 'psn']

/** Compte affiché dans le menu : Steam, puis Discord, puis PSN. */
function primaryAccount(accounts: Account[]): Account | undefined {
  for (const p of PRIORITY) {
    const a = accounts.find((x) => x.platform === p)
    if (a) return a
  }
  return accounts[0]
}

/** « Bonjour, » de 5 h à 18 h, « Bonsoir, » ensuite ; revu chaque minute. */
function useGreeting(): string {
  const read = (): string => {
    const h = new Date().getHours()
    return h >= 5 && h < 18 ? 'Bonjour,' : 'Bonsoir,'
  }
  const [greeting, setGreeting] = useState(read)
  useEffect(() => {
    const t = setInterval(() => setGreeting(read()), 60_000)
    return () => clearInterval(t)
  }, [])
  return greeting
}

const NAV: { view: View; icon: IconName; label: string }[] = [
  { view: 'home', icon: 'home', label: 'Accueil' },
  { view: 'library', icon: 'grid', label: 'Bibliothèque' },
  { view: 'stats', icon: 'chart', label: 'Stats de jeu' },
  { view: 'trophies', icon: 'trophy', label: 'Trophées' },
  { view: 'profile', icon: 'user', label: 'Profil' }
]

/** Menu latéral : salutation et compte, navigation, amis, paramètres. */
export function Sidebar({ view, onView, gamesCount, accounts, demo, accountMenuOpen, onToggleAccountMenu, friends }: SidebarProps): React.JSX.Element {
  const greeting = useGreeting()
  const account = primaryAccount(accounts)
  const name = account?.name ?? 'Joueur'
  const accountLabel = account ? `Mon compte (${name})` : 'Compte invité'

  const navButton = (v: View, icon: IconName, label: string, count?: number): React.JSX.Element => (
    <button key={v} className="side-nav-btn" aria-current={view === v ? 'page' : undefined} onClick={() => onView(v)}>
      <Icon name={icon} size={18} />
      <span className="side-nav-label">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="side-count num" aria-label={`${count} jeux`}>
          {count}
        </span>
      )}
    </button>
  )

  return (
    <aside className="side" aria-label="Menu">
      <div className="side-head">
        <button
          className="side-me"
          aria-label={accountLabel}
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          // Le menu se ferme au clic extérieur : sans ceci, ce clic le rouvrirait aussitôt.
          onMouseDown={(e) => accountMenuOpen && e.stopPropagation()}
          onClick={onToggleAccountMenu}
        >
          <Avatar name={name} url={account?.avatarUrl} size={40} status={account ? 'connected' : 'guest'} />
          <span className="side-hi">
            <small>{greeting}</small>
            <b title={name}>{name}</b>
          </span>
          <Icon name="chevron-down" size={16} className="side-me-chev" />
        </button>
      </div>

      <nav className="side-nav" aria-label="Navigation principale">
        <p className="side-label">Navigation</p>
        {NAV.map((n) => navButton(n.view, n.icon, n.label, n.view === 'library' ? gamesCount : undefined))}
      </nav>

      <SideFriends {...friends} />

      <div className="side-foot">
        <p className="side-label">Configurer</p>
        {navButton('settings', 'settings', 'Paramètres')}
        {demo && (
          <p className="side-demo" title="Mode démo actif : jeux et amis fictifs">
            <span className="side-demo-dot" aria-hidden="true" />
            Mode démo · jeux et amis fictifs
          </p>
        )}
      </div>
    </aside>
  )
}
