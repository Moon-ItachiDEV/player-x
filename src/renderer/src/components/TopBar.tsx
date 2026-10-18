import { useMemo } from 'react'
import type { Friend, FriendStatus } from '@shared/types'
import type { TopBarProps } from '../contracts'
import { Avatar } from './ui/Avatar'
import { Icon } from './ui/Icon'
import './chrome.css'

export type { TopBarProps }

const IS_MAC = window.launcher?.platform === 'darwin'
const STACK_ORDER: FriendStatus[] = ['in-game', 'online', 'away']

/** Barre du haut : zone de déplacement de la fenêtre, recherche et résumé des amis. */
export function TopBar({ query, onQueryChange, searchRef, friends, friendsOpen, onToggleFriends }: TopBarProps): React.JSX.Element {
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Escape') return
    if (query) {
      // Échap vide d'abord le champ, sans fermer une autre couche.
      e.stopPropagation()
      onQueryChange('')
    } else {
      e.currentTarget.blur()
    }
  }

  const clear = (): void => {
    onQueryChange('')
    searchRef.current?.focus()
  }

  return (
    <header className={`topbar ${IS_MAC ? 'is-mac' : ''}`}>
      <div className="tb-search" role="search" onClick={() => searchRef.current?.focus()}>
        <Icon name="search" size={16} className="tb-search-icon" />
        <input
          ref={searchRef}
          type="search"
          className="tb-search-input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Rechercher un jeu…"
          aria-label="Rechercher un jeu"
          spellCheck={false}
          autoComplete="off"
        />
        {query ? (
          <button
            className="tb-clear"
            aria-label="Effacer la recherche"
            title="Effacer la recherche"
            onClick={(e) => {
              e.stopPropagation()
              clear()
            }}
          >
            <Icon name="x" size={14} />
          </button>
        ) : (
          <kbd className="tb-kbd" aria-hidden="true">
            Ctrl K
          </kbd>
        )}
      </div>

      <div className="tb-spacer" />

      <FriendsSummary friends={friends} open={friendsOpen} onToggle={onToggleFriends} />
    </header>
  )
}

function FriendsSummary({ friends, open, onToggle }: { friends: Friend[]; open: boolean; onToggle: () => void }): React.JSX.Element {
  // Les membres d'un serveur Discord ne sont pas des amis : le résumé ne compte que Steam et PSN.
  const { inGame, online, stack } = useMemo(() => {
    const real = friends.filter((f) => f.platform !== 'discord')
    const by = (s: FriendStatus): Friend[] => real.filter((f) => f.status === s)
    return {
      inGame: by('in-game').length,
      online: by('online').length + by('away').length,
      stack: STACK_ORDER.flatMap(by).slice(0, 3)
    }
  }, [friends])

  let text: React.ReactNode = 'Amis'
  let label = 'Amis'
  if (inGame > 0) {
    text = (
      <>
        <span className="num tb-live">{inGame}</span> en jeu
      </>
    )
    label = `Amis, ${inGame} en jeu`
  } else if (online > 0) {
    text = (
      <>
        <span className="num">{online}</span> en ligne
      </>
    )
    label = `Amis, ${online} en ligne`
  }
  const action = open ? 'Masquer les amis' : 'Afficher les amis'

  return (
    <button className={`tb-friends ${stack.length ? 'has-stack' : ''}`} aria-pressed={open} aria-label={label} title={action} onClick={onToggle}>
      {stack.length > 0 ? (
        <span className="tb-stack" aria-hidden="true">
          {stack.map((f) => (
            <Avatar key={f.id} name={f.name} url={f.avatarUrl} size={22} />
          ))}
        </span>
      ) : (
        <Icon name="users" size={16} className="tb-friends-icon" />
      )}
      <span className="tb-friends-text">{text}</span>
      <Icon name="panel-right" size={16} className="tb-friends-icon" />
    </button>
  )
}
