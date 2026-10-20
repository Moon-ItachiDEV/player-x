import { useMemo, useState } from 'react'
import { cleanName, norm } from '@shared/text'
import type { Game, Store } from '@shared/types'
import type { LibraryProps } from '../../contracts'
import { withViewTransition } from '../../motion'
import { TopTabs } from '../TopTabs'
import { Icon } from '../ui/Icon'
import { GameCard, GameCardSkeleton } from './GameCard'
import { LibraryToolbar, SORT_LABEL, STORES, type LibSort, type LibStore, type LibTab } from './LibraryToolbar'
import { NoGames } from './NoGames'
import './library.css'

// Onglet, store et tri propres à ce PC.
const STORAGE_KEY = 'pg.library'
const SORTS = Object.keys(SORT_LABEL) as LibSort[]

interface LibPrefs {
  tab: LibTab
  store: LibStore
  sort: LibSort
}

/** Lit les préférences ; l'ancienne puce unique (`chip` : tous, favoris ou un store) devient onglet + store. */
function loadPrefs(): LibPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<LibPrefs> & { chip?: string }
    const isStore = (v: unknown): v is Store => STORES.includes(v as Store)
    const tab: LibTab = raw.tab === 'fav' || (raw.tab === undefined && raw.chip === 'fav') ? 'fav' : 'all'
    const store: LibStore = isStore(raw.store) ? raw.store : raw.store === undefined && isStore(raw.chip) ? raw.chip : 'all'
    return { tab, store, sort: raw.sort && SORTS.includes(raw.sort) ? raw.sort : 'recent' }
  } catch {
    return { tab: 'all', store: 'all', sort: 'recent' }
  }
}

function savePrefs(p: LibPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* stockage indisponible : la préférence vaut pour la session */
  }
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
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
  const { games, scanning, report, demo, query, onClearQuery, launchingId, onLaunch, onOpen, onFavorite, onRescan, onEnableDemo, coverSize, onCoverSize } = props
  const [prefs, setPrefs] = useState<LibPrefs>(loadPrefs)

  const update = (patch: Partial<LibPrefs>): void =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })

  const q = query.trim()
  // Une recherche porte sur toute la bibliothèque : l'onglet affiché est « Tous » le temps de la recherche.
  const tab: LibTab = q ? 'all' : prefs.tab
  const favCount = useMemo(() => games.filter((g) => g.favorite).length, [games])
  const inTab = useMemo(() => (tab === 'fav' ? games.filter((g) => g.favorite) : games), [games, tab])
  const storeCounts = useMemo(() => {
    const c: Record<Store, number> = { steam: 0, epic: 0, ea: 0 }
    for (const g of inTab) c[g.store]++
    return c
  }, [inTab])

  // Un store sans jeu dans l'onglet retombe sur « Tous ».
  const store: LibStore = prefs.store !== 'all' && storeCounts[prefs.store] === 0 ? 'all' : prefs.store

  const shown = useMemo(() => {
    const match = matcher(q)
    return sortGames(
      inTab.filter((g) => (store === 'all' || g.store === store) && match(g)),
      prefs.sort
    )
  }, [inTab, store, q, prefs.sort])

  const tabs = (
    <TopTabs<LibTab>
      label="Bibliothèque"
      idBase="lib"
      value={tab}
      onChange={(next) => {
        if (next === tab) return
        withViewTransition(
          () => {
            if (q) onClearQuery()
            update({ tab: next })
          },
          { kind: 'reorder' }
        )
      }}
      tabs={[
        { id: 'all', label: 'Tous', icon: 'grid', badge: games.length },
        { id: 'fav', label: 'Favoris', icon: 'star', badge: favCount }
      ]}
    />
  )

  const toolbar = (loading = false): React.JSX.Element => (
    <LibraryToolbar
      total={inTab.length}
      resultCount={shown.length}
      storeCounts={storeCounts}
      store={store}
      sort={prefs.sort}
      coverSize={coverSize}
      query={loading ? '' : q}
      scanning={scanning}
      loading={loading}
      onStore={(s) => update({ store: s })}
      onSort={(s) => update({ sort: s })}
      onCoverSize={onCoverSize}
      onClearQuery={onClearQuery}
      onRescan={onRescan}
    />
  )

  // Premier scan : squelettes.
  if (games.length === 0 && scanning) {
    return (
      <div className="page lib" aria-busy="true">
        {tabs}
        {toolbar(true)}
        <div className="lib-grid">
          {Array.from({ length: 12 }, (_, i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="page lib">
        {tabs}
        <NoGames report={report} demo={demo} onRescan={onRescan} onEnableDemo={onEnableDemo} />
      </div>
    )
  }

  const clearFilters = (): void => {
    onClearQuery()
    update({ store: 'all' })
  }

  return (
    <div className="page lib" id="lib-panel" role="tabpanel" aria-labelledby={`lib-tab-${tab}`} aria-busy={scanning || undefined}>
      {tabs}
      {toolbar()}
      {tab === 'fav' && favCount === 0 ? (
        <div className="empty-state lib-empty-small">
          <div className="empty-icon">
            <Icon name="star" size={28} />
          </div>
          <h3>Aucun favori pour l'instant</h3>
          <p className="caption">Clique sur l'étoile d'une jaquette : tes favoris s'affichent ici et dans le rail, tout à gauche.</p>
          <div className="empty-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => update({ tab: 'all' })}>
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
        <div className="lib-grid">
          {shown.map((g) => (
            <GameCard key={g.id} game={g} launching={launchingId === g.id} onOpen={onOpen} onLaunch={onLaunch} onFavorite={onFavorite} />
          ))}
        </div>
      )}
    </div>
  )
}
