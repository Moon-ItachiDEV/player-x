import { useEffect, useRef, useState } from 'react'
import { cardMeta } from '@shared/played'
import { capitalize, cleanName, formatPlaytime, timeAgo } from '@shared/text'
import type { Game } from '@shared/types'
import type { LaunchFn } from '../../contracts'
import { libraryMeta } from '../../launch/copy'
import { PlayLabel } from '../../launch/PlayLabel'
import { usePlayState, type PlayInfo } from '../../launch/usePlayState'
import { setArtFocus, setMorphSource } from '../../motion'
import { Cover, generatedBackground } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { KIND_LABEL, STORE_LONG } from '../ui/StoreTag'
import { useTilt } from './useTilt'
import '../ui/live.css'

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

interface GameItemProps {
  game: Game
  onOpen: (g: Game) => void
  onLaunch: LaunchFn
  onFavorite: (g: Game) => void
}

/**
 * Comportement commun d'une jaquette et d'une ligne : clic = fiche (après le délai du double-clic), double-clic ou
 * Entrée = jouer (ou installer), Espace = fiche, focus clavier = fond aux couleurs du jeu.
 */
function useGameItem({ game, onOpen, onLaunch }: GameItemProps) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cover = useRef<HTMLDivElement>(null)
  const focusArt = useRef(false)
  const art = game.heroUrl || game.coverUrl
  const p = usePlayState(game, onLaunch)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      // Retirée de la liste alors qu'elle avait le focus : on rend le fond.
      if (focusArt.current) setArtFocus(null)
    },
    []
  )

  const launch = (): void => {
    clearTimeout(timer.current)
    p.activate(cover.current)
  }

  const open = (): void => {
    setMorphSource(cover.current, game.id, 'cover')
    onOpen(game)
  }

  const handlers = {
    onClick: (e: React.MouseEvent): void => {
      clearTimeout(timer.current)
      if (e.detail > 1) return
      timer.current = setTimeout(() => {
        cardOpenAt = performance.now()
        open()
      }, CLICK_DELAY)
    },
    onDoubleClick: launch,
    onKeyDown: (e: React.KeyboardEvent): void => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter') {
        e.preventDefault()
        launch()
      } else if (e.key === ' ') {
        e.preventDefault()
        open()
      }
    },
    // Focus clavier : même fond aux couleurs du jeu qu'au survol.
    onFocus: (e: React.FocusEvent<HTMLElement>): void => {
      if (e.target !== e.currentTarget || !e.currentTarget.matches(':focus-visible')) return
      focusArt.current = true
      setArtFocus(art)
    },
    onBlur: (): void => {
      if (!focusArt.current) return
      focusArt.current = false
      setArtFocus(null)
    }
  }

  return { p, cover, art, launch, handlers }
}

// Les boutons internes ne doivent ni ouvrir la fiche ni lancer au double-clic.
const stop = (e: React.SyntheticEvent): void => e.stopPropagation()

/** Pastille d'état du jeu : en jeu (cyan) ou nouveau patch (rose) ; rien sinon. */
function StateBadge({ game, className }: { game: Game; className: string }): React.JSX.Element | null {
  if (game.running) {
    return (
      <span className={`lib-badge lib-badge-live ${className}`}>
        <span className="live-dot fx-loop" aria-hidden="true" />
        En jeu
      </span>
    )
  }
  if (game.newPatch) {
    return (
      <span className={`lib-badge lib-badge-patch ${className}`} title={`${game.newPatch.title} · ${capitalize(timeAgo(game.newPatch.at))}`}>
        Nouveau patch
      </span>
    )
  }
  return null
}

