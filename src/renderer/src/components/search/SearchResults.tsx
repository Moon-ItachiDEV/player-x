import type { FriendStatus, Game } from '@shared/types'
import { Avatar } from '../ui/Avatar'
import { Cover } from '../ui/Cover'
import { Icon, type IconName } from '../ui/Icon'
import type { SearchEntry, SearchGroup } from './searchIndex'
import './search.css'

/** Une entrée de la recherche globale avec de quoi la dessiner (jaquette, avatar ou icône). */
export type SearchItem = SearchEntry &
  (
    | { art: 'cover'; game: Pick<Game, 'name' | 'coverUrl' | 'heroUrl'>; /** Installé : Ctrl Entrée le lance. */ launchable: boolean }
    | { art: 'avatar'; avatarUrl?: string; status: FriendStatus }
    | { art: 'icon'; icon: IconName }
  )

/** Ligne finale : bascule vers la Bibliothèque filtrée par la requête. */
export const LIBRARY_ROW = 'library-filter'

interface Props {
  id: string
  groups: SearchGroup<SearchItem>[]
  /** Nombre total de jeux trouvés : la ligne « Voir les N jeux » apparaît quand il y en a. */
  gameCount: number
  query: string
  /** Identifiant de l'option active (flèches du clavier ou survol). */
  active: string | null
  onActive: (id: string) => void
  onPick: (id: string, launch: boolean) => void
}

export const optionId = (listId: string, id: string): string => `${listId}-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`

/** Liste des résultats sous le champ de la barre du haut (motif combobox : le focus reste dans le champ). */
export function SearchResults({ id, groups, gameCount, query, active, onActive, onPick }: Props): React.JSX.Element {
  const q = query.trim()
  const activeItem = groups.flatMap((g) => g.items).find((i) => i.id === active)
  const option = (key: string, children: React.ReactNode, extra = ''): React.JSX.Element => (
    <li
      key={key}
      id={optionId(id, key)}
      role="option"
      aria-selected={active === key}
      className={`srch-opt ${extra} ${active === key ? 'is-active' : ''}`}
      // Le clic ne doit pas retirer le focus du champ (sinon la liste se ferme avant le choix).
      onMouseDown={(e) => e.preventDefault()}
      onMouseMove={() => active !== key && onActive(key)}
      onClick={(e) => onPick(key, e.ctrlKey || e.metaKey)}
    >
      {children}
    </li>
  )

  return (
    <div className="srch-panel">
      <ul id={id} role="listbox" aria-label="Résultats de la recherche" className="srch-list">
        {groups.length === 0 && (
          <li className="srch-empty" role="presentation">
            Rien ne correspond à « {q} ».
          </li>
        )}
        {groups.map((g) => (
          <li key={g.kind} role="presentation" className="srch-group">
            <p className="srch-group-title" id={`${id}-g-${g.kind}`}>
              {g.title}
            </p>
            <ul role="group" aria-labelledby={`${id}-g-${g.kind}`} className="srch-group-list">
              {g.items.map((item) =>
                option(
                  item.id,
                  <>
                    <Art item={item} />
                    <span className="srch-label">{item.label}</span>
                    {item.hint && <span className="srch-hint">{item.hint}</span>}
                  </>
                )
              )}
            </ul>
          </li>
        ))}
        {gameCount > 0 && (
          <li role="presentation" className="srch-group srch-foot-group">
            <ul role="group" aria-label="Bibliothèque" className="srch-group-list">
              {option(
                LIBRARY_ROW,
                <>
                  <span className="srch-art srch-art-icon" aria-hidden="true">
                    <Icon name="grid" size={16} />
                  </span>
                  <span className="srch-label">{gameCount > 1 ? `Voir les ${gameCount} jeux dans la Bibliothèque` : 'Voir ce jeu dans la Bibliothèque'}</span>
                </>,
                'srch-opt-library'
              )}
            </ul>
          </li>
        )}
      </ul>
      <p className="srch-keys" aria-hidden="true">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> choisir
        </span>
        <span>
          <kbd>Entrée</kbd> ouvrir
        </span>
        {activeItem?.art === 'cover' && activeItem.launchable && (
          <span>
            <kbd>Ctrl</kbd>
            <kbd>Entrée</kbd> jouer
          </span>
        )}
        <span>
          <kbd>Échap</kbd> fermer
        </span>
      </p>
    </div>
  )
}

function Art({ item }: { item: SearchItem }): React.JSX.Element {
  if (item.art === 'cover') {
    return (
      <span className="srch-art srch-art-cover" aria-hidden="true">
        <Cover game={item.game} variant="portrait" showTitle={false} />
      </span>
    )
  }
  if (item.art === 'avatar') return <Avatar name={item.label} url={item.avatarUrl} size={28} status={item.status} className="srch-art" />
  return (
    <span className="srch-art srch-art-icon" aria-hidden="true">
      <Icon name={item.icon} size={16} />
    </span>
  )
}
