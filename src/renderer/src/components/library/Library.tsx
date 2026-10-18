import { useMemo, useRef, useState } from 'react'
import { cleanName, norm, plural } from '@shared/text'
import type { Game, ScanReport } from '@shared/types'
import type { LibraryProps } from '../../contracts'
import { Icon } from '../ui/Icon'
import { STORE_LONG, StoreTag } from '../ui/StoreTag'
import { GameCard, GameCardSkeleton } from './GameCard'
import { Hero, HeroSkeleton } from './Hero'
import { LibraryToolbar, SORT_LABEL, STORES, type LibChip, type LibSort } from './LibraryToolbar'
import { RecentShelf } from './RecentShelf'
import './library.css'

// Filtre et tri propres à ce PC.
const STORAGE_KEY = 'pg.library'
const CHIPS: LibChip[] = ['all', 'fav', ...STORES]
const SORTS = Object.keys(SORT_LABEL) as LibSort[]

interface LibPrefs {
  chip: LibChip
  sort: LibSort
}

function loadPrefs(): LibPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<LibPrefs>
    return {
      chip: raw.chip && CHIPS.includes(raw.chip) ? raw.chip : 'all',
      sort: raw.sort && SORTS.includes(raw.sort) ? raw.sort : 'recent'
    }
  } catch {
    return { chip: 'all', sort: 'recent' }
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

/** Héros : dernier lancé ; sinon premier favori avec une image ; sinon premier jeu avec une image ; sinon aucun. */
function pickHero(games: Game[]): Game | null {
  let recent: Game | null = null
  for (const g of games) if (g.lastPlayed && (!recent || g.lastPlayed > (recent.lastPlayed ?? 0))) recent = g
  if (recent) return recent
  const hasArt = (g: Game): boolean => !!(g.heroUrl || g.coverUrl)
  return games.find((g) => g.favorite && hasArt(g)) ?? games.find(hasArt) ?? null
}

/** Jeux à la une (5 au plus) : le héros, puis les favoris et les derniers joués qui ont une bannière. */
function pickFeatured(games: Game[]): Game[] {
  const first = pickHero(games)
  if (!first) return []
  const rest = games.filter((g) => g.id !== first.id && !!g.heroUrl)
  const favs = rest.filter((g) => g.favorite).sort((a, b) => byRecent(a, b) || byName(a, b))
  const played = rest.filter((g) => !g.favorite && g.lastPlayed).sort(byRecent)
  return [first, ...favs, ...played].slice(0, 5)
}

function prefersReducedMotion(): boolean {
  return document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Library(props: LibraryProps): React.JSX.Element {
  const { games, friends, scanning, report, demo, query, onClearQuery, launchingId, onLaunch, onOpen, onFavorite, onRescan, onEnableDemo } = props
  const [prefs, setPrefs] = useState<LibPrefs>(loadPrefs)
  const collection = useRef<HTMLElement>(null)

  const update = (patch: Partial<LibPrefs>): void =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })

  const counts = useMemo(() => {
    const c: Record<LibChip, number> = { all: games.length, fav: 0, steam: 0, epic: 0, ea: 0 }
    for (const g of games) {
      c[g.store]++
      if (g.favorite) c.fav++
    }
    return c
  }, [games])

  // Un store dont la puce est masquée (0 jeu) retombe sur « Tous ».
  const chip: LibChip = prefs.chip !== 'all' && prefs.chip !== 'fav' && counts[prefs.chip] === 0 ? 'all' : prefs.chip
  const q = query.trim()

  const shown = useMemo(() => {
    const match = matcher(q)
    const inChip = (g: Game): boolean => chip === 'all' || (chip === 'fav' ? !!g.favorite : g.store === chip)
    return sortGames(
      games.filter((g) => inChip(g) && match(g)),
      prefs.sort
    )
  }, [games, chip, q, prefs.sort])

  const featured = useMemo(() => pickFeatured(games), [games])
  const heroId = featured[0]?.id
  const recent = useMemo(
    () =>
      games
        .filter((g) => g.lastPlayed && g.id !== heroId)
        .sort(byRecent)
        .slice(0, 8),
    [games, heroId]
  )

  const seeAll = (): void => {
    update({ sort: 'recent' })
    collection.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }

  const clearFilters = (): void => {
    onClearQuery()
    update({ chip: 'all' })
  }

  const toolbar = (loading = false): React.JSX.Element => (
    <LibraryToolbar
      total={games.length}
      resultCount={shown.length}
      counts={counts}
      chip={chip}
      sort={prefs.sort}
      query={loading ? '' : q}
      scanning={scanning}
      demo={demo}
      loading={loading}
      onChip={(c) => update({ chip: c })}
      onSort={(s) => update({ sort: s })}
      onClearQuery={onClearQuery}
      onRescan={onRescan}
    />
  )

  // Premier scan : squelettes.
  if (games.length === 0 && scanning) {
    return (
      <div className="page lib" aria-busy="true">
        <HeroSkeleton />
        <section className="lib-collection" aria-label="Bibliothèque">
          {toolbar(true)}
          <div className="lib-grid">
            {Array.from({ length: 12 }, (_, i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="page lib">
        <NoGames report={report} demo={demo} onRescan={onRescan} onEnableDemo={onEnableDemo} />
      </div>
    )
  }

  // Pendant une recherche, on va droit aux résultats.
  const searching = q.length > 0

  return (
    <div className="page lib" aria-busy={scanning || undefined}>
      {/* Pas de key : le héros garde sa diapositive par identifiant quand la liste change. */}
      {!searching && featured.length > 0 && (
        <Hero games={featured} friends={friends} launchingId={launchingId} onLaunch={onLaunch} onOpen={onOpen} onFavorite={onFavorite} />
      )}
      {!searching && recent.length >= 2 && <RecentShelf games={recent} launchingId={launchingId} onOpen={onOpen} onLaunch={onLaunch} onSeeAll={seeAll} />}

      <section ref={collection} className="lib-collection" aria-label="Bibliothèque">
        {toolbar()}
        {chip === 'fav' && counts.fav === 0 ? (
          <div className="empty-state lib-empty-small">
            <div className="empty-icon">
              <Icon name="star" size={28} />
            </div>
            <h3>Aucun favori pour l'instant.</h3>
            <p className="caption">Survole une jaquette et clique sur l'étoile pour l'épingler ici.</p>
            <div className="empty-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => update({ chip: 'all' })}>
                Voir tous les jeux
              </button>
            </div>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty-state lib-empty-small">
            <div className="empty-icon">
              <Icon name="search" size={28} />
            </div>
            <h3>{q ? `Aucun jeu ne correspond à « ${q} ».` : 'Aucun jeu ne correspond à ces filtres.'}</h3>
            <div className="empty-actions">
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
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
      </section>
    </div>
  )
}

interface NoGamesProps {
  report: ScanReport[]
  demo: boolean
  onRescan: () => void
  onEnableDemo: () => void
}

/** Aucun jeu détecté : relancer, comprendre (dossiers examinés) ou essayer la démo. */
function NoGames({ report, demo, onRescan, onEnableDemo }: NoGamesProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="empty-state lib-empty">
      <div className="empty-icon">
        <Icon name="gamepad" size={28} />
      </div>
      <h3>Aucun jeu détecté</h3>
      <p>On cherche les jeux installés via Steam, Epic Games et l'EA app sur ce PC.</p>
      <div className="empty-actions">
        <button className="btn btn-primary" onClick={onRescan}>
          <Icon name="refresh" size={16} />
          Relancer le scan
        </button>
        <button className="btn btn-secondary" aria-expanded={open} aria-controls="lib-scan-report" onClick={() => setOpen((o) => !o)}>
          Voir les dossiers examinés
          <Icon name="chevron-down" size={16} className={`lib-chevron ${open ? 'is-open' : ''}`} />
        </button>
      </div>
      {open && <ScanReportList id="lib-scan-report" report={report} />}
      {!demo && (
        <button className="link-btn lib-demo-link" onClick={onEnableDemo}>
          Essayer le mode démo
        </button>
      )}
    </div>
  )
}

function ScanReportList({ id, report }: { id: string; report: ScanReport[] }): React.JSX.Element {
  if (report.length === 0) {
    return (
      <p id={id} className="caption lib-report-none">
        Aucun dossier examiné pour l'instant. Relance le scan.
      </p>
    )
  }
  return (
    <ul id={id} className="lib-report card-surface">
      {report.map((r) => (
        <li key={r.store} className="lib-report-row">
          <div className="lib-report-head">
            <StoreTag kind={r.store} />
            <span className="lib-report-store">{STORE_LONG[r.store]}</span>
            <span className={`pill ${r.error ? 'pill-danger' : r.found ? 'pill-success' : 'pill-muted'}`}>
              {r.error ? 'Erreur' : r.found ? plural(r.found, 'jeu trouvé', 'jeux trouvés') : 'Aucun jeu'}
            </span>
          </div>
          {r.error && <p className="lib-report-error">{r.error}</p>}
          {r.checked.length > 0 ? (
            <ul className="lib-report-paths">
              {r.checked.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="caption">Aucun dossier examiné.</p>
          )}
        </li>
      ))}
    </ul>
  )
}
