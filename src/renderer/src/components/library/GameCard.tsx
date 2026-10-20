import { useEffect, useRef, useState } from 'react'
import { capitalize, cleanName, formatPlaytime, timeAgo } from '@shared/text'
import type { Game } from '@shared/types'
import { setArtFocus, setMorphSource } from '../../motion'
import { Cover, generatedBackground } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { LiveBadge } from '../ui/LiveBadge'
import { StoreTag } from '../ui/StoreTag'
import { useTilt } from './useTilt'

// Délai avant d'ouvrir la fiche au clic, pour laisser au double-clic le temps de lancer le jeu.
// Un double-clic plus lent est rattrapé par le voile de la fiche (GameSheet).
const CLICK_DELAY = 220

let cardOpenAt = 0
/** Vrai si la fiche vient d'être ouverte par le clic simple d'une jaquette (et pas par « Détails » ou une vignette). */
export function openedByCard(withinMs: number): boolean {
  return performance.now() - cardOpenAt < withinMs
}

/** Compteur qui rejoue l'animation « pop » de l'étoile à chaque clic. */
export function usePop(): [number, () => void] {
  const [n, setN] = useState(0)
  return [n, () => setN((x) => x + 1)]
}

/** Étoile favorite ; la clé change à chaque clic, ce qui remonte l'élément et relance l'animation. */
export function FavStar({ on, pop, size }: { on: boolean; pop: number; size: number }): React.JSX.Element {
  return (
    <span key={pop} className={`lib-star ${pop ? 'lib-pop' : ''}`}>
      <Icon name="star" size={size} filled={on} />
    </span>
  )
}

/** Méta courte : « 123 h · il y a 2 h », « En jeu · 45 h 45 » ou « Jamais lancé ». */
export function cardMeta(game: Game): string {
  if (game.running) return `En jeu${game.playtime ? ` · ${formatPlaytime(game.playtime)}` : ''}`
  // La plateforme est déjà sur la carte : le temps de jeu passe devant quand on le connaît.
  const when = game.lastPlayed ? timeAgo(game.lastPlayed) : 'jamais lancé'
  return game.playtime ? `${formatPlaytime(game.playtime)} · ${when}` : capitalize(when)
}

interface GameCardProps {
  game: Game
  launching: boolean
  onOpen: (g: Game) => void
  onLaunch: (g: Game) => void
  onFavorite: (g: Game) => void
}

export function GameCard({ game, launching, onOpen, onLaunch, onFavorite }: GameCardProps): React.JSX.Element {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const card = useRef<HTMLElement>(null)
  const media = useRef<HTMLDivElement>(null)
  const cover = useRef<HTMLDivElement>(null)
  const focusArt = useRef(false)
  // Monté pendant un tri animé : la transition de vue s'en charge, pas d'entrée en cascade.
  const [entering] = useState(() => !document.documentElement.classList.contains('vt-active'))
  const [glowFailed, setGlowFailed] = useState(false)
  const [pop, firePop] = usePop()
  const name = cleanName(game.name)
  const fav = !!game.favorite
  const art = game.heroUrl || game.coverUrl

  useTilt(media, card, art)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      // Retirée de la grille alors qu'elle avait le focus : on rend le fond.
      if (focusArt.current) setArtFocus(null)
    },
    []
  )

  const launch = (): void => {
    clearTimeout(timer.current)
    if (!launching) onLaunch(game)
  }

  const onClick = (e: React.MouseEvent): void => {
    clearTimeout(timer.current)
    if (e.detail > 1) return
    timer.current = setTimeout(() => {
      cardOpenAt = performance.now()
      setMorphSource(cover.current, game.id, 'cover')
      onOpen(game)
    }, CLICK_DELAY)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter') {
      e.preventDefault()
      launch()
    } else if (e.key === ' ') {
      e.preventDefault()
      setMorphSource(cover.current, game.id, 'cover')
      onOpen(game)
    }
  }

  // Focus clavier : même fond aux couleurs du jeu qu'au survol.
  const onFocus = (e: React.FocusEvent<HTMLElement>): void => {
    if (e.target !== e.currentTarget || !e.currentTarget.matches(':focus-visible')) return
    focusArt.current = true
    setArtFocus(art)
  }

  const onBlur = (): void => {
    if (!focusArt.current) return
    focusArt.current = false
    setArtFocus(null)
  }

  // Les boutons internes ne doivent ni ouvrir la fiche ni lancer au double-clic.
  const stop = (e: React.SyntheticEvent): void => e.stopPropagation()

  return (
    <article
      ref={card}
      className={`lib-card ${game.running ? 'is-running' : ''} ${entering ? 'is-entering' : ''} ${launching ? 'is-launching' : ''} ${fav ? 'is-fav' : ''}`}
      tabIndex={0}
      aria-label={`${name}, ${cardMeta(game)}`}
      aria-busy={launching || undefined}
      onClick={onClick}
      onDoubleClick={launch}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div ref={media} className="lib-card-media">
        <div className="lib-card-glow" aria-hidden="true" style={{ background: generatedBackground(game.name) }}>
          {game.coverUrl && !glowFailed && (
            <img src={game.coverUrl} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setGlowFailed(true)} />
          )}
        </div>
        <div className="lib-card-box">
          <div ref={cover} className="lib-card-cover">
            <Cover key={game.id} game={game} />
            {game.running && <LiveBadge className="lib-card-live" />}
            <div className="lib-card-overlay" aria-hidden="true" />
            <button
              className="lib-card-play"
              tabIndex={-1}
              aria-label={`Jouer à ${name}`}
              title={launching ? 'Lancement…' : 'Jouer'}
              disabled={launching}
              onClick={(e) => {
                stop(e)
                launch()
              }}
              onDoubleClick={stop}
            >
              {launching ? (
                <>
                  <span className="spinner" />
                  Lancement…
                </>
              ) : (
                <>
                  <Icon name="play" size={14} />
                  Jouer
                </>
              )}
            </button>
            <button
              className="lib-card-fav"
              aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              title={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              onClick={(e) => {
                stop(e)
                firePop()
                onFavorite(game)
              }}
              onDoubleClick={stop}
            >
              <FavStar on={fav} pop={pop} size={15} />
            </button>
          </div>
          <div className="lib-card-text">
            <span className="lib-card-words">
              <h3 className="lib-card-title" title={name}>
                {name}
              </h3>
              <p className="lib-card-meta">{launching ? 'Lancement…' : cardMeta(game)}</p>
            </span>
            <StoreTag kind={game.store} size={18} className="lib-card-tag" />
          </div>
          <div className="lib-card-glare" aria-hidden="true" />
          <div className="lib-card-ring fx-loop" aria-hidden="true" />
        </div>
      </div>
    </article>
  )
}

/** Jaquette fantôme pendant le premier scan. */
export function GameCardSkeleton(): React.JSX.Element {
  return (
    <div className="lib-card-skel" aria-hidden="true">
      <div className="skel lib-skel-cover" />
      <div className="lib-skel-text">
        <div className="skel lib-skel-line" style={{ width: '80%' }} />
        <div className="skel lib-skel-line sm" style={{ width: '45%' }} />
      </div>
    </div>
  )
}
