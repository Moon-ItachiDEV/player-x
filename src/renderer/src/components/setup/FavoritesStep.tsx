// Étape 2 : grandes jaquettes 2:3 à cocher. Filtres par store et recherche au-delà de 12 jeux.
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { cleanName, norm, plural } from '@shared/text'
import type { Game, Store } from '@shared/types'
import { useTilt } from '../library/useTilt'
import { Cover, generatedBackground } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { KIND_LABEL, STORE_LONG } from '../ui/StoreTag'
import { STORES } from './ScanStep'

/** Au-delà, la grille gagne des filtres par store et une recherche. */
const TOOLS_FROM = 13
const ENTER_MS = 1400

type Filter = 'all' | Store

interface PickProps {
  game: Game
  selected: boolean
  onToggle: (id: string) => void
}

/** Une jaquette = un bouton bascule. Relief, reflet et halo seulement sous la souris (useTilt pose [data-tilt]). */
const Pick = memo(function Pick({ game, selected, onToggle }: PickProps): React.JSX.Element {
  const host = useRef<HTMLButtonElement>(null)
  const media = useRef<HTMLSpanElement>(null)
  const [glowFailed, setGlowFailed] = useState(false)
  const name = cleanName(game.name)
  useTilt(media, host, game.heroUrl || game.coverUrl)

  return (
    <button ref={host} type="button" className={`pick ${selected ? 'is-selected' : ''}`} aria-pressed={selected} title={name} onClick={() => onToggle(game.id)}>
      <span ref={media} className="pick-media">
        <span className="pick-glow" aria-hidden="true" style={{ background: generatedBackground(game.name) }}>
          {game.coverUrl && !glowFailed && (
            <img src={game.coverUrl} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setGlowFailed(true)} />
          )}
        </span>
        <span className="pick-box">
          <Cover game={game} />
          <span className="pick-dim" aria-hidden="true" />
          <span className="pick-glare" aria-hidden="true" />
          <span className="pick-ring" aria-hidden="true" />
          <span className="pick-sel" aria-hidden="true" />
          <span className="pick-check" aria-hidden="true">
            <Icon name="check" size={16} />
          </span>
        </span>
      </span>
      <span className="pick-text">
        <span className="pick-name">{name}</span>
        <span className={`pick-store tint-${game.store}`}>{STORE_LONG[game.store]}</span>
      </span>
    </button>
  )
})

/** Jaquettes par rangée : 5 au plus, rangées équilibrées pour les petites bibliothèques (6 → 3 + 3, 7 → 4 + 3). */
function rowSize(n: number): number {
  return n <= 5 ? Math.max(1, n) : Math.ceil(n / Math.ceil(n / 5))
}

/** Joués récemment d'abord (les plus probables), puis par ordre alphabétique. Ordre figé pendant l'étape. */
function byRelevance(a: Game, b: Game): number {
  return (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0) || cleanName(a.name).localeCompare(cleanName(b.name), 'fr')
}

interface FavoritesStepProps {
  games: Game[]
  selected: ReadonlySet<string>
  demo: boolean
  onToggle: (id: string) => void
  headingRef: RefObject<HTMLHeadingElement | null>
  searchRef: RefObject<HTMLInputElement | null>
}