/** Bouton étoile (favori), commun à la jaquette et à la ligne. */
function FavButton({ game, onFavorite, className, size }: { game: Game; onFavorite: (g: Game) => void; className: string; size: number }): React.JSX.Element {
  const [pop, firePop] = usePop()
  const fav = !!game.favorite
  return (
    <button
      type="button"
      className={className}
      aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      aria-pressed={fav}
      title={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      onClick={(e) => {
        stop(e)
        firePop()
        onFavorite(game)
      }}
      onDoubleClick={stop}
    >
      <FavStar on={fav} pop={pop} size={size} />
    </button>
  )
}

/** Méta d'un jeu : où en est le lancement, sinon temps de jeu et dernière partie. */
function metaOf(game: Game, p: PlayInfo): string {
  return libraryMeta(p.state, p.launch?.status.route ?? null) ?? cardMeta(game)
}

const itemClass = (game: Game, p: PlayInfo): string =>
  `${game.running ? 'is-running' : ''} ${p.state !== 'idle' && p.state !== 'running' ? 'is-launching' : ''} ${game.favorite ? 'is-fav' : ''} ${game.notInstalled ? 'is-uninstalled' : ''}`

const ariaOf = (name: string, meta: string, game: Game): string => `${name}, ${meta}${game.newPatch ? ', nouveau patch' : ''}`

/**
 * Jaquette de la grille (direction « Écran console », 0.9.5-beta.7) : l'image seule, sans pastille posée sur le logo du jeu ;
 * le nom (en entier, sur deux lignes au plus) et la ligne d'infos sous l'image. En haut à droite : En jeu, Nouveau patch,
 * ou « Installer » (au survol) pour un jeu pas installé.
 */
export function GameCard(props: GameItemProps): React.JSX.Element {
  const { game, onFavorite } = props
  const card = useRef<HTMLElement>(null)
  const media = useRef<HTMLDivElement>(null)
  // Monté pendant un tri animé : la transition de vue s'en charge, pas d'entrée en cascade.
  const [entering] = useState(() => !document.documentElement.classList.contains('vt-active'))
  const [glowFailed, setGlowFailed] = useState(false)
  const { p, cover, art, launch, handlers } = useGameItem(props)
  const name = cleanName(game.name)
  // Jeu du compte Steam pas installé : « Installer » à la place de « Jouer », pas de favori.
  const install = !!game.notInstalled
  const meta = metaOf(game, p)
  // Sous la jaquette d'un jeu pas installé : sa section le dit déjà ; seulement le temps de jeu Steam s'il y en a.
  const line = install && !libraryMeta(p.state, p.launch?.status.route ?? null) ? (game.playtime || game.lastPlayed ? cardMeta({ ...game, notInstalled: false }) : '') : meta

  useTilt(media, card, art)

  return (
    <article
      ref={card}
      className={`lib-card ${itemClass(game, p)} ${entering ? 'is-entering' : ''}`}
      data-launch={p.state === 'idle' ? undefined : p.state}
      tabIndex={0}
      aria-label={ariaOf(name, meta, game)}
      aria-busy={p.busy || undefined}
      {...handlers}
    >
      <div ref={media} className="lib-card-media">
        <div className="lib-card-glow" aria-hidden="true" style={{ background: generatedBackground(game.name) }}>
          {game.coverUrl && !glowFailed && <img src={game.coverUrl} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setGlowFailed(true)} />}
        </div>
        <div className="lib-card-box">
          <div ref={cover} className="lib-card-cover">
            <Cover key={game.id} game={game} showTitle={false} />
            <div className="lib-card-overlay" aria-hidden="true" />
            {install ? (
              <button
                type="button"
                className="lib-badge lib-badge-install lib-card-corner"
                tabIndex={-1}
                aria-label={`Installer ${name} avec Steam`}
                title="Installer avec Steam"
                aria-disabled={p.inert || undefined}
                onClick={(e) => {
                  stop(e)
                  launch()
                }}
                onDoubleClick={stop}
              >
                <Icon name="download" size={12} />
                Installer
              </button>
            ) : (
              <>
                <StateBadge game={game} className="lib-card-corner" />
                <button
                  type="button"
                  className={`lib-card-play ${p.className}`}
                  tabIndex={-1}
                  aria-label={p.ariaLabel}
                  title={p.title}
                  aria-disabled={p.inert || undefined}
                  onClick={(e) => {
                    stop(e)
                    launch()
                  }}
                  onDoubleClick={stop}
                >
                  <PlayLabel p={p} size={14} />
                </button>
              </>
            )}
            {!install && <FavButton game={game} onFavorite={onFavorite} className="lib-card-fav" size={15} />}
          </div>
          <div className="lib-card-glare" aria-hidden="true" />
          <div className="lib-card-ring fx-loop" aria-hidden="true" />
        </div>
      </div>
      <div className="lib-card-text">
        <h3 className="lib-card-title" title={name}>
          {name}
        </h3>
        <p className="lib-card-meta">
          <span className="lib-card-store">{KIND_LABEL[game.store]}</span>
          {line && <span>{line}</span>}
        </p>
      </div>
    </article>
  )
}

