import { useEffect, useMemo, useRef, useState } from 'react'
import { capitalize, cleanName, formatDate, formatPlaytime, plural, timeAgo } from '@shared/text'
import type { Account, FriendPlatform, FriendsResult, Game, Store } from '@shared/types'
import type { ProfileProps } from '../contracts'
import { setArtFocus, setMorphSource } from '../motion'
import { Avatar } from './ui/Avatar'
import { CountUp } from './ui/CountUp'
import { Cover } from './ui/Cover'
import { Icon } from './ui/Icon'
import { LiveBadge } from './ui/LiveBadge'
import { KIND_LABEL, StoreTag } from './ui/StoreTag'
import './profile.css'

export type { ProfileProps }

const STORES: Store[] = ['steam', 'epic', 'ea']
// Ordre d'affichage et de priorité du compte principal : Steam > Discord > PSN.
const PLATFORMS: FriendPlatform[] = ['steam', 'discord', 'psn']
const GUEST_NAME = 'Joueur'
const fmt = new Intl.NumberFormat('fr-FR')

const byName = (a: Game, b: Game): number => cleanName(a.name).localeCompare(cleanName(b.name), 'fr', { sensitivity: 'base' })
const launchesOf = (g: Game): number => g.launches ?? 0
const playtimeOf = (g: Game): number => g.playtime ?? 0

function primaryAccount(accounts: Account[]): Account | undefined {
  for (const p of PLATFORMS) {
    const a = accounts.find((x) => x.platform === p)
    if (a) return a
  }
  return undefined
}

