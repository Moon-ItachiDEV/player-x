import { useEffect, useMemo, useRef, useState } from 'react'
import { hasPlayed, PLAYED_SOURCE } from '@shared/played'
import { capitalize, cleanName, formatDate, formatPlaytime, plural, timeAgo } from '@shared/text'
import type { AchievementGame, Friend, Game } from '@shared/types'
import type { HomeProps, LaunchFn } from '../../contracts'
import { PlayLabel } from '../../launch/PlayLabel'
import { usePlayState } from '../../launch/usePlayState'
import { follow, fxOn, setArtBase, setMorphSource } from '../../motion'
import { useAchievementsOverview } from '../achievements/useAchievements'
import { FavStar, usePop } from '../library/GameCard'
import { NoGames } from '../library/NoGames'
import { NewsBadge } from '../news/NewsBadge'
import { Cover, generatedBackground } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { LiveBadge } from '../ui/LiveBadge'
import { KIND_LABEL, StoreTag } from '../ui/StoreTag'
import { playersLabel, playersOf, whoIsAround } from './around'
import { HomeAchievements, HomeNews, useHomeNews } from './HomeBottom'
import { HomeShelf } from './HomeShelf'
import { LastMatchCard, OnlinePanel } from './HomeSide'
import { achievementRows, achievementsOf, pickHero, resumeList } from './pick'
import { useLastMatch } from './useLastMatch'
import './home.css'

export type { HomeProps }

export function Home(props: HomeProps): React.JSX.Element {
  const {
    games,
    friends,
    scanning,
    report,
    demo,
    news,
    onLaunch,
    onOpen,
    onFavorite,
    onRescan,
    onEnableDemo,
    onShowLibrary,
    onReadNews,
    onShowNews,
    onShowFriends,
    onShowTrophies
  } = props
  // Jeu mis à la une depuis « À reprendre » ; sinon le choix automatique (en cours, dernière partie…).
  const [targetId, setTargetId] = useState<string | null>(null)
  const auto = useMemo(() => pickHero(games), [games])
  const hero = (targetId && games.find((g) => g.id === targetId)) || auto
  const heroId = hero?.id

  // Un jeu qui démarre passe à la une, même après un choix à la main.
  const runningId = auto?.running ? auto.id : null
  useEffect(() => {
    if (runningId) setTargetId(null)
  }, [runningId])

  const { list: resume, resumed } = useMemo(() => resumeList(games, hero), [games, hero])
  const around = useMemo(() => (hero ? whoIsAround(hero, friends) : null), [hero, friends])
  const match = useLastMatch()
  const { data: overview } = useAchievementsOverview()
  const achRows = useMemo(() => achievementRows(overview), [overview])
  const heroAch = useMemo(() => (heroId ? achievementsOf(overview, heroId) : null), [overview, heroId])
  const newsItems = useHomeNews(games, news, demo)

  if (games.length === 0 && scanning) return <HomeSkeleton />

  if (games.length === 0 || !hero) {
    return (
      <div className="page home">
        <NoGames report={report} demo={demo} onRescan={onRescan} onEnableDemo={onEnableDemo} />
      </div>
    )
  }

  const side = !!match || !!around
  return (
    <div className="page home">
      <div className="hm-top">
        <HomeHero
          key={hero.id}
          game={hero}
          players={playersOf(hero, friends)}
          achievements={heroAch}
          resume={resume}
          resumeTitle={resumed ? 'À reprendre' : 'Dans ta bibliothèque'}
          onTarget={(g) => setTargetId(g.id)}
          news={news}
          onReadNews={onReadNews}
          onLaunch={onLaunch}
          onOpen={onOpen}
          onFavorite={onFavorite}
        />
        {side && (
          <div className="hm-side">
            {match && <LastMatchCard match={match} />}
            {around && <OnlinePanel around={around} tall={!match} onShowFriends={onShowFriends} />}
          </div>
        )}
      </div>
      <HomeShelf games={games} heroId={hero.id} onLaunch={onLaunch} onOpen={onOpen} onShowLibrary={onShowLibrary} />
      {(newsItems.length > 0 || achRows.length > 0) && (
        <div className="hm-bottom">
          {newsItems.length > 0 && <HomeNews items={newsItems} games={games} onRead={onReadNews} onShowAll={onShowNews} />}
          {achRows.length > 0 && <HomeAchievements rows={achRows} onShowTrophies={onShowTrophies} />}
        </div>
      )}
    </div>
  )
}

interface HeroProps {
  game: Game
  /** Amis et membres du serveur qui jouent à ce jeu. */
  players: Friend[]
  /** Succès Steam du jeu, s'ils sont relevés. */
  achievements: AchievementGame | null
  /** « À reprendre », le jeu à la une compris (ligne surlignée). */
  resume: Game[]
  resumeTitle: string
  onTarget: (g: Game) => void
  /** Actus des jeux activées : lien « Patch » de la ligne d'infos. */
  news: boolean
  onReadNews: (gameId: string, postId: string) => void
  onLaunch: LaunchFn
  onOpen: (g: Game) => void
  onFavorite: (g: Game) => void
}

