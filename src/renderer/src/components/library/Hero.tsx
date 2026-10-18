import { useEffect, useMemo, useRef, useState } from 'react'
import { cleanName, norm, plural, timeAgo } from '@shared/text'
import type { Friend, Game } from '@shared/types'
import { follow, fxOn, setArtBase } from '../../motion'
import { Avatar } from '../ui/Avatar'
import { generatedBackground } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { StoreTag } from '../ui/StoreTag'
import { FavStar, usePop } from './GameCard'
import './hero.css'

// Durée de vie de la couche sortante (fondu de 700 ms + marge).
const OUT_MS = 750

interface HeroProps {
  /** Jeux à la une (5 au plus) ; le premier est celui du héros simple. */
  games: Game[]
  friends: Friend[]
  launchingId: string | null
  onLaunch: (g: Game) => void
  onOpen: (g: Game) => void
  onFavorite: (g: Game) => void
}

type ArtSet = ReadonlySet<string>

/** Image réellement affichée : bannière, sinon jaquette (floutée), sinon rien (dégradé généré). */
function resolveArt(game: Game, failed: ArtSet): { hero?: string; cover?: string } {
  const hero = game.heroUrl && !failed.has(game.heroUrl) ? game.heroUrl : undefined
  const cover = !hero && game.coverUrl && !failed.has(game.coverUrl) ? game.coverUrl : undefined
  return { hero, cover }
}

/**
 * Jeu à la une, en plein cadre : le visuel se fond dans la page. Avec plusieurs jeux, carrousel
 * (défilement piloté par la barre de progression en CSS, en pause au survol, au focus clavier, hors écran).
 */
