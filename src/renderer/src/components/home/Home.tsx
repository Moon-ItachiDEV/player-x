// Accueil, direction « Écran console » (comme Player X Test) : le jeu choisi en plein écran, son nom en très grand,
// Jouer ; à droite, les amis en ligne ; en bas, « Tes jeux » en jaquettes debout. La molette, les flèches ← → ou un clic
// sur une jaquette changent de jeu ; Entrée joue ; clic droit (ou clic sur le jeu déjà choisi) ouvre sa fiche.
// Rien d'autre à l'écran : le bilan de partie s'ouvre déjà tout seul à la fin d'un match, les patchs sont sur les jaquettes.
import { useEffect, useMemo, useRef, useState } from 'react'
import { hasPlayed, PLAYED_SOURCE } from '@shared/played'
import { cleanName, formatDate, formatPlaytime, plural, timeAgo } from '@shared/text'
import type { Friend, Game, Store } from '@shared/types'
import type { HomeProps } from '../../contracts'
import { PlayLabel } from '../../launch/PlayLabel'
import { usePlayState } from '../../launch/usePlayState'
import { motionReduced, setArtBase, setMorphSource } from '../../motion'
import { FavStar, usePop } from '../library/GameCard'
import { NoGames } from '../library/NoGames'
import { NewsBadge } from '../news/NewsBadge'
import { Avatar } from '../ui/Avatar'
import { Cover, generatedBackground } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { LiveBadge } from '../ui/LiveBadge'
import { KIND_LABEL, STORE_LONG } from '../ui/StoreTag'
import { playersLabel, playersOf, whoIsAround } from './around'
import { pickHero, shelfList } from './pick'
import { useWheelStep } from './rowScroll'
import './home.css'

export type { HomeProps }

const STORES: Store[] = ['steam', 'epic', 'ea']

export function Home(props: HomeProps): React.JSX.Element {
  const { games, friends, scanning, report, onLaunch, onOpen, onFavorite, onRescan, onShowLibrary, onShowFriends } = props
  // Jeu choisi à la main (molette, flèches, clic) ; sinon le choix automatique (en cours, dernière partie…).
  const [targetId, setTargetId] = useState<string | null>(null)
  const auto = useMemo(() => pickHero(games), [games])
  const order = useMemo(() => shelfList(games, 'all'), [games])
  const hero = (targetId && games.find((g) => g.id === targetId)) || auto
  const heroId = hero?.id
  const [dir, setDir] = useState<'next' | 'prev' | null>(null)
  const page = useRef<HTMLDivElement>(null)

  // Un jeu qui démarre passe à l'écran, même après un choix à la main.
  const runningId = auto?.running ? auto.id : null
  useEffect(() => {
    if (runningId) setTargetId(null)
  }, [runningId])

  const pick = (g: Game, d: 'next' | 'prev' | null): void => {
    if (g.id === heroId) return
    setDir(d)
    setTargetId(g.id)
  }
  const step = (d: 1 | -1): void => {
    if (!heroId || order.length < 2) return
    const i = order.findIndex((g) => g.id === heroId)
    const next = i < 0 ? order[0] : order[(i + d + order.length) % order.length]
    pick(next, d > 0 ? 'next' : 'prev')
  }

  // Molette n'importe où sur l'accueil : un cran = un jeu.
  useWheelStep(page, step)

  // Clavier : ← → changent de jeu, Entrée joue (pas quand on écrit, ni dans un menu ou une fenêtre).
  const stepRef = useRef(step)
  stepRef.current = step
  const heroRef = useRef(hero)
  heroRef.current = hero
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      const t = e.target instanceof Element ? e.target : null
      if (t?.closest('input, textarea, select, [contenteditable], [role="dialog"], [role="menu"]')) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        stepRef.current(e.key === 'ArrowRight' ? 1 : -1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const around = useMemo(() => (hero ? whoIsAround(hero, friends) : null), [hero, friends])

  if (games.length === 0 && scanning) return <HomeSkeleton />
  if (games.length === 0 || !hero) {
    return (
      <div className="page home">
        <NoGames report={report} onRescan={onRescan} />
      </div>
    )
  }

  return (
    <div ref={page} className="hc">
      <HeroArt game={hero} dir={dir} />
      <div className="hc-in">
        <HeroText key={hero.id} game={hero} players={playersOf(hero, friends)} dir={dir} onLaunch={onLaunch} onOpen={onOpen} onFavorite={onFavorite} />
        {around && <Squad around={around.people} here={around.here} onShowFriends={onShowFriends} />}
      </div>
      <Shelf
        games={order}
        heroId={hero.id}
        onPick={(g) => pick(g, null)}
        onLaunch={onLaunch}
        onOpen={onOpen}
        onShowLibrary={onShowLibrary}
      />
    </div>
  )
}

/* ---------- l'image du jeu, en plein écran ---------- */

/** Le visuel du jeu sur tout l'écran (sous la barre du haut) ; le nouveau se pose en fondu sur l'ancien. */
function HeroArt({ game, dir }: { game: Game; dir: 'next' | 'prev' | null }): React.JSX.Element {
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set())
  const url = artOf(game, failed)
  const last = useRef(game)
  const [prev, setPrev] = useState<Game | null>(null)

  // Changement de jeu : l'ancien visuel reste dessous le temps du fondu.
  useEffect(() => {
    if (last.current.id === game.id) return
    setPrev(last.current)
    last.current = game
    const t = setTimeout(() => setPrev(null), 600)
    return () => clearTimeout(t)
  }, [game])

  // Fond de la page aux couleurs du jeu (Ambient) : il déborde sous la barre et aux bords.
  useEffect(() => {
    setArtBase(url)
    return () => setArtBase(null)
  }, [url])

  const fail = (u: string): void => setFailed((f) => new Set(f).add(u))
  return (
    <div className="hc-art" data-dir={dir ?? undefined} aria-hidden="true">
      {prev && prev.id !== game.id && <ArtLayer key={`prev-${prev.id}`} game={prev} url={artOf(prev, failed)} still onFail={fail} />}
      <ArtLayer key={game.id} game={game} url={url} onFail={fail} />
      <div className="hc-scrim" />
    </div>
  )
}

