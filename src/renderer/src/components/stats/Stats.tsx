import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { timeAgo } from '@shared/text'
import type { Bf6Account, Bf6Art, Bf6Match, Bf6Point, Bf6Row, Bf6Snapshot, Bf6Tracked } from '@shared/types'
import type { StatsProps } from '../../contracts'
import { TopTabs, TopTitle } from '../TopTabs'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { errorMessage } from '../ui/Toasts'
import { dec, duration, inWindow, int, isBf6Game, kdOf, keyOf, percent, periodOf, PLATFORM_LABEL, playedFor, useBf6, useBf6History } from './bf6'
import { ClassIcon, classKind } from './ClassIcon'
import { Progress } from './Progress'
import { LastSession } from './Recap'
import './stats.css'

export type { StatsProps }

const api = window.launcher

const SOURCE_URL = 'https://gametools.network/stats'
const TOP = 10

/** Ligne « All » que l'API glisse dans les cartes, modes et classes : c'est le total, pas une entrée. */
const isTotal = (r: Bf6Row): boolean => /^(all|tous|toutes|total)$/i.test(r.name.trim())
const entries = (list: Bf6Row[]): Bf6Row[] => list.filter((r) => !isTotal(r))

/** Au-delà de 100 %, la précision est faussée (chaque plomb d'un fusil à pompe compte comme un tir touché). */
const ACC_BROKEN = 'Faussé par l’API : chaque plomb compte comme un tir touché'
const accuracyOf = (r: Bf6Row): number | undefined => (r.accuracy !== undefined && r.accuracy <= 100 ? r.accuracy : undefined)

type StatsTab = 'overview' | 'progress' | 'arsenal' | 'maps' | 'board'

const TAB_KEY = 'pg.stats.tab'
const TAB_IDS: StatsTab[] = ['overview', 'progress', 'arsenal', 'maps', 'board']

function loadTab(): StatsTab {
  try {
    const t = localStorage.getItem(TAB_KEY) as StatsTab | null
    return t && TAB_IDS.includes(t) ? t : 'overview'
  } catch {
    return 'overview'
  }
}

/** « 1er », « 2e » */
const ordinal = (n: number): string => (n === 1 ? '1er' : `${n}e`)