export function Hero({ games, friends, launchingId, onLaunch, onOpen, onFavorite }: HeroProps): React.JSX.Element | null {
  const root = useRef<HTMLElement>(null)
  const dots = useRef<(HTMLButtonElement | null)[]>([])
  const outTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [currentId, setCurrentId] = useState(() => games[0]?.id ?? '')
  const [outgoing, setOutgoing] = useState<Game | null>(null)
  const [paused, setPaused] = useState(false)
  const [offscreen, setOffscreen] = useState(false)
  const [failed, setFailed] = useState<ArtSet>(new Set())
  const [loaded, setLoaded] = useState<ArtSet>(new Set())
  const fail = (u: string): void => setFailed((prev) => new Set(prev).add(u))
  const done = (u: string): void => setLoaded((prev) => new Set(prev).add(u))

  const n = games.length
  const i = Math.max(
    0,
    games.findIndex((g) => g.id === currentId)
  )
  const game = games[i] as Game | undefined
  const art = game ? resolveArt(game, failed) : {}
  const shownUrl = art.hero ?? art.cover ?? null
  const poster = art.cover

  const gameName = game?.name ?? ''
  const players = useMemo(() => {
    const key = norm(gameName)
    return friends.filter((f) => f.status === 'in-game' && !!f.game && norm(f.game) === key)
  }, [friends, gameName])

  // Fond de la page aux couleurs du jeu affiché.
  useEffect(() => setArtBase(shownUrl), [shownUrl])
  useEffect(
    () => () => {
      setArtBase(null)
      clearTimeout(outTimer.current)
    },
    []
  )

  // Bannières préchargées une fois, au montage : le fondu du carrousel ne montre pas une image à moitié chargée.
  const firstGames = useRef(games)
  useEffect(() => {
    for (const g of firstGames.current) if (g.heroUrl) new Image().src = g.heroUrl
  }, [])

  // Hors écran (35 %) : le défilement et la dérive se mettent en pause.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1]
        if (e) setOffscreen(e.intersectionRatio < 0.35)
      },
      { root: el.closest('.content'), threshold: 0.35 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Parallaxe au pointeur : --hx/--hy (-1..1) sur .hero, lissés.
  useEffect(() => {
    const el = root.current
    if (!el) return
    let rect: DOMRect | null = null
    let active = false
    const f = follow(
      (x, y) => {
        el.style.setProperty('--hx', x.toFixed(4))
        el.style.setProperty('--hy', y.toFixed(4))
      },
      { rate: 0.08 }
    )
    const clamp = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v)
    const stale = (): void => {
      rect = null
    }
    const move = (e: PointerEvent): void => {
      if (!active) return
      rect ??= el.getBoundingClientRect()
      f.set(clamp(((e.clientX - rect.left) / rect.width) * 2 - 1), clamp(((e.clientY - rect.top) / rect.height) * 2 - 1))
    }
    const enter = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse' || !fxOn()) return
      active = true
      rect = el.getBoundingClientRect()
      window.addEventListener('scroll', stale, { capture: true, passive: true })
      move(e)
    }
    const leave = (): void => {
      if (!active) return
      active = false
      window.removeEventListener('scroll', stale, true)
      f.release()
    }
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      leave()
      f.cancel()
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [])

  if (!game) return null

  const carousel = n > 1
  const name = cleanName(game.name)
  const kicker = i === 0 ? (game.lastPlayed ? 'Reprendre' : 'À la une') : game.favorite ? 'Favori' : 'Joué récemment'
  const next = games[(i + 1) % n]

  const go = (id: string): void => {
    if (id === game.id) return
    setOutgoing(game)
    setCurrentId(id)
    clearTimeout(outTimer.current)
    outTimer.current = setTimeout(() => setOutgoing(null), OUT_MS)
  }
  // Choix manuel : le défilement s'arrête.
  const pick = (id: string): void => {
    setPaused(true)
    go(id)
  }
  const onDotKey = (e: React.KeyboardEvent, k: number): void => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const t = (k + (e.key === 'ArrowRight' ? 1 : -1) + n) % n
    pick(games[t].id)
    dots.current[t]?.focus()
  }

  return (
    <section
      ref={root}
      className={`hero ${carousel ? 'is-carousel' : ''} ${paused ? 'is-paused' : ''} ${offscreen ? 'is-offscreen' : ''} ${poster ? 'has-poster' : ''}`}
      aria-roledescription={carousel ? 'carrousel' : undefined}
      aria-label={carousel ? 'Jeux à la une' : `${kicker} : ${name}`}
    >
      <div className="hero-stage" aria-hidden="true">
        {outgoing && outgoing.id !== game.id && (
          <HeroArt key={outgoing.id} game={outgoing} state="out" failed={failed} loaded={loaded} onFail={fail} onLoad={done} />
        )}
        <HeroArt key={game.id} game={game} state="in" failed={failed} loaded={loaded} onFail={fail} onLoad={done} />
      </div>
      <div className="hero-scrim" aria-hidden="true" />
      {poster && (
        <img
          key={poster}
          className={`hero-poster ${loaded.has(poster) ? 'is-loaded' : ''}`}
          src={poster}
          alt=""
          draggable={false}
          onLoad={() => done(poster)}
          onError={() => fail(poster)}
        />
      )}

      <HeroBody
        key={game.id}
        game={game}
        kicker={kicker}
        slide={carousel ? `${i + 1} sur ${n} : ${name}` : undefined}
        launching={launchingId === game.id}
        onLaunch={onLaunch}
        onOpen={onOpen}
        onFavorite={onFavorite}
      />

      {carousel && (
        <div className="hero-dots" role="group" aria-label="Choisir un jeu à la une">
          {games.map((g, k) => {
            const label = `Afficher ${cleanName(g.name)}`
            const active = k === i
            return (
              <button
                key={g.id}
                ref={(el) => {
                  dots.current[k] = el
                }}
                className="hero-dot"
                aria-label={label}
                title={label}
                aria-current={active ? 'true' : undefined}
                onClick={() => pick(g.id)}
                onKeyDown={(e) => onDotKey(e, k)}
              >
                <span className="hero-dot-bar">
                  {active && (
                    <span
                      key={game.id}
                      className="hero-dot-fill fx-loop"
                      onAnimationEnd={(e) => {
                        if (e.animationName === 'hero-progress' && fxOn() && !paused) go(next.id)
                      }}
                    />
                  )}
                </span>
              </button>
            )
          })}
          <button
            className="hero-pause"
            aria-label={paused ? 'Reprendre le défilement' : 'Mettre en pause le défilement'}
            title={paused ? 'Reprendre le défilement' : 'Mettre en pause le défilement'}
            onClick={() => setPaused((p) => !p)}
          >
            <Icon name={paused ? 'play' : 'pause'} size={14} />
          </button>
        </div>
      )}

      {players.length > 0 && <FriendsChip players={players} />}
    </section>
  )
}

interface ArtProps {
  game: Game
  state: 'in' | 'out'
  failed: ArtSet
  loaded: ArtSet
  onFail: (u: string) => void
  onLoad: (u: string) => void
}