export function Profile({ games, accounts, friends, launchingId, onOpenGame, onLaunch, onManageAccounts, onShowFriends }: ProfileProps): React.JSX.Element {
  const stats = useMemo(() => {
    const launched = games
      .filter((g) => launchesOf(g) > 0)
      .sort((a, b) => launchesOf(b) - launchesOf(a) || (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0) || byName(a, b))
    const recent = games.filter((g) => g.lastPlayed).sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
    const played = games.filter((g) => playtimeOf(g) > 0).sort((a, b) => playtimeOf(b) - playtimeOf(a) || byName(a, b))
    return {
      top: launched.slice(0, 5),
      topPlayed: played.slice(0, 5),
      totalPlaytime: games.reduce((n, g) => n + playtimeOf(g), 0),
      running: games.find((g) => g.running),
      recent: recent.slice(0, 6),
      last: recent[0] as Game | undefined,
      mostLaunched: launched[0] as Game | undefined,
      favorites: games.filter((g) => g.favorite).sort(byName),
      perStore: STORES.map((store) => ({ store, count: games.filter((g) => g.store === store).length })).filter((s) => s.count > 0),
      totalLaunches: games.reduce((n, g) => n + launchesOf(g), 0)
    }
  }, [games])

  // Bannière : jeu le plus lancé, sinon dernier lancé, sinon dégradé de marque.
  const bannerUrls = [stats.mostLaunched?.heroUrl, stats.mostLaunched?.coverUrl, stats.last?.heroUrl, stats.last?.coverUrl].filter((u): u is string => !!u)

  return (
    <div className="page prof">
      <header className="prof-hero">
        <Banner urls={bannerUrls} />
        <Identity accounts={accounts} onManageAccounts={onManageAccounts} />
      </header>

      <section className="prof-stats" aria-label="Statistiques">
        <StatTile
          label="Jeux"
          foot={
            stats.perStore.length > 0 ? (
              <>
                <div className="prof-storebar" aria-hidden="true">
                  {stats.perStore.map((s) => (
                    <span key={s.store} className={`tint-${s.store}`} style={{ flexGrow: s.count }} />
                  ))}
                </div>
                <p className="caption prof-legend">
                  {stats.perStore.map((s) => (
                    <span key={s.store} className="prof-legend-item">
                      <span className={`prof-legend-store tint-${s.store}`}>{KIND_LABEL[s.store]}</span> <span className="num">{fmt.format(s.count)}</span>
                    </span>
                  ))}
                </p>
              </>
            ) : (
              <p className="caption">Aucun jeu détecté</p>
            )
          }
        >
          <span className="prof-stat num">{fmt.format(games.length)}</span>
        </StatTile>

        <StatTile
          label="Temps de jeu"
          foot={
            stats.running ? (
              <LiveBadge label={`En jeu · ${cleanName(stats.running.name)}`} className="prof-live" />
            ) : (
              <p className="caption">{plural(stats.totalLaunches, 'lancement', 'lancements')} depuis Player X</p>
            )
          }
        >
          <span className="prof-stat num">
            <CountUp value={stats.totalPlaytime} format={formatHours} />
          </span>
        </StatTile>

        <StatTile
          label="Dernier lancement"
          foot={<p className="caption">{stats.last?.lastPlayed ? capitalize(timeAgo(stats.last.lastPlayed)) : 'Lance un jeu pour commencer'}</p>}
        >
          {stats.last?.lastPlayed ? (
            <button
              className="prof-last"
              onClick={() => onOpenGame(stats.last!)}
              title={`${cleanName(stats.last.name)} · ${formatDate(stats.last.lastPlayed)}`}
            >
              {cleanName(stats.last.name)}
            </button>
          ) : (
            <span className="prof-last is-empty">Aucun</span>
          )}
        </StatTile>

        <StatTile label="Favoris" foot={<p className="caption">{stats.favorites.length ? 'Marqués d’une étoile' : 'Aucun favori'}</p>}>
          <div className="prof-fav-stat">
            <span className="prof-stat num">{fmt.format(stats.favorites.length)}</span>
            {stats.favorites.length > 0 && (
              <span className="prof-minis" aria-hidden="true">
                {stats.favorites.slice(0, 3).map((g) => (
                  <span key={g.id} className="prof-mini">
                    <Cover key={g.id} game={g} showTitle={false} />
                  </span>
                ))}
              </span>
            )}
          </div>
        </StatTile>
      </section>

      <div className="prof-cols">
        <div className="prof-main">
          {stats.topPlayed.length > 0 ? (
            <TopPlayed games={stats.topPlayed} onOpenGame={onOpenGame} />
          ) : (
            <TopLaunched games={stats.top} onOpenGame={onOpenGame} />
          )}

          {stats.recent.length > 0 && (
            <section className="prof-section" aria-labelledby="prof-recent-title">
              <h2 id="prof-recent-title" className="prof-section-title">
                Lancés récemment
              </h2>
              <div className="prof-recent">
                {stats.recent.map((g) => (
                  <GameTile
                    key={g.id}
                    game={g}
                    meta={capitalize(timeAgo(g.lastPlayed!))}
                    launching={launchingId === g.id}
                    onOpen={onOpenGame}
                    onLaunch={onLaunch}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="prof-section" aria-labelledby="prof-fav-title">
            <h2 id="prof-fav-title" className="prof-section-title">
              Favoris
              {stats.favorites.length > 0 && <span className="caption num prof-section-count">{stats.favorites.length}</span>}
            </h2>
            {stats.favorites.length > 0 ? (
              <div className="prof-favs">
                {stats.favorites.map((g) => (
                  <GameTile key={g.id} game={g} meta={KIND_LABEL[g.store]} launching={launchingId === g.id} onOpen={onOpenGame} onLaunch={onLaunch} />
                ))}
              </div>
            ) : (
              <p className="prof-empty">Aucun favori pour l’instant. Clique sur l’étoile d’un jeu dans ta bibliothèque pour le retrouver ici.</p>
            )}
          </section>
        </div>

        <aside className="prof-side">
          <AccountsCard accounts={accounts} result={friends} onManageAccounts={onManageAccounts} />
          <FriendsCard accounts={accounts} result={friends} onShowFriends={onShowFriends} />
        </aside>
      </div>
    </div>
  )
}

/* ---------- bannière ---------- */

function Banner({ urls }: { urls: string[] }): React.JSX.Element {
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set())
  const url = urls.find((u) => !failed.has(u))
  return (
    <div className={`prof-banner ${url ? 'has-art' : ''}`} aria-hidden="true">
      {url && <BannerImage key={url} url={url} onFail={() => setFailed((prev) => new Set(prev).add(url))} />}
      <div className="prof-banner-tint" />
    </div>
  )
}

function BannerImage({ url, onFail }: { url: string; onFail: () => void }): React.JSX.Element {
  const [loaded, setLoaded] = useState(false)
  return <img className={`prof-banner-img ${loaded ? 'is-loaded' : ''}`} src={url} alt="" draggable={false} onLoad={() => setLoaded(true)} onError={onFail} />
}

/* ---------- identité ---------- */

function Identity({ accounts, onManageAccounts }: { accounts: Account[]; onManageAccounts: () => void }): React.JSX.Element {
  const main = primaryAccount(accounts)
  const name = main?.name ?? GUEST_NAME
  const linked = PLATFORMS.flatMap((p) => accounts.filter((a) => a.platform === p))
  return (
    <section className="prof-identity" aria-label="Identité">
      <div className="prof-avatar">
        <Avatar name={name} url={main?.avatarUrl} size={88} status={main ? 'connected' : 'guest'} />
      </div>
      <div className="prof-id-text">
        <span className="prof-kicker">Ton profil</span>
        <h1 className="prof-name" title={name}>
          {name}
        </h1>
        {linked.length > 0 ? (
          <ul className="prof-chips" aria-label="Comptes reliés">
            {linked.map((a) => (
              <li key={`${a.platform}:${a.id}`} className="prof-chip">
                <StoreTag kind={a.platform} />
                <span className="sr-only">{KIND_LABEL[a.platform]} :</span>
                <span className="prof-chip-name">{a.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="caption">Profil local · aucun compte relié</p>
        )}
      </div>
      <button className="btn btn-secondary prof-manage" onClick={onManageAccounts}>
        <Icon name="link" size={16} />
        Gérer les comptes
      </button>
    </section>
  )
}

/* ---------- tuiles de statistiques ---------- */

function StatTile({ label, children, foot }: { label: string; children: React.ReactNode; foot?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="card-surface prof-tile">
      <span className="overline">{label}</span>
      <div className="prof-tile-value">{children}</div>
      {foot && <div className="prof-tile-foot">{foot}</div>}
    </div>
  )
}

/* ---------- colonne principale ---------- */

function TopLaunched({ games, onOpenGame }: { games: Game[]; onOpenGame: (g: Game) => void }): React.JSX.Element {
  const max = games.length ? launchesOf(games[0]) : 1
  return (
    <section className="card-surface prof-card" aria-labelledby="prof-top-title">
      <header className="prof-card-head">
        <h2 id="prof-top-title" className="prof-card-title">
          Les plus lancés
        </h2>
        {games.length > 0 && <span className="caption">Top 5</span>}
      </header>
      {games.length > 0 ? (
        <ol className="prof-top">
          {games.map((g, i) => {
            const n = launchesOf(g)
            const name = cleanName(g.name)
            return (
              <li key={g.id}>
                <button className="prof-top-row" onClick={() => onOpenGame(g)} aria-label={`${i + 1}. ${name}, ${plural(n, 'lancement', 'lancements')}`}>
                  <span className="prof-rank num">{i + 1}</span>
                  <span className="prof-thumb">
                    <Cover key={g.id} game={g} variant="letter" />
                  </span>
                  <span className="prof-top-main">
                    <span className="prof-top-name" title={name}>
                      {name}
                    </span>
                    <span className="prof-bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(4, (n / max) * 100)}%` }} />
                    </span>
                  </span>
                  <span className="prof-top-count">
                    <span className="num">{fmt.format(n)}</span>
                    <span className="caption">{n > 1 ? 'lancements' : 'lancement'}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="prof-empty">Lance un jeu depuis Player X pour voir tes statistiques ici.</p>
      )}
    </section>
  )
}

/** Total en heures entières (le détail des minutes est sur chaque jeu). */
const formatHours = (minutes: number): string => (minutes < 60 ? formatPlaytime(minutes) : `${fmt.format(Math.floor(minutes / 60))} h`)

function TopPlayed({ games, onOpenGame }: { games: Game[]; onOpenGame: (g: Game) => void }): React.JSX.Element {
  const max = playtimeOf(games[0]) || 1
  return (
    <section className="card-surface prof-card" aria-labelledby="prof-top-title">
      <header className="prof-card-head">
        <h2 id="prof-top-title" className="prof-card-title">
          Les plus joués
        </h2>
        <span className="caption">Top 5 · temps de jeu</span>
      </header>
      <ol className="prof-top">
        {games.map((g, i) => {
          const t = playtimeOf(g)
          const name = cleanName(g.name)
          return (
            <li key={g.id} style={{ '--i': i } as React.CSSProperties}>
              <button className="prof-top-row" onClick={() => onOpenGame(g)} aria-label={`${i + 1}. ${name}, ${formatPlaytime(t)}`}>
                <span className="prof-rank num">{i + 1}</span>
                <span className="prof-thumb">
                  <Cover key={g.id} game={g} variant="letter" />
                </span>
                <span className="prof-top-main">
                  <span className="prof-top-line">
                    <span className="prof-top-name" title={name}>
                      {name}
                    </span>
                    {g.running && <LiveBadge className="prof-top-live" />}
                  </span>
                  <span className="prof-bar prof-bar-grow" aria-hidden="true">
                    <span style={{ width: `${Math.max(4, (t / max) * 100)}%` }} />
                  </span>
                </span>
                <span className="prof-top-count">
                  <span className="num">{formatPlaytime(t)}</span>
                  <span className="caption">{g.playtimeSource === 'steam' ? 'selon Steam' : 'mesuré ici'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

interface GameTileProps {
  game: Game
  meta: string
  launching: boolean
  onOpen: (g: Game) => void
  onLaunch: (g: Game) => void
}

/** Jaquette 2:3 cliquable (ouvre la fiche) avec un bouton Jouer au survol. */
function GameTile({ game, meta, launching, onOpen, onLaunch }: GameTileProps): React.JSX.Element {
  const name = cleanName(game.name)
  const art = game.heroUrl || game.coverUrl
  const box = useRef<HTMLSpanElement>(null)
  // Fond aux couleurs du jeu : on ne l'efface que si cette tuile l'a posé.
  const hovered = useRef(false)
  const focused = useRef(false)
  useEffect(
    () => () => {
      if (hovered.current || focused.current) setArtFocus(null)
    },
    []
  )
  return (
    <div
      className={`prof-gt ${launching ? 'is-launching' : ''}`}
      aria-busy={launching || undefined}
      onPointerEnter={() => {
        hovered.current = true
        setArtFocus(art)
      }}
      onPointerLeave={() => {
        if (hovered.current) setArtFocus(null)
        hovered.current = false
      }}
    >
      <button
        className="prof-gt-open"
        onClick={() => {
          setMorphSource(box.current, game.id, 'cover')
          onOpen(game)
        }}
        onFocus={(e) => {
          if (!e.currentTarget.matches(':focus-visible')) return
          focused.current = true
          setArtFocus(art)
        }}
        onBlur={() => {
          if (focused.current) setArtFocus(null)
          focused.current = false
        }}
        aria-label={`${name}, ${meta}`}
      >
        <span className="prof-gt-box" ref={box}>
          <Cover key={game.id} game={game} />
        </span>
        <span className="prof-gt-name" title={name}>
          {name}
        </span>
        <span className="caption prof-gt-meta">{meta}</span>
      </button>
      <button
        className="prof-gt-play"
        onClick={() => onLaunch(game)}
        disabled={launching}
        aria-label={`Jouer à ${name}`}
        title={launching ? 'Lancement…' : 'Jouer'}
      >
        {launching ? <span className="spinner" /> : <Icon name="play" size={16} />}
      </button>
    </div>
  )
}

/* ---------- colonne de droite ---------- */

interface AccountState {
  label: string
  pill: string
  caption?: string
}

function accountState(p: FriendPlatform, accounts: Account[], result: FriendsResult): AccountState {
  const account = accounts.find((a) => a.platform === p)
  const error = result.errors[p]
  if (error) {
    // Une erreur qui renvoie aux Paramètres est une configuration manquante, pas une panne.
    const setup = /param[eè]tres|ajoute|configur/i.test(error)
    return { label: setup ? 'À configurer' : 'Erreur', pill: setup ? 'pill-warning' : 'pill-danger', caption: error }
  }
  const hasData = result.friends.some((f) => f.platform === p)
  if (account || hasData) {
    const caption = p === 'discord' && hasData ? [account?.name, 'Serveur Discord'].filter(Boolean).join(' · ') : account?.name
    return { label: 'Connecté', pill: 'pill-success', caption }
  }
  return { label: 'Non connecté', pill: 'pill-muted' }
}

function AccountsCard({ accounts, result, onManageAccounts }: { accounts: Account[]; result: FriendsResult; onManageAccounts: () => void }): React.JSX.Element {
  return (
    <section className="card-surface prof-card" aria-labelledby="prof-acc-title">
      <header className="prof-card-head">
        <h2 id="prof-acc-title" className="prof-card-title">
          Comptes connectés
        </h2>
      </header>
      <ul className="prof-accounts">
        {PLATFORMS.map((p) => {
          const s = accountState(p, accounts, result)
          return (
            <li key={p} className="prof-acc">
              <StoreTag kind={p} size={28} />
              <span className="prof-acc-text">
                <span className="prof-acc-name">{KIND_LABEL[p]}</span>
                {s.caption && (
                  <span className="caption prof-acc-sub" title={s.caption}>
                    {s.caption}
                  </span>
                )}
              </span>
              <span className={`pill ${s.pill}`}>{s.label}</span>
            </li>
          )
        })}
      </ul>
      <footer className="prof-card-foot">
        <button className="link-btn prof-foot-link" onClick={onManageAccounts}>
          Gérer
        </button>
      </footer>
    </section>
  )
}

function FriendsCard({ accounts, result, onShowFriends }: { accounts: Account[]; result: FriendsResult; onShowFriends: () => void }): React.JSX.Element {
  // Les membres Discord ne sont pas des amis : on ne compte que Steam et PlayStation.
  const real = result.friends.filter((f) => f.platform !== 'discord')
  const inGame = real.filter((f) => f.status === 'in-game').length
  const online = real.filter((f) => f.status === 'online' || f.status === 'away').length
  const offline = real.filter((f) => f.status === 'offline').length
  const discordOnline = result.friends.filter((f) => f.platform === 'discord' && f.status !== 'offline').length
  const known = real.length > 0 || accounts.some((a) => a.platform === 'steam' || a.platform === 'psn')

  return (
    <section className="card-surface prof-card" aria-labelledby="prof-friends-title">
      <header className="prof-card-head">
        <h2 id="prof-friends-title" className="prof-card-title">
          Amis
        </h2>
      </header>
      {known ? (
        <div className="prof-counters">
          <Counter value={inGame} label="en jeu" kind="in-game" />
          <Counter value={online} label="en ligne" kind="online" />
          <Counter value={offline} label="hors ligne" kind="offline" />
        </div>
      ) : (
        <p className="prof-empty">Connecte Steam ou PlayStation pour voir tes amis ici.</p>
      )}
      {discordOnline > 0 && <p className="caption prof-discord">+ {plural(discordOnline, 'membre', 'membres')} en ligne sur ton serveur Discord</p>}
      <footer className="prof-card-foot">
        <button className="btn btn-ghost btn-sm" onClick={onShowFriends}>
          Voir la liste
          <Icon name="chevron-right" size={14} />
        </button>
      </footer>
    </section>
  )
}

function Counter({ value, label, kind }: { value: number; label: string; kind: 'in-game' | 'online' | 'offline' }): React.JSX.Element {
  return (
    <div className={`prof-counter is-${kind}`}>
      <span className="prof-counter-value num">{fmt.format(value)}</span>
      <span className="caption prof-counter-label">
        <span className="prof-dot" aria-hidden="true" />
        {label}
      </span>
    </div>
  )
}