export function Stats({ games }: StatsProps): React.JSX.Element {
  const [tracked, setTracked] = useState<Bf6Tracked | null>(null)
  const [gameArt, setGameArt] = useState<Bf6Art>({})
  const [logoFailed, setLogoFailed] = useState(false)
  const [tab, setTab] = useState<StatsTab>(loadTab)
  const me = useBf6(tracked?.me ?? null)
  const rivals = useRivals(tracked?.rivals ?? [])
  const history = useBf6History(tracked?.me ?? null, me.snap?.fetchedAt)

  useEffect(() => {
    api.bf6GetTracked().then(setTracked)
    api
      .bf6Art()
      .then(setGameArt)
      .catch(() => {})
  }, [])

  const save = useCallback(async (next: Bf6Tracked) => setTracked(await api.bf6SetTracked(next)), [])

  // Visuel du jeu : celui de la bibliothèque s'il y est, sinon celui du catalogue Steam.
  const art = useMemo(() => {
    const g = games.find(isBf6Game)
    return g?.heroUrl || gameArt.heroUrl || g?.coverUrl
  }, [games, gameArt])
  const logo = !logoFailed && gameArt.logoUrl

  const name = me.snap?.stats.account.name ?? tracked?.me?.name
  const standing = useMemo(() => standingOf(tracked, me.snap, rivals.data), [tracked, me.snap, rivals.data])

  const pick = (next: StatsTab): void => {
    if (next === tab) return
    setTab(next)
    try {
      localStorage.setItem(TAB_KEY, next)
    } catch {
      /* stockage indisponible : l'onglet vaut pour la session */
    }
    document.querySelector('.content')?.scrollTo({ top: 0 })
  }

  const linked = !!tracked?.me
  const snap = me.snap

  return (
    <div className="page bf">
      {linked ? (
        <TopTabs<StatsTab>
          label="Stats Battlefield 6"
          idBase="bf"
          value={tab}
          onChange={pick}
          tabs={[
            { id: 'overview', label: 'Vue d’ensemble', short: 'Aperçu' },
            { id: 'progress', label: 'Progression' },
            { id: 'arsenal', label: 'Arsenal' },
            { id: 'maps', label: 'Cartes et modes', short: 'Cartes' },
            { id: 'board', label: 'Classement', badge: standing ? ordinal(standing.rank) : undefined }
          ]}
        />
      ) : (
        <TopTitle>Stats de jeu</TopTitle>
      )}

      {(!linked || tab === 'overview') && (
        <header className={`bf-hero ${art ? 'has-art' : ''} ${linked ? 'is-profile' : ''}`}>
          <div className="bf-hero-art" aria-hidden="true">
            {art && <img src={art} alt="" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}
            <span className="bf-hero-mark">BF6</span>
            <div className="bf-hero-grid" />
            <div className="bf-hero-scrim" />
          </div>

          <div className="bf-hero-body">
            {tracked?.me && name ? (
              <PlayerIdentity
                account={tracked.me}
                name={name}
                state={me}
                logo={logo || undefined}
                onLogoError={() => setLogoFailed(true)}
                onUnlink={() => save({ me: null, rivals: tracked.rivals })}
              />
            ) : (
              <>
                <span className="bf-kicker">Stats de jeu</span>
                {logo ? (
                  <h1 className="bf-logo-title">
                    <img className="bf-logo" src={logo} alt="Battlefield 6" draggable={false} onError={() => setLogoFailed(true)} />
                  </h1>
                ) : (
                  <h1 className="bf-hero-title">Battlefield 6</h1>
                )}
              </>
            )}
          </div>

          {linked && standing && <RankCard standing={standing} onOpen={() => pick('board')} />}
          {linked && snap && <Band snap={snap} history={history} />}
          {linked && !snap && me.loading && <div className="skel bf-band-skel" aria-hidden="true" />}
        </header>
      )}

      {!tracked ? (
        <div className="skel bf-skel" />
      ) : !tracked.me ? (
        <section className="card-surface bf-card bf-link">
          <span className="bf-link-icon" aria-hidden="true">
            <Icon name="chart" size={22} />
          </span>
          <h2 className="bf-card-title">Relie ton profil Battlefield 6</h2>
          <p className="bf-text">Entre ton pseudo EA (celui affiché en jeu). Player X retrouve ton compte, même si tu joues sur Steam, PlayStation ou Xbox.</p>
          <PlayerSearch action="C’est moi" onPick={(a) => save({ me: a, rivals: tracked.rivals })} />
        </section>
      ) : (
        <div id="bf-panel" className="bf-panel" role="tabpanel" aria-labelledby={`bf-tab-${tab}`}>
          {(me.error || snap?.stale) && (
            <p className={me.error ? 'bf-error bf-banner-msg' : 'bf-warn bf-banner-msg'}>
              {me.error ?? `${snap?.stale} Dernières stats connues affichées.`}
            </p>
          )}
          {tab === 'board' ? (
            <Leaderboard tracked={tracked} meSnap={snap} meError={me.error} meLoading={me.loading} rivals={rivals} onChange={save} />
          ) : snap ? (
            <>
              {tab === 'overview' && (
                <>
                  <LastSession />
                  <Highlights snap={snap} history={history} onOpen={pick} />
                  <KeyTiles snap={snap} />
                </>
              )}
              {tab === 'progress' && <Progress account={tracked.me} fetchedAt={snap.fetchedAt} />}
              {tab === 'arsenal' && (
                <>
                  <div className="bf-cols">
                    <Arsenal snap={snap} />
                    <Classes snap={snap} />
                  </div>
                  <Details snap={snap} tabs={['weapons', 'vehicles']} title="Tout l’arsenal" />
                </>
              )}
              {tab === 'maps' && (
                <>
                  <Maps snap={snap} />
                  <Details snap={snap} tabs={['maps', 'modes']} title="Toutes les cartes et modes" />
                </>
              )}
            </>
          ) : (
            me.loading && <div className="skel bf-skel" />
          )}
        </div>
      )}

      <p className="caption bf-source">
        Statistiques fournies par{' '}
        <button className="link-btn" onClick={() => api.openExternal(SOURCE_URL)}>
          gametools.network
        </button>
        , un service communautaire non officiel : EA ne propose pas d’API publique pour Battlefield 6. Player X n’est affilié ni à EA ni à DICE.
      </p>
    </div>
  )
}

/* ---------- rang et joueurs suivis ---------- */

type RivalState = Record<string, { snap?: Bf6Snapshot; error?: string }>

interface Rivals {
  data: RivalState
  loading: boolean
  /** Relit tous les joueurs suivis sans passer par le cache. */
  refresh: () => void
}

/** Stats des joueurs suivis, lues une à une : le service limite les appels rapprochés. */
function useRivals(list: Bf6Account[]): Rivals {
  const [data, setData] = useState<RivalState>({})
  const [loading, setLoading] = useState(false)
  const [force, setForce] = useState(0)
  /** Joueurs que le dernier « Actualiser le classement » doit encore relire sans cache, et relectures en cours. */
  const forced = useRef<{ force: number; pending: Set<string>; inflight: Map<string, Promise<Bf6Snapshot>> }>({
    force: 0,
    pending: new Set(),
    inflight: new Map()
  })
  const rivalKeys = list.map(keyOf).join('|')

  useEffect(() => {
    // Seul « Actualiser le classement » contourne le cache, pour les joueurs présents au clic. Un ajout ou un retrait
    // pendant ce passage le relance : les joueurs pas encore relus le sont toujours sans cache, les nouveaux venus non.
    const keys = list.map(keyOf)
    if (forced.current.force !== force) forced.current = { force, pending: new Set(keys), inflight: new Map() }
    const { pending, inflight } = forced.current
    for (const k of pending) if (!keys.includes(k)) pending.delete(k)
    let live = true
    setLoading(true)
    ;(async () => {
      for (const a of list) {
        const k = keyOf(a)
        try {
          // Une relecture déjà partie pour ce joueur est attendue, pas relancée (un appel à la fois).
          let forcedFetch = inflight.get(k)
          if (!forcedFetch && pending.has(k)) {
            forcedFetch = api.bf6Stats(a, true).finally(() => {
              pending.delete(k)
              inflight.delete(k)
            })
            inflight.set(k, forcedFetch)
          }
          const snap = await (forcedFetch ?? api.bf6Stats(a, false))
          if (live) setData((prev) => ({ ...prev, [k]: { snap } }))
        } catch (e) {
          if (live) setData((prev) => ({ ...prev, [k]: { error: errorMessage(e) } }))
        }
        if (!live) return
      }
      if (live) setLoading(false)
    })()
    return () => {
      live = false
    }
  }, [rivalKeys, force])

  return { data, loading, refresh: useCallback(() => setForce((n) => n + 1), []) }
}

