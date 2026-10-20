import { useEffect, useMemo, useRef, useState } from 'react'
import { capitalize, cleanName, formatPlaytime, norm, plural, timeAgo } from '@shared/text'
import type { Friend, Game } from '@shared/types'
import type { HomeProps, LaunchFn } from '../../contracts'
import { PlayLabel } from '../../launch/PlayLabel'
import { usePlayState } from '../../launch/usePlayState'
import { follow, fxOn, motionReduced, setArtBase, setArtFocus, setMorphSource } from '../../motion'
import { FavStar, usePop } from '../library/GameCard'
import { NoGames } from '../library/NoGames'
import { Avatar } from '../ui/Avatar'
import { Cover, generatedBackground } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { LiveBadge } from '../ui/LiveBadge'
import { KIND_LABEL, StoreTag } from '../ui/StoreTag'
import './home.css'

export type { HomeProps }

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
const byName = (a: Game, b: Game): number => collator.compare(cleanName(a.name), cleanName(b.name))
const byRecent = (a: Game, b: Game): number => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0)
const hasArt = (g: Game): boolean => !!(g.heroUrl || g.coverUrl)

/** Jeu à la une : celui qui tourne, sinon le dernier lancé, sinon un favori (puis un jeu) avec une image. */
function pickHero(games: Game[]): Game | null {
  // Plusieurs jeux en cours : le dernier démarré.
  let running: Game | null = null
  for (const g of games) if (g.running && (!running || (g.runningSince ?? 0) > (running.runningSince ?? 0))) running = g
  if (running) return running
  let recent: Game | null = null
  for (const g of games) if (g.lastPlayed && (!recent || g.lastPlayed > (recent.lastPlayed ?? 0))) recent = g
  return recent ?? games.find((g) => g.favorite && hasArt(g)) ?? games.find(hasArt) ?? games[0] ?? null
}

const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/** « Lancé aujourd'hui · 20:10 », « Lancé hier · 18:05 », « Lancé le 12 oct. · 14:00 » */
export function launchedOn(ts: number, now = Date.now()): string {
  const d = new Date(ts)
  const day =
    d.toDateString() === new Date(now).toDateString()
      ? "aujourd'hui"
      : d.toDateString() === new Date(now - 86_400_000).toDateString()
        ? 'hier'
        : `le ${dayFmt.format(d)}`
  return `Lancé ${day} · ${timeFmt.format(d)}`
}

/** Amis (et membres Discord) en train de jouer à ce jeu. */
function playersOf(game: Game, friends: Friend[]): Friend[] {
  const key = norm(game.name)
  return friends.filter((f) => f.status === 'in-game' && !!f.game && norm(f.game) === key)
}

/** « 2 amis y jouent », « 1 ami et 1 membre Discord y jouent ». Les membres d'un serveur Discord ne sont pas des amis. */
export function playersLabel(players: Friend[]): string {
  const n = players.length
  const pals = players.filter((p) => p.platform !== 'discord').length
  const members = n - pals
  const parts = [pals ? plural(pals, 'ami', 'amis') : '', members ? plural(members, 'membre Discord', 'membres Discord') : ''].filter(Boolean)
  return `${parts.join(' et ')} ${n > 1 ? 'y jouent' : 'y joue'}`
}

export function Home(props: HomeProps): React.JSX.Element {
  const { games, friends, scanning, report, demo, onLaunch, onOpen, onFavorite, onRescan, onEnableDemo, onShowLibrary } = props
  const hero = useMemo(() => pickHero(games), [games])
  const heroId = hero?.id

  // « À reprendre » : les derniers lancés ; sans historique, les favoris puis les jeux qui ont une image.
  const { cards, resumed } = useMemo(() => {
    const rest = games.filter((g) => g.id !== heroId)
    const played = rest.filter((g) => g.lastPlayed).sort(byRecent)
    if (played.length) return { cards: played.slice(0, 12), resumed: true }
    const favs = rest.filter((g) => g.favorite).sort(byName)
    const others = rest.filter((g) => !g.favorite && hasArt(g)).sort(byName)
    return { cards: [...favs, ...others].slice(0, 12), resumed: false }
  }, [games, heroId])

  if (games.length === 0 && scanning) return <HomeSkeleton />

  if (games.length === 0 || !hero) {
    return (
      <div className="page home">
        <NoGames report={report} demo={demo} onRescan={onRescan} onEnableDemo={onEnableDemo} />
      </div>
    )
  }

  return (
    <div className="page home">
      <HomeHero
        key={hero.id}
        game={hero}
        players={playersOf(hero, friends)}
        onLaunch={onLaunch}
        onOpen={onOpen}
        onFavorite={onFavorite}
      />
      {cards.length > 0 && (
        <ResumeRow
          title={resumed ? 'À reprendre' : 'Dans ta bibliothèque'}
          sub={resumed ? 'Tes derniers jeux lancés' : 'Lance un jeu : il apparaîtra ici'}
          games={cards}
          friends={friends}
          onLaunch={onLaunch}
          onOpen={onOpen}
          onShowLibrary={onShowLibrary}
        />
      )}
    </div>
  )
}