/** Jeu à la une : grand visuel, pastilles, titre, ligne d'infos, actions ; à droite, « À reprendre » sur du verre. */
function HomeHero({
  game,
  players,
  achievements,
  resume,
  resumeTitle,
  onTarget,
  news,
  onReadNews,
  onLaunch,
  onOpen,
  onFavorite
}: HeroProps): React.JSX.Element {
  const root = useRef<HTMLElement>(null)
  const art = useRef<HTMLDivElement>(null)
  const p = usePlayState(game, onLaunch)
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
      window.addEventListener('scroll', stale, {
        capture: true,
        passive: true
      })
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

  // Le visuel du jeu sert de point de départ au morphing vers la fiche.
  const open = (): void => {
    setMorphSource(art.current, game.id, 'art')
    onOpen(game)
  }

  const src = game.lastPlayedSource
  const patch = news ? game.lastPatch : undefined

  return (
    <section ref={root} className={`hh ${game.running ? 'is-live' : ''}`} aria-label={`À la une : ${name}`}>
      <div className="hh-bleed" aria-hidden="true">
        <div ref={art} className="hh-art" style={{ background: generatedBackground(game.name) }}>
          {backUrl && (
            <img
              key={backUrl}
              className={`hh-img ${heroUrl ? '' : 'hh-img-blur'} ${loaded ? 'is-loaded' : ''}`}
              src={backUrl}
              alt=""
              draggable={false}
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={() => (heroUrl ? setHeroFailed(true) : undefined)}
            />
          )}
        </div>
        <div className="hh-scrim" />
      </div>

      <div className="hh-in">
        <div className="hh-main">
          <div className="hh-chips">
            <StoreTag kind={game.store} long className="hh-store" />
            {game.running && <LiveBadge />}
            {players.length > 0 && (
              <span className="hh-chip-live" title={players.map((f) => f.name).join(', ')}>
                <Icon name="play" size={10} />
                {playersLabel(players)}
              </span>
            )}
            {game.newPatch && <NewsBadge patch={game.newPatch} className="hh-news" />}
          </div>
          <h2 className="hh-title" title={name}>
            {name}
          </h2>
          <p className="hh-meta num">
            {game.running ? (
              <span className="hh-meta-live">Partie en cours</span>
            ) : game.lastPlayed ? (
              <span title={`${formatDate(game.lastPlayed)}${src ? `, ${PLAYED_SOURCE[src]}` : ''}`}>Dernière partie : {timeAgo(game.lastPlayed)}</span>
            ) : (
              !hasPlayed(game) && <span>Jamais lancé depuis Player X</span>
            )}
            {!!game.playtime && <span>{formatPlaytime(game.playtime)} de jeu</span>}
            {(game.launches ?? 0) > 0 && <span title="Depuis Player X">{plural(game.launches ?? 0, 'lancement', 'lancements')}</span>}
            {achievements && (
              <span>
                {achievements.unlocked} / {achievements.total} succès
              </span>
            )}
            {patch && (
              <span>
                <button
                  className="hh-patch"
                  title={`${patch.title} · notes publiées sur Steam le ${formatDate(patch.at)}`}
                  aria-label={`Lire les notes du dernier patch de ${name} : ${patch.title}, ${timeAgo(patch.at)}`}
                  onClick={() => onReadNews(game.id, patch.id)}
                >
                  Patch {timeAgo(patch.at)}
                  <Icon name="chevron-right" size={14} />
                </button>
              </span>
            )}
          </p>
          <div className="hh-actions">
            <button
              className={`btn btn-primary btn-play ${p.className}`}
              data-magnetic={p.state === 'idle' ? '' : undefined}
              aria-disabled={p.inert || undefined}
              aria-busy={p.busy || undefined}
              aria-label={p.ariaLabel}
              title={p.state === 'idle' ? undefined : p.title}
              onClick={() => p.activate(art.current)}
            >
              <PlayLabel p={p} size={20} />
            </button>
            <button className="btn hh-glass hh-sheet" onClick={open}>
              Détails du jeu
            </button>
            <button
              className={`btn hh-glass hh-fav ${fav ? 'is-on' : ''}`}
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
        </div>

        {resume.length > 1 && (
          <div className="hh-end">
            <h3 className="hh-end-title">{resumeTitle}</h3>
            <ul className="hh-resume">
              {resume.map((g) => (
                <ResumeRow key={g.id} game={g} active={g.id === game.id} onTarget={onTarget} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

/** Ligne de « À reprendre » : met le jeu à la une (le jeu à la une est surligné). */
function ResumeRow({ game, active, onTarget }: { game: Game; active: boolean; onTarget: (g: Game) => void }): React.JSX.Element {
  const name = cleanName(game.name)
  const store = KIND_LABEL[game.store]
  const sub = game.running
    ? `En cours · ${store}`
    : active
      ? `À la une · ${store}`
      : game.lastPlayed
        ? `Joué ${timeAgo(game.lastPlayed)} · ${store}`
        : game.favorite
          ? `Favori · ${store}`
          : store
  return (
    <li>
      <button
        className={`hh-row ${active ? 'is-on' : ''} ${game.running ? 'is-live' : ''}`}
        aria-pressed={active}
        title={active ? undefined : `Mettre ${name} à la une`}
        onClick={() => onTarget(game)}
      >
        <span className="hh-row-thumb" aria-hidden="true">
          <Cover game={game} variant="letter" />
        </span>
        <span className="hh-row-text">
          <span className="hh-row-name">{name}</span>
          <span className="hh-row-sub">{capitalize(sub)}</span>
        </span>
      </button>
    </li>
  )
}

function HomeSkeleton(): React.JSX.Element {
  return (
    <div className="page home" aria-busy="true">
      <span className="sr-only">Recherche des jeux installés…</span>
      <div className="hm-top" aria-hidden="true">
        <div className="hh hh-skel skel" />
        <div className="hm-side">
          <div className="hm-panel hm-skel-panel skel" />
          <div className="hm-panel hm-skel-panel skel" />
        </div>
      </div>
      <div className="hm-shelf" aria-hidden="true">
        <span className="skel hm-skel-h" />
        <div className="hm-track">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="hm-tile skel" />
          ))}
        </div>
      </div>
    </div>
  )
}