interface Standing {
  rank: number
  /** Joueurs classés (stats lues), toi compris. */
  total: number
  /** Le joueur juste devant toi (ou juste derrière quand tu es premier). */
  next?: { name: string; kd: number; ahead: boolean }
  /** Joueurs classés, du premier au dernier, pour la pile d'avatars. */
  ranked: { name: string; avatarUrl?: string; me: boolean }[]
}

/** Ta place au K/D parmi les joueurs suivis (dès qu'un autre joueur est classé). */
function standingOf(tracked: Bf6Tracked | null, meSnap: Bf6Snapshot | null, rivals: RivalState): Standing | null {
  if (!tracked?.me || !meSnap) return null
  const all = [
    { stats: meSnap.stats, me: true },
    ...tracked.rivals.flatMap((a) => {
      const s = rivals[keyOf(a)]?.snap
      return s ? [{ stats: s.stats, me: false }] : []
    })
  ].sort((a, b) => b.stats.killDeath - a.stats.killDeath)
  if (all.length < 2) return null
  const i = all.findIndex((e) => e.me)
  const other = i > 0 ? all[i - 1] : all[1]
  return {
    rank: i + 1,
    total: all.length,
    next: { name: other.stats.account.name, kd: other.stats.killDeath, ahead: i > 0 },
    ranked: all.map((e) => ({ name: e.stats.account.name, avatarUrl: e.stats.avatarUrl, me: e.me }))
  }
}

/** Carte du classement dans l'en-tête : ton rang au K/D, qui est juste devant, accès à l'onglet. */
function RankCard({ standing, onOpen }: { standing: Standing; onOpen: () => void }): React.JSX.Element {
  const { rank, total, next, ranked } = standing
  return (
    <div className="bf-rank-card">
      <span className="bf-overline">Classement · K/D</span>
      <p className="bf-rank-value">
        <b className="num">{ordinal(rank)}</b>
        <span>
          sur {total}
          {next && (
            <>
              {' · '}
              {next.ahead ? 'derrière' : 'devant'} {next.name} (<span className="num">{dec.format(next.kd)}</span>)
            </>
          )}
        </span>
      </p>
      <div className="bf-rank-row">
        <span className="bf-stack" aria-hidden="true">
          {ranked.slice(0, 5).map((p) => (
            <span key={p.name} className={p.me ? 'is-me' : ''}>
              <Avatar name={p.name} url={p.avatarUrl} size={28} />
            </span>
          ))}
        </span>
        <button className="btn btn-ghost btn-sm bf-rank-open" onClick={onOpen}>
          Voir le classement
          <Icon name="chevron-right" size={14} />
        </button>
      </div>
    </div>
  )
}

/** Bandeau vitré au bas de l'en-tête : les trois chiffres phares et l'évolution du K/D sur 30 jours. */
function Band({ snap, history }: { snap: Bf6Snapshot; history: Bf6Point[] | null }): React.JSX.Element {
  const s = snap.stats
  const month = history ? periodOf(inWindow(history, 30)) : null
  const change = month?.kdChange ?? 0
  return (
    <dl className="bf-band">
      <div className="bf-band-item is-main">
        <dt>ratio K/D</dt>
        <dd className="num">{dec.format(s.killDeath)}</dd>
      </div>
      <div className="bf-band-item">
        <dt>élim. par minute</dt>
        <dd className="num">{dec.format(s.killsPerMinute)}</dd>
      </div>
      <div className="bf-band-item">
        <dt>de victoires</dt>
        <dd className="num">{percent(s.winPercent)}</dd>
      </div>
      {month && (
        <div className={`bf-trend ${change > 0.005 ? 'is-up' : change < -0.005 ? 'is-down' : ''}`}>
          <Icon name={change < -0.005 ? 'trend-down' : 'trend'} size={18} />
          <b className="num">
            K/D {change >= 0 ? '+' : '−'}
            {dec.format(Math.abs(change))}
          </b>
          <span>en 30 j</span>
        </div>
      )}
    </dl>
  )
}

/* ---------- en bref : le meilleur de chaque onglet ---------- */