interface HeroProps {
  game: Game
  players: Friend[]
  onLaunch: LaunchFn
  onOpen: (g: Game) => void
  onFavorite: (g: Game) => void
}

/** Grande carte du jeu à la une : visuel, jaquette, titre, actions et bandeau de chiffres en verre. */
function HomeHero({ game, players, onLaunch, onOpen, onFavorite }: HeroProps): React.JSX.Element {
  const root = useRef<HTMLElement>(null)
  const poster = useRef<HTMLButtonElement>(null)
  const p = usePlayState(game, onLaunch)
  const art = useRef<HTMLDivElement>(null)
  const [heroFailed, setHeroFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [pop, firePop] = usePop()
  const name = cleanName(game.name)
  const fav = !!game.favorite
  const heroUrl = game.heroUrl && !heroFailed ? game.heroUrl : undefined
  // Sans bannière : la jaquette, floutée, fait le fond.
  const backUrl = heroUrl ?? game.coverUrl

  // Fond de la page aux couleurs du jeu à la une.
  useEffect(() => {
    setArtBase(backUrl)
    return () => setArtBase(null)
  }, [backUrl])

  // Parallaxe au pointeur : --hx/--hy (-1..1) sur la carte, lissés.
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

  const open = (): void => {
    setMorphSource(art.current, game.id, 'art')
    onOpen(game)
  }

  const sub = game.running ? 'Partie en cours' : game.lastPlayed ? "Reprends là où tu t'es arrêté" : 'Jamais lancé depuis Player X'

  return (
    <section ref={root} className={`hh ${game.running ? 'is-live' : ''}`} aria-label={`À la une : ${name}`}>
      <div ref={art} className="hh-art" aria-hidden="true" style={{ background: generatedBackground(game.name) }}>
        {backUrl && (
          <img
            key={backUrl}
            className={`hh-img ${heroUrl ? 'fx-loop' : 'hh-img-blur'} ${loaded ? 'is-loaded' : ''}`}
            src={backUrl}
            alt=""
            draggable={false}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => (heroUrl ? setHeroFailed(true) : undefined)}
          />
        )}
      </div>
      <div className="hh-scrim" aria-hidden="true" />

      <div className="hh-in">
        <button ref={poster} className="hh-poster" tabIndex={-1} aria-hidden="true" onClick={open}>
          <Cover game={game} />
        </button>
        <div className="hh-text">
          <div className="hh-chips">
            <StoreTag kind={game.store} long className="hh-store" />
            {fav && (
              <span className="hh-chip">
                <Icon name="star" size={12} filled />
                Favori
              </span>
            )}
            {game.running && <LiveBadge />}
          </div>
          <h1 className="hh-title" title={name}>
            {name}
          </h1>
          <p className="hh-sub">{sub}</p>
          <div className="hh-actions">
            <button
              className={`btn btn-primary btn-play ${p.className}`}
              data-magnetic={p.state === 'idle' ? '' : undefined}
              aria-disabled={p.inert || undefined}
              aria-busy={p.busy || undefined}
              aria-label={p.ariaLabel}
              title={p.state === 'idle' ? undefined : p.title}
              onClick={() => p.activate(poster.current)}
            >
              <PlayLabel p={p} size={18} />
            </button>
            <button className="btn btn-secondary btn-lg hh-sheet" onClick={open}>
              Fiche
            </button>
            <button
              className={`btn btn-secondary btn-lg hh-fav ${fav ? 'is-on' : ''}`}
              aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              title={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              onClick={() => {
                firePop()
                onFavorite(game)
              }}
            >
              <FavStar on={fav} pop={pop} size={18} />
            </button>
          </div>
        </div>
      </div>

      <dl className="hh-band">
        <div className="hh-k">
          <dt>Temps de jeu</dt>
          <dd className="num">{game.playtime ? formatPlaytime(game.playtime) : '—'}</dd>
        </div>
        <div className="hh-k">
          <dt>Lancements</dt>
          <dd className="num">{game.launches ?? 0}</dd>
        </div>
        <div className="hh-k">
          <dt>Dernier lancement</dt>
          <dd>{game.running ? 'En cours' : game.lastPlayed ? capitalize(timeAgo(game.lastPlayed)) : 'Jamais'}</dd>
        </div>
        {players.length > 0 && (
          <div className="hh-k hh-friends" title={players.map((p) => p.name).join(', ')}>
            <dt>{players.some((p) => p.platform !== 'discord') ? 'Amis en jeu' : 'Membres en jeu'}</dt>
            <dd>
              <span className="num">{players.length}</span>
              <span className="hh-stack" aria-hidden="true">
                {players.slice(0, 4).map((p) => (
                  <Avatar key={p.id} name={p.name} url={p.avatarUrl} size={28} />
                ))}
              </span>
              <span className="sr-only">{playersLabel(players)}</span>
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}

interface RowProps {
  title: string
  sub: string
  games: Game[]
  friends: Friend[]
  onLaunch: LaunchFn
  onOpen: (g: Game) => void
  onShowLibrary: () => void
}

/** Rangée de cartes défilante, avec boutons précédent / suivant. */
function ResumeRow({ title, sub, games, friends, onLaunch, onOpen, onShowLibrary }: RowProps): React.JSX.Element {
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
    el.scrollBy({ left: dir * el.clientWidth, behavior: motionReduced() ? 'auto' : 'smooth' })
  }

  return (
    <section className="hr" aria-labelledby="hr-title">
      <header className="hr-head">
        <div className="hr-titles">
          <h2 id="hr-title" className="h-section">
            {title}
          </h2>
          <p className="hr-sub">{sub}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onShowLibrary}>
          Toute la bibliothèque
          <Icon name="chevron-right" size={14} />
        </button>
        <button className="btn btn-secondary btn-sm hr-nav" aria-label="Précédent" title="Précédent" disabled={!edges.start} onClick={() => scrollBy(-1)}>
          <Icon name="chevron-left" size={16} />
        </button>
        <button className="btn btn-secondary btn-sm hr-nav" aria-label="Suivant" title="Suivant" disabled={!edges.end} onClick={() => scrollBy(1)}>
          <Icon name="chevron-right" size={16} />
        </button>
      </header>
      <div ref={track} className="hr-track">
        {games.map((g) => (
          <ResumeCard key={g.id} game={g} players={playersOf(g, friends)} onLaunch={onLaunch} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

interface CardProps {
  game: Game
  players: Friend[]
  onLaunch: LaunchFn
  onOpen: (g: Game) => void
}

function ResumeCard({ game, players, onLaunch, onOpen }: CardProps): React.JSX.Element {
  const art = useRef<HTMLButtonElement>(null)
  const p = usePlayState(game, onLaunch)
  const lit = useRef(false)
  const name = cleanName(game.name)
  const image = game.heroUrl || game.coverUrl
  const badge = game.running ? 'En cours' : game.lastPlayed ? capitalize(timeAgo(game.lastPlayed)) : 'Jamais lancé'
  const meta = [game.launches ? plural(game.launches, 'lancement', 'lancements') : '', game.playtime ? formatPlaytime(game.playtime) : ''].filter(Boolean).join(' · ')

  // Fond de la page aux couleurs du jeu survolé ; rendu par cette carte seulement.
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
    setMorphSource(art.current, game.id, 'art')
    onOpen(game)
  }

  return (
    <article
      className={`rc ${game.running ? 'is-live' : ''}`}
      onPointerEnter={() => light(true)}
      onPointerLeave={() => light(false)}
      onFocus={() => light(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) light(false)
      }}
    >
      <button ref={art} className="rc-art" aria-label={`Fiche de ${name}`} title="Voir la fiche" onClick={open}>
        <Cover game={game} variant="landscape" showTitle={!image} />
        <span className={`rc-badge ${game.running ? 'is-live' : ''}`}>
          {!game.running && <Icon name="clock" size={13} />}
          {badge}
        </span>
        <StoreTag kind={game.store} long className="rc-store" />
        {game.running && <LiveBadge className="rc-live" />}
      </button>
      <div className="rc-body">
        <p className="rc-date">{game.lastPlayed ? launchedOn(game.lastPlayed) : KIND_LABEL[game.store]}</p>
        <h3 className="rc-name" title={name}>
          {name}
        </h3>
        <p className="rc-meta num">{meta || (game.favorite ? 'Favori' : 'Pas encore de temps de jeu')}</p>
        <div className="rc-actions">
          <button
            className={`btn btn-primary btn-sm rc-play ${p.className}`}
            aria-disabled={p.inert || undefined}
            aria-busy={p.busy || undefined}
            aria-label={p.ariaLabel}
            title={p.state === 'idle' ? undefined : p.title}
            onClick={() => p.activate(art.current)}
          >
            <PlayLabel p={p} size={13} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={open}>
            Fiche
          </button>
        </div>
      </div>
      <div className="rc-foot">
        {players.length > 0 ? (
          <>
            <span className="rc-stack" aria-hidden="true">
              {players.slice(0, 3).map((p) => (
                <Avatar key={p.id} name={p.name} url={p.avatarUrl} size={22} />
              ))}
            </span>
            <span className="rc-foot-live">{playersLabel(players)}</span>
          </>
        ) : (
          <>
            <span className="rc-empty-ava" aria-hidden="true" />
            <span>Aucun ami dessus en ce moment</span>
          </>
        )}
      </div>
    </article>
  )
}

function HomeSkeleton(): React.JSX.Element {
  return (
    <div className="page home" aria-busy="true">
      <span className="sr-only">Recherche des jeux installés…</span>
      <div className="hh hh-skel skel" aria-hidden="true" />
      <div className="hr-track" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rc rc-skel">
            <div className="skel rc-skel-art" />
            <div className="rc-body">
              <span className="skel" style={{ width: '40%', height: 9 }} />
              <span className="skel" style={{ width: '75%', height: 16 }} />
              <span className="skel" style={{ width: '55%', height: 10 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
