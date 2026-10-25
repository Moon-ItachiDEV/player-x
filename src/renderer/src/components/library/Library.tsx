import { useMemo, useState } from 'react'
import { cleanName, norm } from '@shared/text'
import type { Game, Store } from '@shared/types'
import type { LibraryProps } from '../../contracts'
import { withViewTransition } from '../../motion'
import { TopTitle } from '../TopTabs'
import { Icon } from '../ui/Icon'
import { GameCard, GameCardSkeleton, GameRow, GameRowHead } from './GameCard'
import { LibraryToolbar, SORT_LABEL, STORES, type LibInstall, type LibSort, type LibStore, type LibView } from './LibraryToolbar'
import { NoGames } from './NoGames'
import './library.css'
import './uninstalled.css'

// Filtres, tri et affichage propres à ce PC.
const STORAGE_KEY = 'pg.library'
const SORTS = Object.keys(SORT_LABEL) as LibSort[]
const INSTALLS: LibInstall[] = ['all', 'installed', 'uninstalled']

interface LibPrefs {
  install: LibInstall
  fav: boolean
  store: LibStore
  sort: LibSort
  view: LibView
}

const DEFAULT_PREFS: LibPrefs = {
  // Installés par défaut : un gros compte Steam noierait la grille sous les jeux à installer.
  install: 'installed',
  fav: false,
  store: 'all',
  sort: 'recent',
  view: 'grid'
}

/**
 * Lit les préférences. Anciennes formes : l'onglet `tab` (tous, favoris, non installés) devient installation + favoris,
 * et la puce unique `chip` (tous, favoris ou un store) devient favoris + store.
 */
function loadPrefs(): LibPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<LibPrefs> & { tab?: string; chip?: string }
    const isStore = (v: unknown): v is Store => STORES.includes(v as Store)
    const fav = typeof raw.fav === 'boolean' ? raw.fav : raw.tab === 'fav' || (raw.tab === undefined && raw.chip === 'fav')
    const old: LibInstall = raw.tab === 'uninstalled' ? 'uninstalled' : 'installed'
    const install: LibInstall = raw.install && INSTALLS.includes(raw.install) ? raw.install : old
    const store: LibStore = isStore(raw.store) ? raw.store : raw.store === undefined && isStore(raw.chip) ? raw.chip : 'all'
    return {
      install,
      fav: fav && install !== 'uninstalled',
      store,
      sort: raw.sort && SORTS.includes(raw.sort) ? raw.sort : 'recent',
      view: raw.view === 'list' ? 'list' : 'grid'
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function savePrefs(p: LibPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* stockage indisponible : la préférence vaut pour la session */
  }
}

const collator = new Intl.Collator('fr', {
  sensitivity: 'base',
  numeric: true
})
const byName = (a: Game, b: Game): number => collator.compare(cleanName(a.name), cleanName(b.name))
const byRecent = (a: Game, b: Game): number => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0)

function sortGames(list: Game[], sort: LibSort): Game[] {
  const cmp =
    sort === 'name'
      ? byName
      : sort === 'launches'
        ? (a: Game, b: Game) => (b.launches ?? 0) - (a.launches ?? 0) || byRecent(a, b) || byName(a, b)
        : sort === 'playtime'
          ? (a: Game, b: Game) => (b.playtime ?? 0) - (a.playtime ?? 0) || byRecent(a, b) || byName(a, b)
          : (a: Game, b: Game) => byRecent(a, b) || byName(a, b)
  return [...list].sort(cmp)
}

/** Recherche tolérante (accents, ponctuation, ™) ; repli sur une simple sous-chaîne si la requête n'a que des symboles. */
function matcher(query: string): (g: Game) => boolean {
  const q = query.trim()
  if (!q) return () => true
  const key = norm(q)
  if (key) return (g) => norm(g.name).includes(key)
  const low = q.toLowerCase()
  return (g) => g.name.toLowerCase().includes(low)
}