function Highlights({ snap, history, onOpen }: { snap: Bf6Snapshot; history: Bf6Point[] | null; onOpen: (t: StatsTab) => void }): React.JSX.Element | null {
  const s = snap.stats
  const weapon = entries(s.weapons)
    .filter((w) => (w.kills ?? 0) > 0)
    .sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0))[0]
  const classes = entries(s.classes)
    .filter((c) => (c.kills ?? 0) > 0)
    .sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0))
  const classTotal = classes.reduce((n, c) => n + (c.kills ?? 0), 0)
  const topClass = classes[0]
  const map = entries(s.maps)
    .filter((m) => (m.matches ?? 0) > 0)
    .sort((a, b) => (b.matches ?? 0) - (a.matches ?? 0))[0]
  const points = history ? inWindow(history, 30) : []
  const month = periodOf(points)

  return (
    <section className="bf-brief" aria-labelledby="bf-brief-title">
      <div className="bf-row-head">
        <h2 id="bf-brief-title" className="h-section">
          En bref
        </h2>
        <span className="caption">· le meilleur de chaque onglet</span>
      </div>
      <div className="bf-brief-grid">
        {weapon && (
          <BriefCard label="Arme favorite" name={weapon.name} foot="Voir l’arsenal" onOpen={() => onOpen('arsenal')}
            line={[`${int.format(weapon.kills ?? 0)} élim.`, weapon.kpm !== undefined && `${dec.format(weapon.kpm)} /min`, accuracyOf(weapon) !== undefined && `${percent(accuracyOf(weapon)!)} préc.`]}
          >
            <span className="bf-brief-vis is-weapon">
              <span className="bf-brief-rank num">1</span>
              <WeaponArt image={weapon.image} name={weapon.name} />
            </span>
          </BriefCard>
        )}
        {topClass && (
          <BriefCard label="Classe favorite" name={`${topClass.name} · ${percent(classTotal ? ((topClass.kills ?? 0) / classTotal) * 100 : 0)}`} foot="Voir les classes" onOpen={() => onOpen('arsenal')}
            line={[`${int.format(topClass.kills ?? 0)} élim.`, topClass.killDeath !== undefined && `K/D ${dec.format(topClass.killDeath)}`, topClass.secondsPlayed !== undefined && duration(topClass.secondsPlayed)]}
          >
            <span className="bf-brief-vis is-classes">
              <span className="bf-split">
                {classes.map((c, i) => (
                  <i key={c.id} className={`is-${i}`} style={{ flexGrow: c.kills ?? 0 }} title={c.name} />
                ))}
              </span>
              <span className="caption">
                Part des éliminations · {classes.length} classe{classes.length > 1 ? 's' : ''}
              </span>
            </span>
          </BriefCard>
        )}
        {map && (
          <BriefCard label="Carte la plus jouée" name={map.name} foot="Voir les cartes et modes" onOpen={() => onOpen('maps')}
            line={[`${int.format(map.matches ?? 0)} ${(map.matches ?? 0) > 1 ? 'matchs' : 'match'}`, map.winPercent !== undefined && `${percent(map.winPercent)} de victoires`]}
          >
            <span className="bf-brief-vis is-map">
              {map.image && <img src={map.image} alt="" loading="lazy" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}
              <span className="bf-brief-rank num">1</span>
            </span>
          </BriefCard>
        )}
        <BriefCard
          label="Progression · 30 j"
          name={month ? `K/D ${dec.format(month.deaths ? month.kills / month.deaths : month.kills)} sur la période` : 'Ta courbe démarre'}
          foot="Voir la progression"
          onOpen={() => onOpen('progress')}
          line={
            month
              ? [`${int.format(month.matches)} partie${month.matches > 1 ? 's' : ''}`, `${int.format(month.wins)} gagnée${month.wins > 1 ? 's' : ''}`, playedFor(month.seconds)]
              : ['Un relevé par jour, gardé sur ce PC']
          }
        >
          <span className="bf-brief-vis is-spark">
            <Spark points={points} />
          </span>
        </BriefCard>
      </div>
    </section>
  )
}

function BriefCard(props: { label: string; name: string; line: (string | false | undefined)[]; foot: string; onOpen: () => void; children: React.ReactNode }): React.JSX.Element {
  const { label, name, line, foot, onOpen, children } = props
  return (
    <article className="bf-brief-card">
      {children}
      <div className="bf-brief-body">
        <span className="bf-overline">{label}</span>
        <span className="bf-brief-name" title={name}>
          {name}
        </span>
        <span className="bf-brief-line num">{line.filter(Boolean).join(' · ')}</span>
      </div>
      <button className="bf-brief-foot" onClick={onOpen}>
        {foot}
        <Icon name="chevron-right" size={14} />
      </button>
    </article>
  )
}

/** Petite courbe du K/D jour par jour. */
function Spark({ points }: { points: Bf6Point[] }): React.JSX.Element {
  const W = 228
  const H = 56
  if (points.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <path className="bf-spark-empty" d={`M2 ${H - 8} C 60 ${H - 10}, 90 ${H / 2}, 130 ${H / 2 + 2} S 200 12, ${W - 2} 10`} />
      </svg>
    )
  }
  const values = points.map(kdOf)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const xy = values.map((v, i) => [(i / (values.length - 1)) * (W - 4) + 2, H - 6 - ((v - min) / span) * (H - 14)] as const)
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon className="bf-spark-area" points={`${line} ${W - 2},${H} 2,${H}`} />
      <polyline className="bf-spark-line" points={line} />
    </svg>
  )
}

/* ---------- recherche d'un joueur ---------- */

