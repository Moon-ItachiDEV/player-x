import { useEffect, useMemo, useState } from 'react'
import { plural } from '@shared/text'
import type { TopBarProps, View } from '../contracts'
import { countGames, searchAll } from './search/searchIndex'
import { LIBRARY_ROW, optionId, SearchResults } from './search/SearchResults'
import { Avatar } from './ui/Avatar'
import { BrandMark } from './ui/Brand'
import { Icon } from './ui/Icon'
import './chrome.css'

export type { TopBarProps }

const IS_MAC = window.launcher?.platform === 'darwin'
const IS_PRERELEASE = (window.launcher?.version ?? '').includes('-')

/** Pages, en onglets texte (direction « Écran console ») : une seule navigation, en haut. Le Profil passe par l'avatar. */
const NAV: { view: View; label: string }[] = [
  { view: 'home', label: 'Accueil' },
  { view: 'library', label: 'Bibliothèque' },
  { view: 'friends', label: 'Amis' },
  { view: 'stats', label: 'Stats' },
  { view: 'trophies', label: 'Trophées' },
  // Seulement avec les actus des jeux (Paramètres › Bibliothèque).
  { view: 'news', label: 'Actus' }
]

/** Heure du PC (HH:MM), relue chaque minute pile. */
function useClock(): string {
  const read = (): string => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const [now, setNow] = useState(read)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const tick = (): void => {
      setNow(read())
      t = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    }
    t = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    return () => clearTimeout(t)
  }, [])
  return now
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

/** Barre du haut : zone de déplacement de la fenêtre, titre ou onglets de la page (salutation sur l'Accueil), recherche, compte. */
export function TopBar(props: TopBarProps): React.JSX.Element {
  const { query, onQueryChange, searchRef, me, accountMenuOpen, onToggleAccountMenu, search, onLibraryView, view, onView, news, newsCount, friendsInGame } = props
  const account = me.account
  const name = me.name
  const greeting = useGreeting()
  const clock = useClock()

  // Résultats de la recherche globale : ouverts quand le champ a le focus et du texte, refermés par Échap jusqu'à la frappe suivante.
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const groups = useMemo(() => searchAll(search.items, query), [search.items, query])
  // Sur la Bibliothèque, la grille se filtre déjà en direct : pas besoin d'y renvoyer.
  const gameCount = useMemo(() => (onLibraryView ? 0 : countGames(search.items, query)), [onLibraryView, search.items, query])
  const order = useMemo(() => [...groups.flatMap((g) => g.items.map((i) => i.id)), ...(gameCount > 0 ? [LIBRARY_ROW] : [])], [groups, gameCount])
  const open = focused && !dismissed && query.trim() !== ''
  const current = active && order.includes(active) ? active : (order[0] ?? null)

  const pick = (id: string | null, launch: boolean): void => {
    if (!id) return
    setDismissed(true)
    if (id === LIBRARY_ROW) {
      search.onPick(null, false)
      return
    }
    const item = search.items.find((i) => i.id === id)
    if (!item) return
    onQueryChange('')
    searchRef.current?.blur()
    search.onPick(item, launch)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && order.length > 0) {
      e.preventDefault()
      const i = current ? order.indexOf(current) : -1
      const next = e.key === 'ArrowDown' ? (i + 1) % order.length : (i - 1 + order.length) % order.length
      setActive(order[next])
      document.getElementById(optionId('tb-results', order[next]))?.scrollIntoView({ block: 'nearest' })
      return
    }
    if (e.key === 'Enter' && open) {
      e.preventDefault()
      pick(current, e.ctrlKey || e.metaKey)
      return
    }
    if (e.key !== 'Escape') return
    if (open) {
      // Échap ferme d'abord la liste, puis vide le champ, sans fermer une autre couche.
      e.stopPropagation()
      setDismissed(true)
    } else if (query) {
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
      <div className="tb-brand">
        {!IS_MAC && <BrandMark height={30} />}
        <span className="tb-brand-name">Player X</span>
        {IS_PRERELEASE && <span className="tb-brand-beta">Bêta</span>}
      </div>
      <nav className="tb-nav" aria-label="Pages">
        {NAV.filter((n) => n.view !== 'news' || news).map((n) => {
          const live = n.view === 'friends' && friendsInGame > 0
          const fresh = n.view === 'news' && newsCount > 0
          const hint = live ? `${friendsInGame} en jeu` : fresh ? plural(newsCount, 'nouveau patch', 'nouveaux patchs') : undefined
          return (
            <button
              key={n.view}
              className="tb-nav-btn"
              aria-current={view === n.view ? 'page' : undefined}
              aria-label={hint ? `${n.label}, ${hint}` : undefined}
              title={hint}
              onClick={() => onView(n.view)}
            >
              {n.label}
              {(live || fresh) && (
                <span className={`tb-nav-badge num ${live ? 'is-live' : 'is-info'}`} aria-hidden="true">
                  {live ? friendsInGame : newsCount > 99 ? '99+' : newsCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>
      <div className="tb-spacer" />

      <div className={`tb-search ${query ? 'has-query' : ''}`} role="search" title="Rechercher (Ctrl K)" onClick={() => searchRef.current?.focus()}>
        <Icon name="search" size={16} className="tb-search-icon" />
        <input
          ref={searchRef}
          type="search"
          className="tb-search-input"
          value={query}
          onChange={(e) => {
            setDismissed(false)
            setActive(null)
            onQueryChange(e.target.value)
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            setFocused(true)
            setDismissed(false)
          }}
          onBlur={() => setFocused(false)}
          placeholder="Jeux, amis, pages…"
          aria-label="Rechercher des jeux, des amis ou une page"
          role="combobox"
          aria-expanded={open}
          aria-controls="tb-results"
          aria-autocomplete="list"
          aria-activedescendant={open && current ? optionId('tb-results', current) : undefined}
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
        {open && <SearchResults id="tb-results" groups={groups} gameCount={gameCount} query={query} active={current} onActive={setActive} onPick={pick} />}
      </div>

      <span className="tb-clock num" aria-hidden="true">
        {clock}
      </span>
      <button
        className="tb-icon-btn"
        aria-label="Paramètres"
        title="Paramètres"
        aria-current={view === 'settings' ? 'page' : undefined}
        onClick={() => onView('settings')}
      >
        <Icon name="settings" size={19} />
      </button>
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
        <Avatar name={name} url={me.avatarUrl} size={36} status={account ? 'connected' : 'guest'} />
      </button>
    </header>
  )
}
