import type { TopBarProps } from '../contracts'
import { Icon } from './ui/Icon'
import './chrome.css'

export type { TopBarProps }

const IS_MAC = window.launcher?.platform === 'darwin'

/** Barre du haut : zone de déplacement de la fenêtre, titre ou onglets de la page, recherche. */
export function TopBar({ title, query, onQueryChange, searchRef, slotRef }: TopBarProps): React.JSX.Element {
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
    </header>
  )
}
