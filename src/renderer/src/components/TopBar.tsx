import { useEffect, useState } from 'react'
import type { Account, FriendPlatform } from '@shared/types'
import type { TopBarProps } from '../contracts'
import { Avatar } from './ui/Avatar'
import { Icon } from './ui/Icon'
import './chrome.css'

export type { TopBarProps }

const IS_MAC = window.launcher?.platform === 'darwin'
const PRIORITY: FriendPlatform[] = ['steam', 'discord', 'psn']

/** Compte affiché sur l'avatar : Steam, puis Discord, puis PSN. */
function primaryAccount(accounts: Account[]): Account | undefined {
  for (const p of PRIORITY) {
    const a = accounts.find((x) => x.platform === p)
    if (a) return a
  }
  return accounts[0]
}

/** « Bonjour, » de 5 h à 18 h, « Bonsoir, » ensuite (relu chaque minute), comme l'ancien menu latéral. */
function useGreeting(): string {
  const read = (): string => {
    const h = new Date().getHours()
    return h >= 5 && h < 18 ? 'Bonjour' : 'Bonsoir'
  }
  const [greeting, setGreeting] = useState(read)
  useEffect(() => {
    const t = setInterval(() => setGreeting(read()), 60_000)
    return () => clearInterval(t)
  }, [])
  return greeting
}

/** Barre du haut : zone de déplacement de la fenêtre, titre ou onglets de la page, recherche, mode démo, compte. */
export function TopBar(props: TopBarProps): React.JSX.Element {
  const { title, query, onQueryChange, searchRef, slotRef, accounts, accountMenuOpen, onToggleAccountMenu, demo } = props
  const account = primaryAccount(accounts)
  const name = account?.name ?? 'Joueur'
  const greeting = useGreeting()

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
      {title && <p className="tb-title">{title}</p>}
      <div ref={slotRef} className="tb-slot" />
      <div className="tb-spacer" />

      <div className={`tb-search ${query ? 'has-query' : ''}`} role="search" title="Rechercher un jeu (Ctrl K)" onClick={() => searchRef.current?.focus()}>
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

      {demo && (
        <span className="tb-demo" title="Mode démo actif : jeux et amis fictifs (Paramètres › Avancé pour le couper)">
          <span className="tb-demo-dot" aria-hidden="true" />
          Démo
        </span>
      )}

      <button
        className="tb-me"
        aria-label={account ? `Mon compte (${name})` : 'Compte invité'}
        title={`${greeting}, ${name}`}
        aria-haspopup="menu"
        aria-expanded={accountMenuOpen}
        // Le menu se ferme au clic extérieur : sans ceci, ce clic le rouvrirait aussitôt.
        onMouseDown={(e) => accountMenuOpen && e.stopPropagation()}
        onClick={onToggleAccountMenu}
      >
        <Avatar name={name} url={account?.avatarUrl} size={36} status={account ? 'connected' : 'guest'} />
      </button>
    </header>
  )
}