/** La bannière du jeu, sinon sa jaquette (floutée). */
function artOf(game: Game, failed: ReadonlySet<string>): string | undefined {
  return game.heroUrl && !failed.has(game.heroUrl) ? game.heroUrl : game.coverUrl
}

function ArtLayer({ game, url, still, onFail }: { game: Game; url?: string; still?: boolean; onFail: (u: string) => void }): React.JSX.Element {
  const [loaded, setLoaded] = useState(false)
  const blur = !!url && url !== game.heroUrl
  return (
    <div className={`hc-art-layer ${still ? 'is-still' : ''}`} style={{ background: generatedBackground(game.name) }}>
      {url && (
        <img
          className={`hc-img ${blur ? 'is-blur' : ''} ${loaded || still ? 'is-loaded' : ''}`}
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => onFail(url)}
        />
      )}
    </div>
  )
}

/* ---------- texte et actions du jeu ---------- */

interface HeroTextProps {
  game: Game
  /** Amis et membres du serveur qui jouent à ce jeu. */
  players: Friend[]
  dir: 'next' | 'prev' | null
  onLaunch: HomeProps['onLaunch']
  onOpen: (g: Game) => void
  onFavorite: (g: Game) => void
}

function HeroText({ game, players, dir, onLaunch, onOpen, onFavorite }: HeroTextProps): React.JSX.Element {
  const p = usePlayState(game, onLaunch)
  const [pop, firePop] = usePop()
  const play = useRef<HTMLButtonElement>(null)
  const name = cleanName(game.name)
  const fav = !!game.favorite
  const src = game.lastPlayedSource

  // Entrée joue le jeu affiché (hors champ de texte, menu ou fenêtre).
  const activate = useRef(p.activate)
  activate.current = p.activate
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' || e.defaultPrevented || e.repeat) return
      const t = e.target instanceof Element ? e.target : null
      // Un bouton qui a le focus garde sa propre action (Entrée = clic).
      if (t && t !== document.body && t.closest('button, a, input, textarea, select, [contenteditable], [role="dialog"], [role="menu"], [role="listbox"]')) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      e.preventDefault()
      activate.current(play.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const kicker = game.running ? null : game.lastPlayed ? `Reprendre · joué ${timeAgo(game.lastPlayed)}` : hasPlayed(game) ? 'Dans ta bibliothèque' : 'Pas encore lancé'

  return (
    <section className="hc-text" data-dir={dir ?? undefined} aria-label={name}>
      <p className="hc-kicker">
        {game.running ? <LiveBadge /> : <span title={game.lastPlayed ? `${formatDate(game.lastPlayed)}${src ? `, ${PLAYED_SOURCE[src]}` : ''}` : undefined}>{kicker}</span>}
        {players.length > 0 && (
          <span className="hc-kicker-live" title={players.map((f) => f.name).join(', ')}>
            <Icon name="play" size={10} />
            {playersLabel(players)}
          </span>
        )}
      </p>
      <h1 className="hc-title" title={name}>
        {name}
      </h1>
      <p className="hc-meta num">
        <span>{STORE_LONG[game.store]}</span>
        {!!game.playtime && <span>{formatPlaytime(game.playtime)} de jeu</span>}
        {game.notInstalled ? <span>Pas installé</span> : <span>Installé</span>}
        {game.newPatch && <NewsBadge patch={game.newPatch} className="hc-news" />}
      </p>
      <div className="hc-actions">
        <button
          ref={play}
          className={`btn btn-primary btn-play hc-play ${p.className}`}
          data-magnetic={p.state === 'idle' ? '' : undefined}
          aria-disabled={p.inert || undefined}
          aria-busy={p.busy || undefined}
          aria-label={p.ariaLabel}
          title={p.state === 'idle' ? 'Jouer (Entrée)' : p.title}
          onClick={() => p.activate(play.current)}
        >
          {/* Bouton « Aura » du site (verre sombre, bordure braise qui tourne, halo) : seulement au repos. */}
          <span className="hc-aura-fill" aria-hidden="true" />
          <PlayLabel p={p} size={20} />
        </button>
        <button
          className="btn hc-glass"
          onClick={(e) => {
            setMorphSource(e.currentTarget.closest('.hc')?.querySelector('.hc-art-layer') ?? null, game.id, 'art')
            onOpen(game)
          }}
        >
          Détails du jeu
        </button>
        <button
          className={`btn hc-glass hc-fav ${fav ? 'is-on' : ''}`}
          aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          title={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={() => {
            firePop()
            onFavorite(game)
          }}
        >
          <FavStar on={fav} pop={pop} size={20} />
        </button>
      </div>
    </section>
  )
}

/* ---------- amis, en colonne à droite ---------- */

const SQUAD_MAX = 5

/** Amis en jeu ou en ligne (ceux de ce jeu d'abord) : avatar, pseudo et ce qu'ils font. Clic : page Amis. */
function Squad({ around, here, onShowFriends }: { around: Friend[]; here: ReadonlySet<string>; onShowFriends: () => void }): React.JSX.Element {
  const shown = around.slice(0, SQUAD_MAX)
  const more = around.length - shown.length
  const inGame = around.filter((f) => f.status === 'in-game').length
  return (
    <button className="hc-squad" onClick={onShowFriends} aria-label={`Amis : ${plural(around.length, 'en ligne', 'en ligne')}. Voir tes amis`}>
      <span className="hc-squad-head">
        Amis
        <span className="hc-squad-count num">{inGame ? `${inGame} en jeu` : `${around.length} en ligne`}</span>
      </span>
      <ul className="hc-squad-list">
        {shown.map((f) => (
          <li key={f.id} className={`hc-mate ${here.has(f.id) ? 'is-here' : ''}`}>
            <span className="hc-mate-text">
              <span className="hc-mate-name">{f.name}</span>
              <span className={`hc-mate-sub ${f.status === 'in-game' ? 'is-live' : ''}`}>
                {f.status === 'in-game' && f.game ? f.game : f.status === 'away' ? 'Absent' : `En ligne · ${KIND_LABEL[f.platform]}`}
              </span>
            </span>
            <Avatar name={f.name} url={f.avatarUrl} size={40} status={f.status} />
          </li>
        ))}
      </ul>
      {more > 0 && <span className="hc-squad-more num">+ {more}</span>}
    </button>
  )
}

/* ---------- « Tes jeux », en bas ---------- */

interface ShelfProps {
  games: Game[]
  heroId: string
  onPick: (g: Game) => void
  onLaunch: HomeProps['onLaunch']
  onOpen: (g: Game) => void
  onShowLibrary: () => void
}

/** Les jeux en jaquettes debout (une fois chacun, sans copies aux bords). Le jeu affiché est agrandi et cerclé de blanc. */
function Shelf({ games, heroId, onPick, onOpen, onShowLibrary }: ShelfProps): React.JSX.Element {
  const track = useRef<HTMLDivElement>(null)
  const counts = STORES.map((s) => ({ s, n: games.filter((g) => g.store === s).length })).filter((c) => c.n > 0)

  // Le jeu affiché reste dans la partie visible de la rangée, sans faire défiler la page.
  useEffect(() => {
    const el = track.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(heroId)}"]`)
    const box = track.current
    if (!el || !box) return
    const left = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2
    box.scrollTo({ left: Math.max(0, left), behavior: motionReduced() ? 'auto' : 'smooth' })
  }, [heroId])

  return (
    <section className="hc-shelf" aria-labelledby="hc-shelf-h">
      <header className="hc-shelf-head">
        <h2 id="hc-shelf-h" className="hc-shelf-title">
          Tes jeux
        </h2>
        <span className="hc-shelf-meta num">
          {plural(games.length, 'jeu', 'jeux')}
          {counts.length > 1 && counts.map((c) => ` · ${STORE_LONG[c.s]} ${c.n}`).join('')}
        </span>
        <button className="link-btn hc-shelf-all" onClick={onShowLibrary}>
          Toute la bibliothèque
        </button>
      </header>
      <div ref={track} className="hc-track" role="listbox" aria-label="Tes jeux" aria-orientation="horizontal">
        {games.map((g) => {
          const on = g.id === heroId
          const name = cleanName(g.name)
          return (
            <button
              key={g.id}
              data-id={g.id}
              role="option"
              aria-selected={on}
              className={`hc-cover ${on ? 'is-on' : ''} ${g.running ? 'is-live' : ''}`}
              title={on ? `${name} · clic : fiche du jeu` : name}
              onClick={(e) => {
                if (on) {
                  setMorphSource(e.currentTarget, g.id, 'cover')
                  onOpen(g)
                } else onPick(g)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                setMorphSource(e.currentTarget, g.id, 'cover')
                onOpen(g)
              }}
            >
              <Cover game={g} variant="portrait" />
              {g.favorite && (
                <span className="hc-cover-star" aria-hidden="true">
                  <Icon name="star" size={13} filled />
                </span>
              )}
              {g.newPatch && <span className="hc-cover-patch" aria-hidden="true" />}
              <span className="sr-only">
                {name}
                {g.running ? ', en cours' : ''}
                {g.newPatch ? ', nouveau patch' : ''}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function HomeSkeleton(): React.JSX.Element {
  return (
    <div className="hc" aria-busy="true">
      <span className="sr-only">Recherche des jeux installés…</span>
      <div className="hc-in" aria-hidden="true">
        <div className="hc-text">
          <span className="skel hc-skel-kicker" />
          <span className="skel hc-skel-title" />
          <span className="skel hc-skel-meta" />
        </div>
      </div>
      <div className="hc-shelf" aria-hidden="true">
        <span className="skel hc-skel-h" />
        <div className="hc-track">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="hc-cover skel" />
          ))}
        </div>
      </div>
    </div>
  )
}
