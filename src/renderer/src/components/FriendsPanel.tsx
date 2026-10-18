import { useState } from 'react'
import type { Account, Friend, FriendPlatform, FriendsResult, FriendStatus } from '@shared/types'
import { Badge } from './Badge'

const GROUPS: { status: FriendStatus; label: string }[] = [
  { status: 'in-game', label: 'En jeu' },
  { status: 'online', label: 'En ligne' },
  { status: 'away', label: 'Absent' },
  { status: 'offline', label: 'Hors ligne' }
]

const PLATFORMS: FriendPlatform[] = ['steam', 'discord', 'psn']

interface Props {
  result: FriendsResult
  accounts: Account[]
  demo: boolean
  onRefresh: () => void
  onOpenSettings: () => void
}

function FriendRow({ f }: { f: Friend }): React.JSX.Element {
  const [broken, setBroken] = useState(false)
  return (
    <div className={`friend status-${f.status}`}>
      <div className="friend-avatar">
        {f.avatarUrl && !broken ? <img src={f.avatarUrl} alt="" onError={() => setBroken(true)} /> : f.name.slice(0, 1)}
        <span className="dot" />
      </div>
      <div className="friend-info">
        <div className="friend-name">{f.name}</div>
        <div className="friend-sub">
          {f.status === 'in-game' ? f.game : GROUPS.find((g) => g.status === f.status)?.label}
          {f.device ? ` · ${f.device}` : ''}
        </div>
      </div>
      <Badge kind={f.platform} />
    </div>
  )
}

export function FriendsPanel({ result, accounts, demo, onRefresh, onOpenSettings }: Props): React.JSX.Element {
  const [platform, setPlatform] = useState<FriendPlatform | 'all'>('all')
  const [showOffline, setShowOffline] = useState(false)
  const friends = result.friends.filter((f) => platform === 'all' || f.platform === platform)
  const onlineCount = result.friends.filter((f) => f.status !== 'offline').length
  const errors = Object.entries(result.errors)

  return (
    <aside className="friends">
      <header className="friends-head">
        <div>
          <h2>Amis</h2>
          <span className="online-count">{onlineCount} en ligne</span>
        </div>
        <button className="icon-btn" onClick={onRefresh} title="Actualiser">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
          </svg>
        </button>
      </header>

      <div className="tabs">
        {(['all', ...PLATFORMS] as const).map((p) => (
          <button key={p} className={`tab ${platform === p ? 'active' : ''}`} onClick={() => setPlatform(p)}>
            {p === 'all' ? 'Tous' : p === 'psn' ? 'PSN' : p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {errors.map(([p, msg]) => (
        <div key={p} className="friends-error">
          <b>{p.toUpperCase()}</b> {msg}
        </div>
      ))}

      {!demo && accounts.length === 0 && result.friends.length === 0 && (
        <div className="friends-empty">
          Connecte Steam, PlayStation ou un serveur Discord pour voir qui est en ligne.
          <button className="link-btn" onClick={onOpenSettings}>
            Ouvrir les paramètres
          </button>
        </div>
      )}

      <div className="friends-list">
        {GROUPS.map(({ status, label }) => {
          const list = friends.filter((f) => f.status === status)
          if (!list.length) return null
          const collapsed = status === 'offline' && !showOffline
          return (
            <section key={status}>
              <button className="group-title" onClick={() => status === 'offline' && setShowOffline(!showOffline)}>
                {label} <span>{list.length}</span>
                {status === 'offline' && <em>{collapsed ? '▸' : '▾'}</em>}
              </button>
              {!collapsed && list.map((f) => <FriendRow key={f.id} f={f} />)}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