export function FavoritesStep({ games, selected, demo, onToggle, headingRef, searchRef }: FavoritesStepProps): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [entering, setEntering] = useState(true)
  const [stuck, setStuck] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const total = games.length
  const tools = total >= TOOLS_FROM

  const sorted = useMemo(() => [...games].sort(byRelevance), [games])
  const counts = useMemo(() => {
    const c: Record<Store, number> = { steam: 0, epic: 0, ea: 0 }
    for (const g of games) c[g.store]++
    return c
  }, [games])

  // Un store qui n'a plus de jeux (bibliothèque rechargée) : retour à « Tous ».
  const activeFilter: Filter = filter !== 'all' && counts[filter] === 0 ? 'all' : filter
  const visible = useMemo(() => {
    const q = norm(query)
    return sorted.filter((g) => (activeFilter === 'all' || g.store === activeFilter) && (!q || norm(g.name).includes(q)))
  }, [sorted, activeFilter, query])

  // Entrée en cascade au premier affichage seulement (les jaquettes filtrées ensuite apparaissent en fondu).
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), ENTER_MS)
    return () => clearTimeout(t)
  }, [])

  // Barre d'outils collante : un filet et un fond seulement une fois décollée du titre.
  useEffect(() => {
    const el = sentinel.current
    const root = el?.closest('.setup-main')
    if (!el || !root) return
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { root, threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [tools])

  const reset = (): void => {
    setQuery('')
    setFilter('all')
  }

  const hasSel = selected.size > 0

  return (
    <section className="fav" aria-labelledby="setup-title">
      <header className="setup-head fav-head">
        <p className="setup-overline">{demo ? `Mode démo · ${plural(total, 'jeu', 'jeux')}` : `${plural(total, 'jeu détecté', 'jeux détectés')} sur ton PC`}</p>
        <h1 id="setup-title" ref={headingRef} tabIndex={-1} className="setup-title">
          Choisis tes jeux favoris
        </h1>
        <p className="setup-sub">Ils passent en tête de ta bibliothèque, prêts à lancer. Tu pourras les changer quand tu veux.</p>
      </header>

      {tools && (
        <>
          <div ref={sentinel} className="fav-sentinel" aria-hidden="true" />
          <div className={`fav-tools ${stuck ? 'is-stuck' : ''}`}>
            <div className="fav-tools-in">
              <div className="fav-chips" role="group" aria-label="Filtrer par store">
                <button type="button" className={`chip ${activeFilter === 'all' ? 'active' : ''}`} aria-pressed={activeFilter === 'all'} onClick={() => setFilter('all')}>
                  Tous <span className="chip-count">{total}</span>
                </button>
                {STORES.filter((s) => counts[s] > 0).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`chip tint-${s} ${activeFilter === s ? 'active' : ''}`}
                    aria-pressed={activeFilter === s}
                    onClick={() => setFilter(s)}
                  >
                    <span className="chip-dot" aria-hidden="true" />
                    {KIND_LABEL[s]} <span className="chip-count">{counts[s]}</span>
                  </button>
                ))}
              </div>
              <div className="fav-search">
                <Icon name="search" size={16} className="fav-search-icon" />
                <input
                  ref={searchRef}
                  className="input"
                  type="text"
                  value={query}
                  placeholder="Rechercher un jeu"
                  aria-label="Rechercher un jeu"
                  spellCheck={false}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && query) {
                      e.stopPropagation()
                      setQuery('')
                    }
                  }}
                />
                {query && (
                  <button type="button" className="icon-btn icon-btn-sm fav-search-clear" aria-label="Effacer la recherche" onClick={() => setQuery('')}>
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="sr-only" aria-live="polite">
            {query || activeFilter !== 'all' ? plural(visible.length, 'jeu affiché', 'jeux affichés') : ''}
          </p>
        </>
      )}

      {visible.length > 0 ? (
        <div
          className={`picks ${hasSel ? 'has-sel' : ''} ${entering ? 'is-entering' : ''}`}
          style={{ '--per-row': rowSize(visible.length) } as CSSProperties}
          role="group"
          aria-label="Jeux détectés"
        >
          {visible.map((g) => (
            <Pick key={g.id} game={g} selected={selected.has(g.id)} onToggle={onToggle} />
          ))}
        </div>
      ) : (
        <div className="fav-none">
          <p>{query ? `Aucun jeu ne correspond à «\u00a0${query.trim()}\u00a0».` : 'Aucun jeu pour ce store.'}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
            Tout afficher
          </button>
        </div>
      )}
    </section>
  )
}
