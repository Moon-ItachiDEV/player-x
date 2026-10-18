import { useEffect, useRef, useState } from 'react'
import { capitalize, cleanName, timeAgo } from '@shared/text'
import type { Game } from '@shared/types'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { KIND_LABEL } from '../ui/StoreTag'

interface ShelfProps {
  games: Game[]
  launchingId: string | null
  onOpen: (g: Game) => void
  onLaunch: (g: Game) => void
  /** « Tout voir » : tri par récents et défilement jusqu'à la grille. */
  onSeeAll: () => void
}

/** Rangée « Joués récemment » (défilement horizontal, fondu sur le bord qui déborde). */
export function RecentShelf({ games, launchingId, onOpen, onLaunch, onSeeAll }: ShelfProps): React.JSX.Element {
  const track = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  useEffect(() => {
    const el = track.current
    if (!el) return
    const update = (): void => {
      const max = el.scrollWidth - el.clientWidth
      setEdges({ start: el.scrollLeft > 4, end: max - el.scrollLeft > 4 })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    el.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', update)
    }
  }, [games.length])

  const scrollBy = (dir: 1 | -1): void => {
    const el = track.current
    if (!el) return
    const reduce = document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section className="lib-shelf" aria-labelledby="lib-shelf-title">
      <header className="lib-section-head">
        <h2 id="lib-shelf-title" className="lib-section-title">
          Joués récemment
        </h2>
        <button className="btn btn-ghost btn-sm" onClick={onSeeAll}>
          Tout voir
          <Icon name="chevron-right" size={14} />
        </button>
      </header>
      <div className="lib-shelf-viewport">
        <div ref={track} className={`lib-shelf-track ${edges.start ? 'fade-l' : ''} ${edges.end ? 'fade-r' : ''}`}>
          {games.map((g) => (
            <ShelfTile key={g.id} game={g} launching={launchingId === g.id} onOpen={onOpen} onLaunch={onLaunch} />
          ))}
        </div>
        {edges.start && (
          <button className="lib-shelf-arrow prev" tabIndex={-1} aria-label="Jeux précédents" title="Jeux précédents" onClick={() => scrollBy(-1)}>
            <Icon name="chevron-left" size={16} />
          </button>
        )}
        {edges.end && (
          <button className="lib-shelf-arrow next" tabIndex={-1} aria-label="Jeux suivants" title="Jeux suivants" onClick={() => scrollBy(1)}>
            <Icon name="chevron-right" size={16} />
          </button>
        )}
      </div>
    </section>
  )
}

interface TileProps {
  game: Game
  launching: boolean
  onOpen: (g: Game) => void
  onLaunch: (g: Game) => void
}

function ShelfTile({ game, launching, onOpen, onLaunch }: TileProps): React.JSX.Element {
  const name = cleanName(game.name)
  const meta = launching ? 'Lancement…' : `${game.lastPlayed ? capitalize(timeAgo(game.lastPlayed)) : 'Jamais lancé'} · ${KIND_LABEL[game.store]}`
  return (
    <div className={`lib-tile ${launching ? 'is-launching' : ''}`}>
      <div className="lib-tile-art" aria-hidden="true">
        <Cover key={game.id} game={game} variant="landscape" showTitle={false} />
        <span className="lib-tile-scrim" />
        <span className="lib-tile-text">
          <span className="lib-tile-name">{name}</span>
          <span className="lib-tile-meta">{meta}</span>
        </span>
      </div>
      {/* Toute la tuile ouvre la fiche ; le bouton rond lance le jeu. */}
      <button className="lib-tile-open" aria-label={`${name}, ${meta}`} title={name} onClick={() => onOpen(game)} />
      <button className="lib-tile-play" aria-label={`Jouer à ${name}`} title={launching ? 'Lancement…' : 'Jouer'} disabled={launching} onClick={() => onLaunch(game)}>
        {launching ? <span className="spinner" /> : <Icon name="play" size={16} />}
      </button>
    </div>
  )
}