/** Ligne du mode Liste : vignette, titre, temps de jeu, dernière partie, lancements, état, favori, Jouer ou Installer. */
export function GameRow(props: GameItemProps): React.JSX.Element {
  const { game, onFavorite } = props
  const { p, cover, launch, handlers } = useGameItem(props)
  const name = cleanName(game.name)
  const install = !!game.notInstalled
  const meta = metaOf(game, p)
  // Sous le titre : le store, puis l'état (lancement, en jeu, pas installé) ; les chiffres ont leurs colonnes.
  const state = libraryMeta(p.state, p.launch?.status.route ?? null) ?? (game.running ? 'En jeu' : install ? 'Pas installé sur ce PC' : null)

  return (
    <article
      className={`lib-row ${itemClass(game, p)}`}
      data-launch={p.state === 'idle' ? undefined : p.state}
      tabIndex={0}
      aria-label={ariaOf(name, meta, game)}
      aria-busy={p.busy || undefined}
      {...handlers}
    >
      <div ref={cover} className="lib-row-thumb">
        <Cover key={game.id} game={game} showTitle={false} />
      </div>
      <span className="lib-row-words">
        <h3 className="lib-row-title" title={name}>
          {name}
        </h3>
        <span className="lib-row-sub">
          <span className="lib-row-store">{STORE_LONG[game.store]}</span>
          {state && <span className="lib-row-state">· {state}</span>}
        </span>
      </span>
      <span className="lib-row-num num">{game.playtime ? formatPlaytime(game.playtime) : '—'}</span>
      <span className="lib-row-num num">{game.lastPlayed ? capitalize(timeAgo(game.lastPlayed)) : '—'}</span>
      <span className="lib-row-num num lib-row-launches">{game.launches || '—'}</span>
      <span className="lib-row-badge">
        <StateBadge game={game} className="" />
      </span>
      {install ? <span /> : <FavButton game={game} onFavorite={onFavorite} className="lib-row-fav" size={16} />}
      <button
        type="button"
        className={`lib-row-play ${install ? 'is-install' : p.className}`}
        tabIndex={-1}
        aria-label={install ? `Installer ${name} avec Steam` : p.ariaLabel}
        title={install ? 'Installer avec Steam' : p.title}
        aria-disabled={p.inert || undefined}
        onClick={(e) => {
          stop(e)
          launch()
        }}
        onDoubleClick={stop}
      >
        {install ? (
          <>
            <Icon name="download" size={14} />
            <span>Installer</span>
          </>
        ) : (
          <PlayLabel p={p} size={14} />
        )}
      </button>
    </article>
  )
}

/** En-tête des colonnes du mode Liste (visuel : chaque ligne porte déjà son nom complet). */
export function GameRowHead(): React.JSX.Element {
  return (
    <div className="lib-row-head" aria-hidden="true">
      <span />
      <span>Jeu</span>
      <span>Temps de jeu</span>
      <span>Dernière partie</span>
      <span className="lib-row-launches">Lancements</span>
      <span />
      <span />
      <span />
    </div>
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
