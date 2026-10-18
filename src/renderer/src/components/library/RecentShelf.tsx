import { useEffect, useRef, useState } from 'react'
import { capitalize, cleanName, timeAgo } from '@shared/text'
import type { Game } from '@shared/types'
import { motionReduced, setArtFocus, setMorphSource } from '../../motion'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { KIND_LABEL } from '../ui/StoreTag'
import './shelf.css'

interface ShelfProps {
  games: Game[]
  launchingId: string | null
  onOpen: (g: Game) => void
  onLaunch: (g: Game) => void
  /** « Tout voir » : tri par récents et défilement jusqu'à la grille. */
  onSeeAll: () => void
}

/**
 * Rangée « Joués récemment » (défilement horizontal, fondu sur le bord qui déborde).
 * Effets complets : jaquettes portrait qui s'ouvrent sur le visuel paysage au survol ou au focus.
 */
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
    // Une tuile qui s'ouvre change la largeur défilable ; au clavier, on la garde entière à l'écran.
    const onTransitionEnd = (e: TransitionEvent): void => {
      if (e.propertyName !== 'flex-basis' || !(e.target instanceof HTMLElement)) return
      update()
      if (e.target.matches(':has(:focus-visible)')) e.target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: motionReduced() ? 'auto' : 'smooth' })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    el.addEventListener('scroll', update, { passive: true })
    el.addEventListener('transitionend', onTransitionEnd)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', update)
      el.removeEventListener('transitionend', onTransitionEnd)
    }
  }, [games.length])

  const scrollBy = (dir: 1 | -1): void => {
    const el = track.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: motionReduced() ? 'auto' : 'smooth' })
  }

  return (
    <section className="shelf" aria-labelledby="shelf-title">
      <header className="shelf-head">
        <h2 id="shelf-title" className="shelf-title">
          Joués récemment
        </h2>
        <button className="btn btn-ghost btn-sm" onClick={onSeeAll}>
          Tout voir
          <Icon name="chevron-right" size={14} />
        </button>
      </header>
      <div className="shelf-viewport">
        <div ref={track} className={`shelf-track ${edges.start ? 'fade-l' : ''} ${edges.end ? 'fade-r' : ''}`}>
          {games.map((g) => (
            <ShelfTile key={g.id} game={g} launching={launchingId === g.id} track={track} onOpen={onOpen} onLaunch={onLaunch} />
          ))}
        </div>
        {edges.start && (
          <button className="shelf-arrow prev" tabIndex={-1} aria-label="Jeux précédents" title="Jeux précédents" onClick={() => scrollBy(-1)}>
            <Icon name="chevron-left" size={16} />
          </button>
        )}
        {edges.end && (
          <button className="shelf-arrow next" tabIndex={-1} aria-label="Jeux suivants" title="Jeux suivants" onClick={() => scrollBy(1)}>
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
  track: React.RefObject<HTMLDivElement | null>
  onOpen: (g: Game) => void
  onLaunch: (g: Game) => void
}

function ShelfTile({ game, launching, track, onOpen, onLaunch }: TileProps): React.JSX.Element {
  const clip = useRef<HTMLDivElement>(null)
  // Fond aux couleurs du jeu : posé par cette tuile (survol ou focus), retiré seulement par elle.
  const lit = useRef({ hover: false, focus: false })
  const art = game.heroUrl || game.coverUrl
  const name = cleanName(game.name)
  const meta = launching ? 'Lancement…' : `${game.lastPlayed ? capitalize(timeAgo(game.lastPlayed)) : 'Jamais lancé'} · ${KIND_LABEL[game.store]}`

  const light = (key: 'hover' | 'focus', on: boolean): void => {
    const s = lit.current
    const was = s.hover || s.focus
    s[key] = on
    const now = s.hover || s.focus
    if (now && !was) setArtFocus(art)
    else if (!now && was) setArtFocus(null)
  }

  useEffect(
    () => () => {
      const s = lit.current
      if (s.hover || s.focus) setArtFocus(null)
    },
    []
  )

  const open = (): void => {
    // Morphing vers l'en-tête de la fiche seulement si la tuile est entière dans la rangée.
    const el = clip.current
    const box = track.current?.getBoundingClientRect()
    const r = el?.getBoundingClientRect()
    const whole = !!box && !!r && r.left >= box.left - 1 && r.right <= box.right + 1
    setMorphSource(whole ? el : null, game.id, 'art')
    onOpen(game)
  }

  return (
    <div
      className={`shelf-tile ${launching ? 'is-launching' : ''}`}
      onPointerEnter={() => light('hover', true)}
      onPointerLeave={() => light('hover', false)}
      onFocus={() => light('focus', true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) light('focus', false)
      }}
    >
      <div ref={clip} className="shelf-tile-clip" aria-hidden="true">
        <div className="shelf-tile-hero">
          <Cover key={`h-${game.id}`} game={game} variant="landscape" showTitle={false} />
        </div>
        <div className="shelf-tile-cover">
          <Cover key={`c-${game.id}`} game={game} variant="portrait" />
        </div>
        <span className="shelf-tile-scrim" />
        <span className="shelf-tile-text">
          <span className="shelf-tile-name">{name}</span>
          <span className="shelf-tile-meta">{meta}</span>
        </span>
      </div>
      {/* Toute la tuile ouvre la fiche ; le bouton rond lance le jeu. */}
      <button className="shelf-tile-open" aria-label={`${name}, ${meta}`} title={name} onClick={open} />
      <button className="shelf-tile-play" aria-label={`Jouer à ${name}`} title={launching ? 'Lancement…' : 'Jouer'} disabled={launching} onClick={() => onLaunch(game)}>
        {launching ? <span className="spinner" /> : <Icon name="play" size={16} />}
      </button>
    </div>
  )
}