function PlayerSearch({ action, onPick, exclude = [] }: { action: string; onPick: (a: Bf6Account) => void; exclude?: string[] }): React.JSX.Element {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Bf6Match[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    setResults(null)
    try {
      setResults(await api.bf6Search(name))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bf-search">
      <form className="bf-search-row" onSubmit={search}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pseudo EA exact"
          maxLength={64}
          aria-label="Pseudo Battlefield 6"
          spellCheck={false}
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
          {busy ? <span className="spinner" /> : <Icon name="search" size={16} />}
          Chercher
        </button>
      </form>
      {error && <p className="bf-error">{error}</p>}
      {results && results.length === 0 && (
        <p className="bf-text">
          Aucun joueur trouvé avec ce pseudo exact. Vérifie l’orthographe, majuscules comprises. Si tu viens de chercher, réessaie dans 30 secondes.
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="bf-results">
          {results.map((r) => {
            const taken = exclude.includes(keyOf(r))
            return (
              <li key={keyOf(r)} className="bf-result">
                <span className="bf-result-name">{r.name}</span>
                <span className="bf-plat">{PLATFORM_LABEL[r.platform]}</span>
                <span className="caption num bf-result-kills">
                  {r.kills === null ? 'Stats indisponibles' : `${int.format(r.kills)} ${r.kills > 1 ? 'éliminations' : 'élimination'}`}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={taken}
                  onClick={() => onPick({ name: r.name, platform: r.platform, personaId: r.personaId, nucleusId: r.nucleusId })}
                >
                  {taken ? 'Déjà suivi' : action}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ---------- en-tête du joueur ---------- */

function PlayerIdentity({
  account,
  name,
  state,
  logo,
  onLogoError,
  onUnlink
}: {
  account: Bf6Account
  name: string
  state: ReturnType<typeof useBf6>
  /** Logo du jeu (catalogue Steam), en petit au-dessus du pseudo. */
  logo?: string
  onLogoError: () => void
  onUnlink: () => void
}): React.JSX.Element {
  const { snap, loading, refresh } = state
  return (
    <div className="bf-id">
      <span className="bf-id-avatar">
        <Avatar name={name} url={snap?.stats.avatarUrl} size={76} />
      </span>
      <div className="bf-id-text">
        <span className="bf-kicker-row">
          {logo && <img className="bf-logo is-small" src={logo} alt="" draggable={false} onError={onLogoError} />}
          <span className="bf-overline">{logo ? 'Ton profil' : 'Battlefield 6 · Ton profil'}</span>
        </span>
        <h1 className="bf-hero-title" title={name}>
          {name}
        </h1>
        <div className="bf-id-meta">
          <span className="bf-plat">{PLATFORM_LABEL[account.platform]}</span>
          {snap && <span className="bf-meta-item">Mis à jour {timeAgo(snap.fetchedAt)}</span>}
        </div>
        <div className="bf-id-actions">
          <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>
            {loading ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
            Actualiser
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onUnlink}>
            Changer de compte
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- chiffres clés ---------- */

function KeyTiles({ snap }: { snap: Bf6Snapshot }): React.JSX.Element {
  const s = snap.stats
  // `meter` : une vraie proportion (0-100), dessinée en jauge.
  const tiles: { label: string; value: string; foot: string; meter?: number }[] = [
    { label: 'Éliminations', value: int.format(s.kills), foot: `${int.format(s.assists)} ${s.assists > 1 ? 'assistances' : 'assistance'}` },
    { label: 'Morts', value: int.format(s.deaths), foot: `${dec.format(s.killDeath)} élim. par mort` },
    { label: 'Matchs', value: int.format(s.matches), foot: `${int.format(s.wins)} V · ${int.format(s.losses)} D`, meter: s.winPercent },
    {
      label: 'Temps de jeu',
      value: duration(s.secondsPlayed),
      foot: s.matches ? `${int.format(Math.round(s.secondsPlayed / 60 / s.matches))} min par match` : '–'
    },
    { label: 'Précision', value: percent(s.accuracy), foot: 'Tirs touchés', meter: s.accuracy },
    { label: 'Tirs à la tête', value: percent(s.headshots), foot: 'Des éliminations', meter: s.headshots },
    { label: 'Réanimations', value: int.format(s.revives), foot: 'Coéquipiers relevés' },
    { label: 'Assistances', value: int.format(s.assists), foot: s.matches ? `${dec.format(s.assists / s.matches)} par match` : '–' }
  ]
  return (
    <section className="bf-tiles" aria-label="Chiffres clés">
      {tiles.map((t, i) => (
        <div key={t.label} className="card-surface bf-tile" style={{ '--i': i } as React.CSSProperties}>
          <span className="overline">{t.label}</span>
          <span className="bf-tile-value num">{t.value}</span>
          {t.meter !== undefined && (
            <span className="bf-meter" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.max(0, t.meter))}%` }} />
            </span>
          )}
          <span className="caption num">{t.foot}</span>
        </div>
      ))}
    </section>
  )
}

/* ---------- armes favorites et classes ---------- */

/** Visuel d'une arme ; sans image (ou image en échec), son nom en filigrane. */
function WeaponArt({ image, name }: { image?: string; name: string }): React.JSX.Element {
  const [failed, setFailed] = useState<string>()
  if (!image || failed === image) return <span className="bf-weapon-ghost">{name}</span>
  return <img src={image} alt="" loading="lazy" draggable={false} onError={() => setFailed(image)} />
}

function Arsenal({ snap }: { snap: Bf6Snapshot }): React.JSX.Element | null {
  const top = entries(snap.stats.weapons)
    .filter((w) => (w.kills ?? 0) > 0)
    .sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0))
    .slice(0, 3)
  if (!top.length) return null
  return (
    <section className="card-surface bf-card" aria-labelledby="bf-arsenal-title">
      <header className="bf-card-head">
        <h2 id="bf-arsenal-title" className="bf-card-title">
          Armes favorites
        </h2>
        <span className="caption">Par éliminations</span>
      </header>
      <ol className="bf-arsenal">
        {top.map((w, i) => (
          <li key={w.id} className={`bf-weapon ${i === 0 ? 'is-first' : ''}`}>
            <span className="bf-weapon-rank num">{i + 1}</span>
            <span className="bf-weapon-art" aria-hidden="true">
              <WeaponArt image={w.image} name={w.name} />
            </span>
            <span className="bf-weapon-name">{w.name}</span>
            <span className="bf-weapon-stats">
              <span>
                <span className="num">{int.format(w.kills ?? 0)}</span> élim.
              </span>
              {w.kpm !== undefined && (
                <span>
                  <span className="num">{dec.format(w.kpm)}</span> /min
                </span>
              )}
              {accuracyOf(w) !== undefined && (
                <span>
                  <span className="num">{percent(accuracyOf(w)!)}</span> préc.
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Classes({ snap }: { snap: Bf6Snapshot }): React.JSX.Element | null {
  const list = entries(snap.stats.classes)
    .filter((c) => (c.kills ?? 0) > 0)
    .sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0))
  if (!list.length) return null
  const total = list.reduce((n, c) => n + (c.kills ?? 0), 0)
  return (
    <section className="card-surface bf-card" aria-labelledby="bf-classes-title">
      <header className="bf-card-head">
        <h2 id="bf-classes-title" className="bf-card-title">
          Classes
        </h2>
        <span className="caption">Part des éliminations</span>
      </header>
      <ul className="bf-classes">
        {list.map((c, i) => {
          const share = total ? ((c.kills ?? 0) / total) * 100 : 0
          return (
            <li key={c.id} className={`bf-class is-${classKind(c.name)} ${i === 0 ? 'is-first' : ''}`}>
              <span className="bf-class-icon">
                <ClassIcon name={c.name} size={22} />
              </span>
              <span className="bf-class-body">
                <span className="bf-class-head">
                  <span className="bf-class-name">{c.name}</span>
                  <span className="bf-class-share num">{percent(share)}</span>
                </span>
                <span className="bf-meter" aria-hidden="true">
                  <span style={{ width: `${share}%` }} />
                </span>
                <span className="caption num">
                  {int.format(c.kills ?? 0)} élim.
                  {c.killDeath !== undefined && ` · K/D ${dec.format(c.killDeath)}`}
                  {c.secondsPlayed !== undefined && ` · ${duration(c.secondsPlayed)}`}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Cartes les plus jouées, avec leur visuel quand l'API le fournit. */
function Maps({ snap }: { snap: Bf6Snapshot }): React.JSX.Element | null {
  const played = entries(snap.stats.maps)
    .filter((m) => (m.matches ?? 0) > 0)
    .sort((a, b) => (b.matches ?? 0) - (a.matches ?? 0))
  const total = snap.stats.maps.find((m) => isTotal(m) && (m.matches ?? 0) > 0)
  // Le total ouvre la ligne avec une mosaïque des cartes les plus jouées, s'il y a de quoi la composer.
  const mosaic = played.filter((m) => m.image).slice(0, 4)
  const withTotal = total && mosaic.length >= 2
  const top = played.slice(0, withTotal ? 3 : 4)
  if (!top.length) return null
  return (
    <section className="bf-maps" aria-labelledby="bf-maps-title">
      <h2 id="bf-maps-title" className="bf-card-title">
        Tes cartes
      </h2>
      <ol className="bf-maps-list">
        {withTotal && (
          <li className="bf-map is-total">
            <span className="bf-mosaic" aria-hidden="true">
              {mosaic.map((m, i) => (
                <span key={m.id} className="bf-mosaic-slice" style={{ '--i': i } as React.CSSProperties}>
                  <img src={m.image} alt="" loading="lazy" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />
                </span>
              ))}
            </span>
            <span className="bf-map-shade" aria-hidden="true" />
            <span className="bf-map-rank bf-map-all">
              <Icon name="grid" size={12} />
            </span>
            <MapText name="Toutes les cartes" row={total} />
          </li>
        )}
        {top.map((m, i) => (
          <li key={m.id} className="bf-map">
            {m.image && <img key={m.image} src={m.image} alt="" loading="lazy" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}
            <span className="bf-map-shade" aria-hidden="true" />
            <span className="bf-map-rank num">{i + 1}</span>
            <MapText name={m.name} row={m} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function MapText({ name, row }: { name: string; row: Bf6Row }): React.JSX.Element {
  return (
    <span className="bf-map-text">
      <span className="bf-map-name">{name}</span>
      <span className="bf-map-stats">
        <span className="num">{int.format(row.matches ?? 0)}</span> {(row.matches ?? 0) > 1 ? 'matchs' : 'match'}
        {row.winPercent !== undefined && (
          <>
            {' · '}
            <span className="num">{percent(row.winPercent)}</span> de victoires
          </>
        )}
      </span>
    </span>
  )
}

/* ---------- détails ---------- */

type Tab = 'weapons' | 'vehicles' | 'modes' | 'maps'

interface Column {
  label: string
  get: (r: Bf6Row) => number | undefined
  fmt: (n: number) => string
}

const COL = {
  kills: { label: 'Élim.', get: (r) => r.kills, fmt: int.format },
  kd: { label: 'K/D', get: (r) => r.killDeath, fmt: dec.format },
  kpm: { label: 'Élim./min', get: (r) => r.kpm, fmt: dec.format },
  acc: { label: 'Précision', get: accuracyOf, fmt: percent },
  hs: { label: 'Tête', get: (r) => r.headshots, fmt: percent },
  matches: { label: 'Matchs', get: (r) => r.matches, fmt: int.format },
  win: { label: 'Victoires', get: (r) => r.winPercent, fmt: percent },
  time: { label: 'Temps', get: (r) => r.secondsPlayed, fmt: duration }
} satisfies Record<string, Column>

const TABS: { id: Tab; label: string; cols: Column[]; sort: Column }[] = [
  { id: 'weapons', label: 'Armes', cols: [COL.kills, COL.kpm, COL.acc, COL.hs, COL.time], sort: COL.kills },
  { id: 'vehicles', label: 'Véhicules', cols: [COL.kills, COL.kpm, COL.time], sort: COL.kills },
  { id: 'modes', label: 'Modes', cols: [COL.matches, COL.win, COL.kills, COL.kd], sort: COL.matches },
  { id: 'maps', label: 'Cartes', cols: [COL.matches, COL.win, COL.time], sort: COL.matches }
]

/** Tableau complet d'une ou plusieurs catégories (onglets internes quand il y en a plusieurs). */
function Details({ snap, tabs, title }: { snap: Bf6Snapshot; tabs: Tab[]; title: string }): React.JSX.Element {
  const [tab, setTab] = useState<Tab>(tabs[0])
  const [all, setAll] = useState(false)
  const def = TABS.find((t) => t.id === tab)!
  const titleId = `bf-details-${tabs.join('-')}`
  const list = useMemo(
    () =>
      entries(snap.stats[tab])
        .filter((r) => (def.sort.get(r) ?? 0) > 0)
        .sort((a, b) => (def.sort.get(b) ?? 0) - (def.sort.get(a) ?? 0)),
    [snap, tab, def]
  )
  // Une colonne que l'API ne remplit pour aucune ligne est masquée.
  const cols = def.cols.filter((c) => list.some((r) => c.get(r) !== undefined))
  const shown = all ? list : list.slice(0, TOP)

  return (
    <section className="card-surface bf-card" aria-labelledby={titleId}>
      <header className="bf-card-head">
        <h2 id={titleId} className="bf-card-title">
          {title}
        </h2>
        <div className="seg" role="tablist" aria-label="Catégorie">
          {tabs.map((id) => TABS.find((t) => t.id === id)!).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => {
                setTab(t.id)
                setAll(false)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      {list.length === 0 ? (
        <p className="bf-text">Pas encore de données dans cette catégorie.</p>
      ) : (
        <table className="bf-table">
          <thead>
            <tr>
              <th className="bf-rank">#</th>
              <th>Nom</th>
              {cols.map((c) => (
                <th key={c.label} className="bf-n">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id}>
                <td className="bf-rank num">{i + 1}</td>
                <td>
                  <span className={`bf-row-name ${tab === 'weapons' ? '' : 'has-thumb'}`}>
                    {/* Image en échec : la place reste, pour que les noms restent alignés */}
                    {r.image && (
                      <img key={r.image} src={r.image} alt="" loading="lazy" draggable={false} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                    )}
                    {r.name}
                  </span>
                </td>
                {cols.map((c) => {
                  const v = c.get(r)
                  return (
                    <td key={c.label} className="bf-n num" title={c === COL.acc && v === undefined && r.accuracy !== undefined ? ACC_BROKEN : undefined}>
                      {v === undefined ? '–' : c.fmt(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {list.length > TOP && (
        <button className="link-btn bf-more" onClick={() => setAll((a) => !a)}>
          {all ? 'Afficher le top 10' : `Tout afficher (${list.length})`}
        </button>
      )}
    </section>
  )
}

/* ---------- classement ---------- */

type Metric = 'killDeath' | 'killsPerMinute' | 'winPercent' | 'kills' | 'secondsPlayed'

const METRICS: { id: Metric; label: string; fmt: (n: number) => string }[] = [
  { id: 'killDeath', label: 'K/D', fmt: dec.format },
  { id: 'killsPerMinute', label: 'Élim./min', fmt: dec.format },
  { id: 'winPercent', label: 'Victoires', fmt: percent },
  { id: 'kills', label: 'Éliminations', fmt: int.format },
  { id: 'secondsPlayed', label: 'Temps de jeu', fmt: duration }
]

type Entry = { account: Bf6Account; snap?: Bf6Snapshot; error?: string; me: boolean }

interface LeaderboardProps {
  tracked: Bf6Tracked
  meSnap: Bf6Snapshot | null
  meError: string | null
  meLoading: boolean
  rivals: Rivals
  onChange: (t: Bf6Tracked) => void
}

function Leaderboard({ tracked, meSnap, meError, meLoading, rivals: board, onChange }: LeaderboardProps): React.JSX.Element {
  const [metric, setMetric] = useState<Metric>('killDeath')
  const [adding, setAdding] = useState(false)
  const { data: rivals, loading, refresh } = board

  const def = METRICS.find((m) => m.id === metric)!
  const entries: Entry[] = [
    ...(tracked.me
      ? [{ account: tracked.me, snap: meSnap ?? undefined, error: meLoading ? undefined : (meError ?? (meSnap ? undefined : 'Stats indisponibles')), me: true }]
      : []),
    ...tracked.rivals.map((a) => ({ account: a, ...rivals[keyOf(a)], me: false }))
  ]
  const value = (e: Entry): number | undefined => e.snap?.stats[metric]
  const ranked = [...entries].sort((a, b) => (value(b) ?? -1) - (value(a) ?? -1))
  const max = Math.max(...ranked.map((e) => value(e) ?? 0), 0)
  // Podium dès deux joueurs classés ; la suite en liste.
  const valued = ranked.filter((e) => value(e) !== undefined)
  const podium = valued.length >= 2 ? valued.slice(0, 3) : []
  const rest = ranked.slice(podium.length)

  const remove = (a: Bf6Account): void => onChange({ ...tracked, rivals: tracked.rivals.filter((r) => keyOf(r) !== keyOf(a)) })

  return (
    <section className="card-surface bf-card" aria-labelledby="bf-board-title">
      <header className="bf-card-head">
        <h2 id="bf-board-title" className="bf-card-title">
          Classement
        </h2>
        <div className="seg" role="tablist" aria-label="Classer par">
          {METRICS.map((m) => (
            <button key={m.id} role="tab" aria-selected={metric === m.id} className={metric === m.id ? 'active' : ''} onClick={() => setMetric(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </header>

      {tracked.rivals.length === 0 && <p className="bf-text">Ajoute tes amis ou des joueurs que tu veux suivre pour te comparer à eux.</p>}

      {podium.length > 0 && (
        <ol className="bf-podium" aria-label="Podium">
          {podium.map((e, i) => {
            const name = e.snap?.stats.account.name ?? e.account.name
            return (
              <li key={keyOf(e.account)} className={`bf-step is-${i + 1} ${e.me ? 'is-me' : ''}`}>
                <span className="bf-step-avatar">
                  <Avatar name={name} url={e.snap?.stats.avatarUrl} size={i === 0 ? 64 : 52} />
                  <span className="bf-step-rank num">{i + 1}</span>
                </span>
                <span className="bf-step-name" title={name}>
                  {name}
                  {e.me && <span className="caption"> (toi)</span>}
                </span>
                <span className="bf-plat">{PLATFORM_LABEL[e.account.platform]}</span>
                <span className="bf-step-value num">{def.fmt(value(e)!)}</span>
                <span className="bf-step-block" aria-hidden="true" />
                {!e.me && (
                  <button
                    className="btn btn-ghost btn-sm bf-step-remove"
                    onClick={() => remove(e.account)}
                    aria-label={`Retirer ${name} du classement`}
                    title="Retirer"
                  >
                    <Icon name="x" size={14} />
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <ol className="bf-board" start={podium.length + 1}>
        {rest.map((e, j) => {
          const i = j + podium.length
          const v = value(e)
          const name = e.snap?.stats.account.name ?? e.account.name
          return (
            <li key={keyOf(e.account)} className={`bf-board-row ${e.me ? 'is-me' : ''}`}>
              <span className="bf-rank num">{v === undefined ? '–' : i + 1}</span>
              <Avatar name={name} url={e.snap?.stats.avatarUrl} size={32} />
              <span className="bf-board-main">
                <span className="bf-board-name">
                  {name}
                  {e.me && <span className="caption"> (toi)</span>}
                  <span className="bf-plat">{PLATFORM_LABEL[e.account.platform]}</span>
                </span>
                {v !== undefined ? (
                  <span className="bf-bar" aria-hidden="true">
                    <span style={{ width: `${max ? Math.max(3, (v / max) * 100) : 0}%` }} />
                  </span>
                ) : (
                  <span className="caption">{e.error ?? 'Chargement…'}</span>
                )}
              </span>
              <span className="bf-board-value num">{v === undefined ? '' : def.fmt(v)}</span>
              {!e.me ? (
                <button
                  className="btn btn-ghost btn-sm bf-remove"
                  onClick={() => remove(e.account)}
                  aria-label={`Retirer ${name} du classement`}
                  title="Retirer"
                >
                  <Icon name="x" size={14} />
                </button>
              ) : (
                <span className="bf-remove" />
              )}
            </li>
          )
        })}
      </ol>

      <div className="bf-board-foot">
        {adding ? (
          <>
            <PlayerSearch
              action="Ajouter"
              exclude={entries.map((e) => keyOf(e.account))}
              onPick={(a) => {
                onChange({ ...tracked, rivals: [...tracked.rivals, a] })
                setAdding(false)
              }}
            />
            <button className="link-btn muted bf-board-cancel" onClick={() => setAdding(false)}>
              Annuler
            </button>
          </>
        ) : (
          <div className="bf-board-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)} disabled={tracked.rivals.length >= 12}>
              <Icon name="plus" size={16} />
              Ajouter un joueur
            </button>
            {tracked.rivals.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
                {loading ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
                Actualiser le classement
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
