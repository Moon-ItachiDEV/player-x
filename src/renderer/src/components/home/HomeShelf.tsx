// « Ta bibliothèque » : carrousel de jaquettes, filtre de store, « Tout voir » et boutons précédent / suivant.
import { useEffect, useMemo, useRef, useState } from 'react'
import { cardMeta } from '@shared/played'
import { cleanName } from '@shared/text'
import type { Game, Store } from '@shared/types'
import type { LaunchFn } from '../../contracts'
import { PlayIcon } from '../../launch/PlayLabel'
import { usePlayState } from '../../launch/usePlayState'
import { setArtFocus, setMorphSource } from '../../motion'
import { NewsBadge } from '../news/NewsBadge'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { KIND_LABEL } from '../ui/StoreTag'
import { shelfList, storesOf } from './pick'
import { useRowScroll } from './rowScroll'

interface Props {
  games: Game[]
  /** Jeu à la une : sa jaquette est surlignée. */
  heroId: string
  onLaunch: LaunchFn
  onOpen: (g: Game) => void
  onShowLibrary: () => void
}

export function HomeShelf({ games, heroId, onLaunch, onOpen, onShowLibrary }: Props): React.JSX.Element | null {
  const [store, setStore] = useState<Store | 'all'>('all')
  const stores = useMemo(() => storesOf(games), [games])
  // Store disparu de la bibliothèque (démo coupée…) : retour à « Tout ».
  const shown = store !== 'all' && !stores.includes(store) ? 'all' : store
  const list = useMemo(() => shelfList(games, shown), [games, shown])
  const { track, edges, scrollBy } = useRowScroll(list.length)

  // Nouveau filtre : on repart du début de la rangée.
  useEffect(() => {
    track.current?.scrollTo({ left: 0 })
  }, [shown, track])

  // Jeu à la une changé (molette, « À reprendre ») : sa jaquette reste visible dans la rangée, sans faire défiler la page.
  useEffect(() => {
    const t = track.current
    const tile = t ? [...t.querySelectorAll<HTMLElement>('[data-id]')].find((el) => el.dataset.id === heroId) : undefined
    if (!t || !tile) return
    const left = tile.offsetLeft - t.offsetLeft
    if (left >= t.scrollLeft && left + tile.offsetWidth <= t.scrollLeft + t.clientWidth) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    t.scrollTo({ left: Math.max(0, left - 24), behavior: reduce ? 'auto' : 'smooth' })
  }, [heroId, track])

  if (!list.length) return null
  return (
    <section className="hm-shelf" aria-labelledby="hm-shelf-title">
      <header className="hm-shelf-head">
        <h2 id="hm-shelf-title" className="hm-h2">
          Ta bibliothèque
        </h2>
        {stores.length > 1 && (
          <div className="hm-seg" role="group" aria-label="Plateforme">
            {(['all', ...stores] as const).map((s) => (
              <button key={s} className="hm-seg-btn" aria-pressed={shown === s} onClick={() => setStore(s)}>
                {s === 'all' ? 'Tout' : KIND_LABEL[s]}
              </button>
            ))}
          </div>
        )}
        <span className="hm-grow" />
        <button className="hm-link" onClick={onShowLibrary}>
          Tout voir
        </button>
        <button className="hm-round hm-nav" aria-label="Jeux précédents" title="Précédent" disabled={!edges.start} onClick={() => scrollBy(-1)}>
          <Icon name="chevron-left" size={18} />
        </button>
        <button className="hm-round hm-nav is-next" aria-label="Jeux suivants" title="Suivant" disabled={!edges.end} onClick={() => scrollBy(1)}>
          <Icon name="chevron-right" size={18} />
        </button>
      </header>
      <div ref={track} className={`hm-track ${edges.end ? 'has-more' : ''}`}>
        {list.map((g) => (
          <ShelfTile key={g.id} game={g} target={g.id === heroId} onLaunch={onLaunch} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

interface TileProps {
  game: Game
  target: boolean
  onLaunch: LaunchFn
  onOpen: (g: Game) => void
}

/** Jaquette : ouvre la fiche ; le bouton Jouer apparaît au survol et au clavier. */
function ShelfTile({ game, target, onLaunch, onOpen }: TileProps): React.JSX.Element {
  const art = useRef<HTMLButtonElement>(null)
  const lit = useRef(false)
  const p = usePlayState(game, onLaunch)
  const name = cleanName(game.name)
  const image = game.heroUrl || game.coverUrl
  const sub = target && !game.running ? `À la une · ${cardMeta(game)}` : cardMeta(game)

  // Fond de la page aux couleurs du jeu survolé ; rendu par cette jaquette seulement.
  const light = (on: boolean): void => {
    if (on === lit.current) return
    lit.current = on
    setArtFocus(on ? image : null)
  }
  useEffect(
    () => () => {
      if (lit.current) setArtFocus(null)
    },
    []
  )

  const open = (): void => {
    setMorphSource(art.current, game.id, 'cover')
    onOpen(game)
  }

  return (
    <div
      className={`hm-tile ${target ? 'is-target' : ''} ${game.running ? 'is-live' : ''} ${p.className ? 'is-busy' : ''}`}
      data-id={game.id}
      onPointerEnter={() => light(true)}
      onPointerLeave={() => light(false)}
      onFocus={() => light(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) light(false)
      }}
    >
      <button ref={art} className="hm-tile-open" aria-label={`Fiche de ${name}${target ? ', à la une' : ''}`} title="Voir la fiche" onClick={open}>
        <Cover game={game} showTitle={false} />
        <span className="hm-tile-shade" aria-hidden="true" />
        <span className="hm-pill hm-tile-store">{KIND_LABEL[game.store]}</span>
        {game.newPatch && <NewsBadge patch={game.newPatch} className="hm-tile-news" />}
        <span className="hm-tile-text">
          <span className="hm-tile-name">{name}</span>
          <span className={`hm-tile-sub num ${game.running ? 'is-live' : ''}`}>{sub}</span>
        </span>
      </button>
      <button
        className={`hm-tile-play ${p.className}`}
        aria-label={p.ariaLabel}
        title={p.title}
        aria-disabled={p.inert || undefined}
        aria-busy={p.busy || undefined}
        onClick={() => p.activate(art.current)}
      >
        <PlayIcon p={p} size={18} />
      </button>
    </div>
  )
}