/** Une couche du fond : bannière (dérive lente), sinon jaquette floutée, sinon le dégradé généré seul. */
function HeroArt({ game, state, failed, loaded, onFail, onLoad }: ArtProps): React.JSX.Element {
  const { hero, cover } = resolveArt(game, failed)
  const url = hero ?? cover
  return (
    <div className={`hero-art is-${state}`} style={{ background: generatedBackground(game.name) }}>
      {url && (
        <img
          key={url}
          // Pas de dérive sur la jaquette floutée : un flou qui bouge se recalcule à chaque image.
          className={`hero-art-img ${hero ? 'fx-loop' : 'hero-art-blur'} ${loaded.has(url) ? 'is-loaded' : ''}`}
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => onLoad(url)}
          onError={() => onFail(url)}
        />
      )}
    </div>
  )
}

interface BodyProps {
  game: Game
  kicker: string
  /** « 2 sur 5 : Hades » en carrousel. */
  slide?: string
  launching: boolean
  onLaunch: (g: Game) => void
  onOpen: (g: Game) => void
  onFavorite: (g: Game) => void
}

/** Texte et actions d'une diapositive ; remontée à chaque changement de jeu (entrée du texte, étoile remise à zéro). */
function HeroBody({ game, kicker, slide, launching, onLaunch, onOpen, onFavorite }: BodyProps): React.JSX.Element {
  const [pop, firePop] = usePop()
  const name = cleanName(game.name)
  const fav = !!game.favorite
  return (
    <div className="hero-body" role={slide ? 'group' : undefined} aria-roledescription={slide ? 'diapositive' : undefined} aria-label={slide}>
      <p className="overline hero-kicker">{kicker}</p>
      <h2 className="hero-title">{name}</h2>
      <div className="hero-meta">
        <StoreTag kind={game.store} long />
        <span>{game.lastPlayed ? `Lancé ${timeAgo(game.lastPlayed)}` : 'Jamais lancé depuis Player X'}</span>
        {!!game.launches && <span className="num">{plural(game.launches, 'lancement', 'lancements')}</span>}
      </div>
      <div className="hero-actions">
        <button className={`btn btn-primary btn-play ${launching ? 'is-launching' : ''}`} data-magnetic="" disabled={launching} onClick={() => onLaunch(game)}>
          {launching ? (
            <>
              <span className="spinner" />
              Lancement…
            </>
          ) : (
            <>
              <Icon name="play" size={18} />
              Jouer
            </>
          )}
        </button>
        <button
          className={`hero-glass-btn ${fav ? 'is-on' : ''}`}
          aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          title={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={() => {
            firePop()
            onFavorite(game)
          }}
        >
          <FavStar on={fav} pop={pop} size={20} />
        </button>
        <button className="hero-glass-btn" aria-label="Détails" title="Détails" onClick={() => onOpen(game)}>
          <Icon name="info" size={20} />
        </button>
      </div>
    </div>
  )
}

/** « 2 amis y jouent », « 1 ami et 1 membre Discord y jouent » avec leurs avatars. Les membres d'un serveur Discord ne sont pas des amis. */
function FriendsChip({ players }: { players: Friend[] }): React.JSX.Element {
  const n = players.length
  const pals = players.filter((p) => p.platform !== 'discord').length
  const members = n - pals
  return (
    <div className="hero-friends" title={players.map((p) => p.name).join(', ')}>
      <span className="hero-avatars">
        {players.slice(0, 3).map((p) => (
          <Avatar key={p.id} name={p.name} url={p.avatarUrl} size={24} />
        ))}
      </span>
      <span className="hero-friends-dot" aria-hidden="true" />
      <span>
        {pals > 0 && (
          <>
            <span className="num">{pals}</span> {pals > 1 ? 'amis' : 'ami'}
          </>
        )}
        {pals > 0 && members > 0 && ' et '}
        {members > 0 && (
          <>
            <span className="num">{members}</span> {members > 1 ? 'membres Discord' : 'membre Discord'}
          </>
        )}
        {n > 1 ? ' y jouent' : ' y joue'}
      </span>
    </div>
  )
}

/** Héros fantôme pendant le premier scan (même cadre plein écran que le héros). */
export function HeroSkeleton(): React.JSX.Element {
  return (
    <div className="hero-skel skel" aria-hidden="true">
      <div className="hero-skel-bars">
        <span style={{ width: 120, height: 10 }} />
        <span style={{ width: 320, height: 28 }} />
        <span style={{ width: 180, height: 12 }} />
      </div>
    </div>
  )
}