export function Library(props: LibraryProps): React.JSX.Element {
  const { games, notInstalled, onInstall, scanning, report, demo, query, onClearQuery, onLaunch, onOpen, onFavorite, onRescan, coverSize, onCoverSize } =
    props
  const [prefs, setPrefs] = useState<LibPrefs>(loadPrefs)

  const update = (patch: Partial<LibPrefs>): void =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })

  const q = query.trim()
  // « Installation » n'existe que si le compte Steam a des jeux absents de ce PC.
  const hasUninstalled = notInstalled.length > 0
  // Une recherche porte sur toute la bibliothèque : « Tous », sans le filtre des favoris, le temps de la recherche.
  const install: LibInstall = q || !hasUninstalled ? 'all' : prefs.install
  const fav = !q && prefs.fav
  const favCount = useMemo(() => games.filter((g) => g.favorite).length, [games])

  // Sélection avant le filtre de store : favoris (tous installés), installés, non installés, ou les deux mêlés.
  const inSet = useMemo(() => {
    if (fav) return games.filter((g) => g.favorite)
    if (install === 'installed') return games
    if (install === 'uninstalled') return notInstalled
    return notInstalled.length ? [...games, ...notInstalled] : games
  }, [games, notInstalled, install, fav])

  const storeCounts = useMemo(() => {
    const c: Record<Store, number> = { steam: 0, epic: 0, ea: 0 }
    for (const g of inSet) c[g.store]++
    return c
  }, [inSet])
  // Pilules de plateforme : les stores de la bibliothèque, installés ou non (stables quand on change de filtre).
  const stores = useMemo(() => STORES.filter((s) => games.some((g) => g.store === s) || notInstalled.some((g) => g.store === s)), [games, notInstalled])

  // Un store sans jeu dans la sélection retombe sur « Tout ».
  const store: LibStore = prefs.store !== 'all' && storeCounts[prefs.store] === 0 ? 'all' : prefs.store

  const shown = useMemo(() => {
    const match = matcher(q)
    return sortGames(
      inSet.filter((g) => (store === 'all' || g.store === store) && match(g)),
      prefs.sort
    )
  }, [inSet, store, q, prefs.sort])
  const shownUninstalled = shown.some((g) => g.notInstalled)

  const item = (g: Game): React.JSX.Element => {
    const p = {
      game: g,
      onOpen,
      onLaunch: g.notInstalled ? onInstall : onLaunch,
      onFavorite
    }
    return prefs.view === 'list' ? <GameRow key={g.id} {...p} /> : <GameCard key={g.id} {...p} />
  }

  // Changer de sélection pendant une recherche l'efface (comme les anciens onglets).
  const select = (patch: Partial<LibPrefs>): void => {
    if (q) onClearQuery()
    update(patch)
  }

  const toolbar = (loading = false): React.JSX.Element => (
    <LibraryToolbar
      stores={stores}
      storeCounts={storeCounts}
      total={inSet.length}
      store={store}
      install={hasUninstalled ? install : null}
      fav={fav}
      favCount={favCount}
      sort={prefs.sort}
      view={prefs.view}
      coverSize={coverSize}
      scanning={scanning}
      loading={loading}
      onStore={(s) => update({ store: s })}
      // Favoris et non installés s'excluent : un jeu pas installé ne peut pas être en favori.
      onInstall={(i) => select(i === 'uninstalled' ? { install: i, fav: false } : { install: i })}
      onFav={(on) => select(on && install === 'uninstalled' ? { fav: on, install: 'all' } : { fav: on })}
      onSort={(s) => update({ sort: s })}
      onView={(v) => update({ view: v })}
      onCoverSize={onCoverSize}
      onRescan={onRescan}
    />
  )

  const title = <TopTitle>Bibliothèque</TopTitle>

  // Premier scan : squelettes.
  if (games.length === 0 && scanning && install !== 'uninstalled') {
    return (
      <div className="page lib" aria-busy="true">
        {title}
        {toolbar(true)}
        <div className="lib-grid">
          {Array.from({ length: 12 }, (_, i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  // Aucun jeu installé : le diagnostic du scan passe avant les jeux à installer (accessibles par « Non installés »).
  if (games.length === 0 && install !== 'uninstalled' && !(q && shown.length)) {
    return (
      <div className="page lib">
        {title}
        {hasUninstalled && toolbar()}
        <NoGames report={report} onRescan={onRescan} />
      </div>
    )
  }

  const clearFilters = (): void => {
    onClearQuery()
    update({ store: 'all', install: 'all', fav: false })
  }

  return (
    <div className="page lib" aria-busy={scanning || undefined}>
      {title}
      {toolbar()}
      {q && (
        <p className="lib-results" aria-live="polite">
          <span className="lib-results-query" title={q}>
            Résultats pour « {q} »
          </span>
          <span className="num">· {shown.length}</span>
          <button className="link-btn lib-results-clear" onClick={onClearQuery}>
            Effacer
          </button>
        </p>
      )}
      {fav && favCount === 0 ? (
        <div className="empty-state lib-empty-small">
          <div className="empty-icon">
            <Icon name="star" size={28} />
          </div>
          <h3>Aucun favori pour l'instant</h3>
          <p className="caption">Clique sur l'étoile d'une jaquette : tes favoris s'affichent ici et dans le rail, tout à gauche.</p>
          <div className="empty-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => update({ fav: false })}>
              Voir tous les jeux
            </button>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-state lib-empty-small">
          <div className="empty-icon">
            <Icon name="search" size={28} />
          </div>
          <h3>{q ? `Aucun jeu ne correspond à « ${q} »` : 'Aucun jeu ne correspond à ces filtres'}</h3>
          <div className="empty-actions">
            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Effacer les filtres
            </button>
          </div>
        </div>
      ) : (
        <>
          {prefs.view === 'list' ? (
            <div className="lib-list">
              <GameRowHead />
              {shown.map(item)}
            </div>
          ) : (
            <div className="lib-grid">{shown.map(item)}</div>
          )}
          {shownUninstalled && (
            <p className="lib-note">
              {install === 'uninstalled'
                ? 'Les jeux de ton compte Steam qui ne sont pas sur ce PC. Un clic sur Installer ouvre Steam, qui télécharge le jeu ; il rejoint ensuite ta bibliothèque tout seul.'
                : 'Les jeux Steam non installés apparaissent aussi : un clic sur Installer ouvre Steam.'}
            </p>
          )}
        </>
      )}
    </div>
  )
}
