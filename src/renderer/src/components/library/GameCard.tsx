import { useEffect, useRef, useState } from 'react'
import { capitalize, cleanName, timeAgo } from '@shared/text'
import type { Game } from '@shared/types'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { KIND_LABEL, StoreTag } from '../ui/StoreTag'

// Délai avant d'ouvrir la fiche au clic, pour laisser au double-clic le temps de lancer le jeu.
const CLICK_DELAY = 220

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

/** Méta courte : « Steam · Il y a 2 j » ou « Epic · Jamais lancé ». */
export function cardMeta(game: Game): string {
  return `${KIND_LABEL[game.store]} · ${game.lastPlayed ? capitalize(timeAgo(game.lastPlayed)) : 'Jamais lancé'}`
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
  const [pop, firePop] = usePop()
  const name = cleanName(game.name)
  const fav = !!game.favorite

  useEffect(() => () => clearTimeout(timer.current), [])

  const launch = (): void => {
    clearTimeout(timer.current)
    if (!launching) onLaunch(game)
  }

  const onClick = (e: React.MouseEvent): void => {
    clearTimeout(timer.current)
    if (e.detail > 1) return
    timer.current = setTimeout(() => onOpen(game), CLICK_DELAY)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter') {
      e.preventDefault()
      launch()
    } else if (e.key === ' ') {
      e.preventDefault()
      onOpen(game)
    }
  }

  // Les boutons internes ne doivent ni ouvrir la fiche ni lancer au double-clic.
  const stop = (e: React.SyntheticEvent): void => e.stopPropagation()

  return (
    <article
      className={`lib-card ${launching ? 'is-launching' : ''} ${fav ? 'is-fav' : ''}`}
      tabIndex={0}
      aria-label={`${name}, ${cardMeta(game)}`}
      aria-busy={launching || undefined}
      onClick={onClick}
      onDoubleClick={launch}
      onKeyDown={onKeyDown}
    >
      <div className="lib-card-box">
        <Cover key={game.id} game={game} />
        <StoreTag kind={game.store} size={22} className="lib-card-tag" />
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
          {launching ? <span className="spinner" /> : <Icon name="play" size={18} />}
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
          <FavStar on={fav} pop={pop} size={16} />
        </button>
      </div>
      <div className="lib-card-text">
        <h3 className="lib-card-title" title={name}>
          {name}
        </h3>
        <p className="caption lib-card-meta">{launching ? 'Lancement…' : cardMeta(game)}</p>
      </div>
    </article>
  )
}

/** Jaquette fantôme pendant le premier scan. */
export function GameCardSkeleton(): React.JSX.Element {
  return (
    <div className="lib-card-skel" aria-hidden="true">
      <div className="skel lib-skel-cover" />
      <div className="skel lib-skel-line" style={{ width: '80%' }} />
      <div className="skel lib-skel-line sm" style={{ width: '45%' }} />
    </div>
  )
}
