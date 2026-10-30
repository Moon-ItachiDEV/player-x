import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CS2_GAME_ID } from '@shared/cs2'
import { timeAgo } from '@shared/text'
import type { Bf6Account, Bf6Art, Bf6Match, Bf6Point, Bf6Row, Bf6Snapshot, Bf6Tracked } from '@shared/types'
import type { StatsProps } from '../../contracts'
import { useCs2 } from '../cs2/useCs2'
import { TopSlot } from '../TopTabs'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { Segmented } from '../ui/Overlay'
import { errorMessage } from '../ui/Toasts'
import {
  dec,
  duration,
  inWindow,
  int,
  isBf6Game,
  keyOf,
  loadStatsGame,
  pct,
  percent,
  periodOf,
  PLATFORM_LABEL,
  saveStatsGame,
  type StatsGame,
  useBf6,
  useBf6History
} from './bf6'
import { ClassIcon, classKind } from './ClassIcon'
import { Cs2Stats } from './Cs2Stats'
import { Chart, Progress, RANGE_DAYS, type Range } from './Progress'
import { LastSession } from './Recap'
import { StatsTabs } from './StatsTabs'
import './stats.css'

export type { StatsProps }

const api = window.launcher

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

/** Écart signé : « +0,05 », « −0,12 ». */
const signed = (n: number): string => `${n >= 0 ? '+' : '−'}${dec.format(Math.abs(n))}`

/** Page Stats de jeu : Battlefield 6 (gametools.network) et, quand le suivi est actif, Counter-Strike 2 (envoyé par le jeu). */
export function Stats({ games, onOpenSettings }: StatsProps): React.JSX.Element {
  const cs2 = useCs2()
  const [game, setGame] = useState<StatsGame>(loadStatsGame)
  const [gameArt, setGameArt] = useState<Bf6Art>({})

  useEffect(() => {
    api
      .bf6Art()
      .then(setGameArt)
      .catch(() => {})
  }, [])

  // Visuel de Battlefield 6 : celui de la bibliothèque s'il y est, sinon celui du catalogue Steam.
  const bf6Art = useMemo(() => {
    const g = games.find(isBf6Game)
    return g?.heroUrl || gameArt.heroUrl || g?.coverUrl
  }, [games, gameArt])
  // Pastille Counter-Strike 2 : l'icône de son succès Steam (« Un nouveau départ », le soldat sur fond bleu et jaune),
  // lisible dans un petit rond ; à défaut (pas de compte Steam ou de clé), le visuel de la bibliothèque.
  const [cs2Badge, setCs2Badge] = useState<string>()
  useEffect(() => {
    let alive = true
    api
      .getAchievements(CS2_GAME_ID)
      .then((a) => alive && setCs2Badge(a.list.find((x) => x.icon)?.icon))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const cs2Art = useMemo(() => {
    const g = games.find((x) => x.id === CS2_GAME_ID)
    return cs2Badge || g?.heroUrl || g?.coverUrl
  }, [games, cs2Badge])

  // CS2 n'a sa vue que si son suivi est activé (Paramètres) ; tant que son état n'est pas lu, rien n'est choisi à sa place.
  const cs2On = !!cs2.state?.enabled
  const shown: StatsGame | null = game === 'cs2' ? (cs2.state ? (cs2On ? 'cs2' : 'bf6') : null) : 'bf6'

  const pickGame = (next: StatsGame): void => {
    if (next === shown) return
    setGame(next)
    saveStatsGame(next)
    document.querySelector('.content')?.scrollTo({ top: 0 })
  }

  return (
    <div className="page bf">
      <h1 className="sr-only">Stats de jeu</h1>
      <StatsTop
        value={shown}
        onChange={pickGame}
        choices={
          cs2On
            ? [
                { id: 'bf6', label: 'Battlefield 6', art: bf6Art },
                { id: 'cs2', label: 'Counter-Strike 2', art: cs2Art }
              ]
            : null
        }
      />
      {shown === 'bf6' && <Bf6Stats art={bf6Art} logo={gameArt.logoUrl} />}
      {shown === 'cs2' && cs2.state && <Cs2Stats state={cs2.state} live={cs2.live} onOpenSettings={onOpenSettings} />}
      {shown === null && <div className="skel bf-skel" />}
    </div>
  )
}

/* ---------- barre du haut : titre et choix du jeu ---------- */

interface GameChoice {
  id: StatsGame
  label: string
  art?: string
}

function StatsTop({ value, onChange, choices }: { value: StatsGame | null; onChange: (g: StatsGame) => void; choices: GameChoice[] | null }): React.JSX.Element | null {
  const slot = useContext(TopSlot)
  if (!slot) return null
  return createPortal(
    <div className="bf-top">
      <p className="tb-title">Stats de jeu</p>
      {choices && (
        <div className="bf-games" role="group" aria-label="Jeu">
          {choices.map((c) => (
            <button key={c.id} type="button" className="bf-game" aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
              <span className={`bf-game-thumb is-${c.id}`} aria-hidden="true">
                {c.art && <img src={c.art} alt="" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}
              </span>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>,
    slot
  )
}

/* ---------- Battlefield 6 ---------- */

function Bf6Stats({ art, logo: logoUrl }: { art?: string; logo?: string }): React.JSX.Element {
  const [tracked, setTracked] = useState<Bf6Tracked | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)
  const [tab, setTab] = useState<StatsTab>(loadTab)
  const me = useBf6(tracked?.me ?? null)
  const rivals = useRivals(tracked?.rivals ?? [])
  const history = useBf6History(tracked?.me ?? null, me.snap?.fetchedAt)

  useEffect(() => {
    api.bf6GetTracked().then(setTracked)
  }, [])

  const save = useCallback(async (next: Bf6Tracked) => setTracked(await api.bf6SetTracked(next)), [])
  const logo = !logoFailed ? logoUrl : undefined

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

  const snap = me.snap

  return (
    <>
      {tracked?.me && (
        <StatsTabs<StatsTab>
          label="Stats Battlefield 6"
          idBase="bf"
          value={tab}
          onChange={pick}
          tabs={[
            { id: 'overview', label: 'Vue d’ensemble' },
            { id: 'progress', label: 'Progression' },
            { id: 'arsenal', label: 'Arsenal' },
            { id: 'maps', label: 'Cartes et modes' },
            { id: 'board', label: 'Classement', badge: standing ? ordinal(standing.rank) : undefined }
          ]}
        >
          <PlayerIdentity account={tracked.me} name={snap?.stats.account.name ?? tracked.me.name} state={me} onUnlink={() => save({ me: null, rivals: tracked.rivals })} />
        </StatsTabs>
      )}

      {!tracked ? (
        <div className="skel bf-skel" />
      ) : !tracked.me ? (
        <section className="bf-card bf-link" aria-labelledby="bf-link-title">
          <div className="bf-link-art" aria-hidden="true">
            {art && <img src={art} alt="" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}
            {logo ? <img className="bf-logo" src={logo} alt="" draggable={false} onError={() => setLogoFailed(true)} /> : <span className="bf-link-mark">BF6</span>}
          </div>
          <div className="bf-link-body">
            <span className="bf-overline">Battlefield 6</span>
            <h2 id="bf-link-title" className="bf-link-title">
              Relie ton profil Battlefield 6
            </h2>
            <p className="bf-text">Entre ton pseudo EA (celui affiché en jeu). Player X retrouve ton compte, même si tu joues sur Steam, PlayStation ou Xbox.</p>
            <PlayerSearch action="C’est moi" onPick={(a) => save({ me: a, rivals: tracked.rivals })} />
          </div>
        </section>
      ) : (
        <div id="bf-panel" className="bf-panel" role="tabpanel" aria-labelledby={`bf-tab-${tab}`}>
          {(me.error || snap?.stale) && (
            <p className={me.error ? 'bf-error bf-banner-msg' : 'bf-warn bf-banner-msg'}>
              <Icon name="alert-triangle" size={16} />
              {me.error ?? `${snap?.stale} Dernières stats connues affichées.`}
            </p>
          )}
          {tab === 'board' ? (
            <Leaderboard tracked={tracked} meSnap={snap} meError={me.error} meLoading={me.loading} rivals={rivals} onChange={save} />
          ) : snap ? (
            <>
              {tab === 'overview' && (
                <>
                  <KpiRow snap={snap} history={history} standing={standing} onOpenBoard={() => pick('board')} />
                  <div className="bf-duo">
                    <KdCard history={history} onOpen={() => pick('progress')} />
                    <LastSession art={art} />
                  </div>
                  <Favorites snap={snap} onOpen={pick} />
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
    </>
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
    next: { name: other.stats.account.name, kd: other.stats.killDeath, ahead: i > 0 }
  }
}

/* ---------- profil relié (à droite des onglets) ---------- */

function PlayerIdentity({ account, name, state, onUnlink }: { account: Bf6Account; name: string; state: ReturnType<typeof useBf6>; onUnlink: () => void }): React.JSX.Element {
  const { snap, loading, refresh } = state
  return (
    <div className="bf-id">
      <Avatar name={name} url={snap?.stats.avatarUrl} size={28} />
      <span className="bf-id-text">
        <span className="bf-id-name" title={name}>
          {name}
        </span>
        <span className="bf-plat">{PLATFORM_LABEL[account.platform]}</span>
        {snap && <span className="bf-id-when">· mis à jour {timeAgo(snap.fetchedAt)}</span>}
      </span>
      <button className="icon-btn icon-btn-sm bf-id-refresh" onClick={refresh} disabled={loading} aria-label="Actualiser les stats" title="Actualiser les stats">
        {loading ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
      </button>
      <button className="link-btn muted bf-id-unlink" onClick={onUnlink}>
        Changer de compte
      </button>
    </div>
  )
}

/* ---------- vue d'ensemble : chiffres phares ---------- */

function KpiRow(props: { snap: Bf6Snapshot; history: Bf6Point[] | null; standing: Standing | null; onOpenBoard: () => void }): React.JSX.Element {
  const { snap, history, standing, onOpenBoard } = props
  const s = snap.stats
  const points = history ? inWindow(history, 30) : []
  const month = periodOf(points)
  const kpmChange = points.length >= 2 ? points.at(-1)!.killsPerMinute - points[0].killsPerMinute : null
  const trend = (n: number): string => (n > 0.005 ? 'is-up' : n < -0.005 ? 'is-down' : '')

  return (
    <section className="bf-kpis" aria-label="Chiffres phares">
      <div className="bf-kpi" style={{ '--i': 0 } as React.CSSProperties}>
        <span className="bf-kpi-value num">{dec.format(s.killDeath)}</span>
        <span className="bf-kpi-label">Ratio K/D</span>
        {month ? (
          <span className={`bf-kpi-foot num ${trend(month.kdChange)}`}>
            <Icon name={month.kdChange < -0.005 ? 'trend-down' : 'trend'} size={14} />
            {signed(month.kdChange)} sur 30 jours
          </span>
        ) : (
          <span className="bf-kpi-foot num">
            {int.format(s.kills)} élim. · {int.format(s.deaths)} morts
          </span>
        )}
        {standing && (
          <button className="bf-kpi-rank" onClick={onOpenBoard}>
            <b className="num">{ordinal(standing.rank)}</b> sur {standing.total}
            {standing.next && (
              <span className="bf-kpi-rank-next">
                {' · '}
                {standing.next.ahead ? 'derrière' : 'devant'} {standing.next.name} (<span className="num">{dec.format(standing.next.kd)}</span>)
              </span>
            )}
            <Icon name="chevron-right" size={14} />
          </button>
        )}
      </div>
      <div className="bf-kpi" style={{ '--i': 1 } as React.CSSProperties}>
        <span className="bf-kpi-value num">{dec.format(s.killsPerMinute)}</span>
        <span className="bf-kpi-label">Éliminations par minute</span>
        {kpmChange !== null ? (
          <span className={`bf-kpi-foot num ${trend(kpmChange)}`}>
            <Icon name={kpmChange < -0.005 ? 'trend-down' : 'trend'} size={14} />
            {signed(kpmChange)} sur 30 jours
          </span>
        ) : (
          <span className="bf-kpi-foot num">{int.format(s.kills)} éliminations</span>
        )}
      </div>
      <div className="bf-kpi" style={{ '--i': 2 } as React.CSSProperties}>
        <span className="bf-kpi-value num">{percent(s.winPercent)}</span>
        <span className="bf-kpi-label">Victoires</span>
        <span className="bf-kpi-foot num">
          {int.format(s.matches)} {s.matches > 1 ? 'matchs' : 'match'} · {int.format(s.wins)} V · {int.format(s.losses)} D
        </span>
      </div>
      <div className="bf-kpi" style={{ '--i': 3 } as React.CSSProperties}>
        <span className="bf-kpi-value num">{duration(s.secondsPlayed)}</span>
        <span className="bf-kpi-label">Temps de jeu</span>
        <span className="bf-kpi-foot num">{s.matches ? `${int.format(Math.round(s.secondsPlayed / 60 / s.matches))} min par match` : '–'}</span>
      </div>
    </section>
  )
}

/** Courbe du K/D (un relevé par jour, gardé sur ce PC) et sa période. */
function KdCard({ history, onOpen }: { history: Bf6Point[] | null; onOpen: () => void }): React.JSX.Element {
  const [range, setRange] = useState<Range>('30')
  const points = useMemo(() => (history ? inWindow(history, RANGE_DAYS[range]) : []), [history, range])

  return (
    <section className="bf-card bf-kd" aria-labelledby="bf-kd-title">
      <header className="bf-card-head">
        <h2 id="bf-kd-title" className="bf-card-title">
          Ton K/D
        </h2>
        {history && history.length >= 2 && (
          <Segmented
            className="bf-seg"
            label="Période"
            value={range}
            options={[
              { value: '7', label: '7 j' },
              { value: '30', label: '30 j' },
              { value: 'all', label: 'Depuis le début' }
            ]}
            onChange={setRange}
          />
        )}
      </header>
      <div className="bf-kd-plot">
        {!history ? (
          <div className="skel bf-kd-skel" />
        ) : points.length >= 2 ? (
          <Chart key={`${range}:${points.length}`} points={points} metric="kd" fill />
        ) : (
          <p className="bf-kd-empty bf-text">
            {history.length >= 2
              ? 'Pas encore deux relevés sur cette période : choisis « Depuis le début » pour voir toute ta courbe.'
              : history.length
                ? 'Premier relevé enregistré. Reviens demain : ta courbe se dessine à raison d’un relevé par jour.'
                : 'Ta courbe commence aujourd’hui : Player X garde un relevé de tes stats chaque jour.'}
          </p>
        )}
      </div>
      <p className="bf-kd-foot caption">
        <button className="link-btn bf-kd-more" onClick={onOpen}>
          Voir la progression
          <Icon name="chevron-right" size={14} />
        </button>
      </p>
    </section>
  )
}

/* ---------- vue d'ensemble : favoris (le meilleur de chaque onglet) ---------- */

function Favorites({ snap, onOpen }: { snap: Bf6Snapshot; onOpen: (t: StatsTab) => void }): React.JSX.Element | null {
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
  if (!weapon && !topClass && !map) return null

  return (
    <section className="bf-favs" aria-label="Tes favoris">
      {weapon && (
        <FavCard
          label="Arme favorite"
          name={weapon.name}
          hint="Voir l’arsenal"
          onOpen={() => onOpen('arsenal')}
          line={[`${int.format(weapon.kills ?? 0)} élim.`, weapon.kpm !== undefined && `${dec.format(weapon.kpm)} /min`, accuracyOf(weapon) !== undefined && `${percent(accuracyOf(weapon)!)} préc.`]}
        >
          <span className="bf-fav-vis is-weapon">
            <WeaponArt image={weapon.image} name={weapon.name} />
          </span>
        </FavCard>
      )}
      {topClass && (
        <FavCard
          label="Classe favorite"
          name={topClass.name}
          hint="Voir les classes"
          onOpen={() => onOpen('arsenal')}
          line={[
            `${percent(classTotal ? ((topClass.kills ?? 0) / classTotal) * 100 : 0)} des élim.`,
            topClass.killDeath !== undefined && `K/D ${dec.format(topClass.killDeath)}`,
            topClass.secondsPlayed !== undefined && duration(topClass.secondsPlayed)
          ]}
        >
          <span className={`bf-fav-vis is-class is-${classKind(topClass.name)}`}>
            <ClassIcon name={topClass.name} size={24} />
          </span>
        </FavCard>
      )}
      {map && (
        <FavCard
          label="Carte la plus jouée"
          name={map.name}
          hint="Voir les cartes et modes"
          onOpen={() => onOpen('maps')}
          line={[`${int.format(map.matches ?? 0)} ${(map.matches ?? 0) > 1 ? 'matchs' : 'match'}`, map.winPercent !== undefined && `${percent(map.winPercent)} de victoires`]}
        >
          <span className="bf-fav-vis is-map">{map.image && <img src={map.image} alt="" loading="lazy" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}</span>
        </FavCard>
      )}
    </section>
  )
}

function FavCard(props: { label: string; name: string; line: (string | false | undefined)[]; hint: string; onOpen: () => void; children: React.ReactNode }): React.JSX.Element {
  const { label, name, line, hint, onOpen, children } = props
  return (
    <button className="bf-fav" onClick={onOpen} title={hint}>
      {children}
      <span className="bf-fav-text">
        <span className="bf-overline">{label}</span>
        <span className="bf-fav-name">{name}</span>
        <span className="bf-fav-line num">{line.filter(Boolean).join(' · ')}</span>
        <span className="sr-only">, {hint}</span>
      </span>
      <Icon name="chevron-right" size={16} className="bf-fav-go" />
    </button>
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
    { label: 'Précision', value: percent(s.accuracy), foot: 'Tirs touchés', meter: s.accuracy },
    { label: 'Tirs à la tête', value: percent(s.headshots), foot: 'Des éliminations', meter: s.headshots },
    { label: 'Réanimations', value: int.format(s.revives), foot: 'Coéquipiers relevés' },
    { label: 'Assistances', value: int.format(s.assists), foot: s.matches ? `${dec.format(s.assists / s.matches)} par match` : '–' }
  ]
  return (
    <section className="bf-card bf-keys" aria-labelledby="bf-keys-title">
      <h2 id="bf-keys-title" className="bf-card-title">
        Chiffres clés
      </h2>
      <dl className="bf-tiles">
        {tiles.map((t, i) => (
          <div key={t.label} className="bf-tile" style={{ '--i': i } as React.CSSProperties}>
            <dt className="bf-tile-label">{t.label}</dt>
            <dd className="bf-tile-value num">{t.value}</dd>
            {t.meter !== undefined && (
              <dd className="bf-meter" aria-hidden="true">
                <span style={{ '--v': Math.min(100, Math.max(0, t.meter)) / 100 } as React.CSSProperties} />
              </dd>
            )}
            <dd className="bf-tile-foot num">{t.foot}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ---------- recherche d'un joueur ---------- */

function PlayerSearch(props: { action: string; onPick: (a: Bf6Account) => void; exclude?: string[]; autoFocus?: boolean }): React.JSX.Element {
  const { action, onPick, exclude = [], autoFocus } = props
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
          autoFocus={autoFocus}
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
    <section className="bf-card" aria-labelledby="bf-arsenal-title">
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
    <section className="bf-card" aria-labelledby="bf-classes-title">
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
                  <span style={{ '--v': share / 100 } as React.CSSProperties} />
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
    <section className="bf-card" aria-labelledby={titleId}>
      <header className="bf-card-head">
        <h2 id={titleId} className="bf-card-title">
          {title}
        </h2>
        <div className="seg bf-seg" role="tablist" aria-label="Catégorie">
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

type Metric = 'killDeath' | 'killsPerMinute' | 'winPercent' | 'kills' | 'revives' | 'secondsPlayed'

/** Joueurs suivis au plus (le processus principal applique la même limite). */
const MAX_RIVALS = 12

/** Écart signé, sans signe quand il s'arrondit à zéro : « +0,37 », « −1 204 », « 0,00 ». */
const gapWith =
  (fmt: (n: number) => string) =>
  (d: number): string => {
    const t = fmt(Math.abs(d))
    return /[1-9]/.test(t) ? `${d > 0 ? '+' : '−'}${t}` : t
  }

interface MetricDef {
  id: Metric
  label: string
  fmt: (n: number) => string
  /** Écart avec toi, dans l'unité du critère. */
  gap: (d: number) => string
}

const METRICS: MetricDef[] = [
  { id: 'killDeath', label: 'K/D', fmt: dec.format, gap: gapWith(dec.format) },
  { id: 'killsPerMinute', label: 'Élim./min', fmt: dec.format, gap: gapWith(dec.format) },
  // Écart de deux pourcentages : en points.
  { id: 'winPercent', label: 'Victoires', fmt: percent, gap: gapWith((n) => `${pct.format(n)} pt${n >= 2 ? 's' : ''}`) },
  { id: 'kills', label: 'Éliminations', fmt: int.format, gap: gapWith(int.format) },
  // Réanimations de coéquipiers (demande de Breezydev, 0.9.7-beta.3) : le total, comme les éliminations.
  { id: 'revives', label: 'Réanimations', fmt: int.format, gap: gapWith(int.format) },
  { id: 'secondsPlayed', label: 'Temps de jeu', fmt: duration, gap: gapWith(duration) }
]

type Entry = { key: string; name: string; account: Bf6Account; snap?: Bf6Snapshot; error?: string; me: boolean }

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
  const solo = tracked.rivals.length === 0
  const full = tracked.rivals.length >= MAX_RIVALS
  const entryOf = (account: Bf6Account, me: boolean, rest: { snap?: Bf6Snapshot; error?: string }): Entry => ({
    key: keyOf(account),
    name: rest.snap?.stats.account.name ?? account.name,
    account,
    me,
    ...rest
  })
  const entries: Entry[] = [
    ...(tracked.me
      ? [entryOf(tracked.me, true, { snap: meSnap ?? undefined, error: meLoading ? undefined : (meError ?? (meSnap ? undefined : 'Stats indisponibles')) })]
      : []),
    ...tracked.rivals.map((a) => entryOf(a, false, rivals[keyOf(a)] ?? {}))
  ]
  const value = (e: Entry): number => e.snap!.stats[metric]
  // Classés : les joueurs dont les stats sont lues. Les autres (chargement, erreur) suivent, sans rang.
  const ranked = entries.filter((e) => e.snap).sort((a, b) => value(b) - value(a))
  const unranked = entries.filter((e) => !e.snap)
  const podium = ranked.length >= 2 ? ranked.slice(0, 3) : []
  const mine = meSnap?.stats[metric]
  const fetched = entries.flatMap((e) => (e.snap ? [e.snap.fetchedAt] : []))
  // La lecture la plus ancienne : c'est elle qui dit à quel point le classement est frais.
  const oldest = fetched.length ? Math.min(...fetched) : null
  const busy = loading || meLoading

  const remove = (a: Bf6Account): void => onChange({ ...tracked, rivals: tracked.rivals.filter((r) => keyOf(r) !== keyOf(a)) })
  const add = (a: Bf6Account): void => {
    onChange({ ...tracked, rivals: [...tracked.rivals, a] })
    setAdding(false)
  }

  return (
    <section className="bf-card bf-lb" aria-labelledby="bf-board-title">
      <header className="bf-lb-head">
        <div className="bf-lb-heading">
          <h2 id="bf-board-title" className="bf-card-title">
            Classement
          </h2>
          {(!solo || oldest !== null) && (
            <p className="bf-lb-meta">
              {solo ? `Mis à jour ${timeAgo(oldest!)}` : `${entries.length} joueurs${oldest !== null ? `, mis à jour ${timeAgo(oldest)}` : ''}`}
            </p>
          )}
        </div>
        {!solo && (
          <div className="bf-lb-actions">
            <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={busy} aria-label="Actualiser le classement">
              {busy ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
              Actualiser
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setAdding(true)}
              disabled={full || adding}
              title={full ? `${MAX_RIVALS} joueurs suivis au maximum : retires-en un pour en ajouter un autre.` : undefined}
            >
              <Icon name="plus" size={16} />
              Ajouter un joueur
            </button>
          </div>
        )}
      </header>

      {adding && (
        <div className="bf-lb-add">
          <p className="bf-lb-add-title">Ajouter un joueur au classement</p>
          <PlayerSearch action="Ajouter" exclude={entries.map((e) => e.key)} onPick={add} autoFocus />
          <button className="link-btn muted bf-lb-cancel" onClick={() => setAdding(false)}>
            Annuler
          </button>
        </div>
      )}

      {solo ? (
        !adding && (
          <div className="bf-lb-empty">
            <span className="bf-lb-empty-av" aria-hidden="true">
              <Avatar name={entries[0]?.name ?? '?'} url={meSnap?.stats.avatarUrl} size={56} />
            </span>
            <div className="bf-lb-empty-text">
              <h3 className="bf-lb-empty-title">Personne à battre pour l’instant</h3>
              {meSnap && (
                <p className="bf-lb-empty-mine">
                  Tes chiffres à battre : <b className="num">{dec.format(meSnap.stats.killDeath)}</b> de K/D, <b className="num">{dec.format(meSnap.stats.killsPerMinute)}</b>{' '}
                  élim./min et <b className="num">{percent(meSnap.stats.winPercent)}</b> de victoires.
                </p>
              )}
              <p className="bf-text">
                Ajoute tes amis ou des joueurs croisés en partie avec leur pseudo EA. Player X vous classe au K/D, aux éliminations par minute, aux victoires, aux
                éliminations, aux réanimations et au temps de jeu.
              </p>
              <button className="btn btn-primary" onClick={() => setAdding(true)}>
                <Icon name="plus" size={16} />
                Ajouter un joueur
              </button>
            </div>
          </div>
        )
      ) : (
        <>
          <div className="bf-lb-by">
            <span className="bf-lb-by-label" aria-hidden="true">
              Classer par
            </span>
            <Segmented
              className="bf-seg"
              label="Classer par"
              value={metric}
              options={METRICS.map((m) => ({ value: m.id, label: m.label }))}
              onChange={setMetric}
            />
          </div>

          {podium.length > 0 && (
            <ol className={`bf-lb-podium has-${podium.length}`} aria-label={`Podium au critère ${def.label}`}>
              {podium.map((e, i) => (
                <li key={e.key} className={`bf-lb-step is-${i + 1} ${e.me ? 'is-me' : ''}`}>
                  <span className="sr-only">{ordinal(i + 1)} : </span>
                  <span className="bf-lb-step-av">
                    <Avatar name={e.name} url={e.snap?.stats.avatarUrl} size={i === 0 ? 72 : 56} />
                  </span>
                  <span className="bf-lb-step-name" title={e.name}>
                    {e.name}
                  </span>
                  <span className="bf-lb-step-sub">
                    {e.me && <span className="bf-lb-you">toi</span>}
                    <span className="bf-plat">{PLATFORM_LABEL[e.account.platform]}</span>
                  </span>
                  <span className="bf-lb-pillar">
                    <span className="bf-lb-step-value num">{def.fmt(value(e))}</span>
                    <span className="bf-lb-step-label">{def.label}</span>
                    <span className="bf-lb-step-rank num" aria-hidden="true">
                      {i + 1}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className="bf-lb-scroll" role="region" aria-label="Tableau du classement" tabIndex={0}>
            <table className="bf-lb-table">
              <caption className="sr-only">Tous les joueurs, classés par {def.label}</caption>
              <thead>
                <tr>
                  <th scope="col" className="bf-lb-rank">
                    <span aria-hidden="true">#</span>
                    <span className="sr-only">Rang</span>
                  </th>
                  <th scope="col">Joueur</th>
                  {METRICS.map((m) => {
                    const on = m.id === metric
                    return (
                      <th key={m.id} scope="col" className={`bf-lb-n ${on ? 'is-on' : ''}`} aria-sort={on ? 'descending' : 'none'}>
                        <button className={`bf-sort ${on ? 'is-on' : ''}`} onClick={() => setMetric(m.id)}>
                          <Icon name="chevron-down" size={12} />
                          {m.label}
                        </button>
                      </th>
                    )
                  })}
                  <th scope="col" className="bf-lb-n bf-lb-gap" title={`Sur le critère choisi : ${def.label}`}>
                    Écart avec toi
                  </th>
                  <th scope="col" className="bf-lb-x">
                    <span className="sr-only">Retirer</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...ranked, ...unranked].map((e, i) => {
                  const rank = e.snap ? i + 1 : null
                  const s = e.snap?.stats
                  const d = s && mine !== undefined && !e.me ? s[metric] - mine : null
                  return (
                    <tr key={e.key} className={e.me ? 'is-me' : ''}>
                      <td className="bf-lb-rank num">
                        <span className={`bf-lb-place ${rank && rank <= 3 ? `is-${rank}` : ''}`}>{rank ?? '–'}</span>
                      </td>
                      <td>
                        <span className="bf-lb-player">
                          <Avatar name={e.name} url={s?.avatarUrl} size={36} />
                          <span className="bf-lb-who">
                            <span className="bf-lb-name-line">
                              <span className="bf-lb-name" title={e.name}>
                                {e.name}
                              </span>
                              {e.me && <span className="bf-lb-you">toi</span>}
                              {e.snap?.stale && (
                                <span className="bf-lb-stale" title={`${e.snap.stale} Dernières stats connues.`}>
                                  <Icon name="alert-triangle" size={14} />
                                  <span className="sr-only">Stats d’une lecture précédente</span>
                                </span>
                              )}
                            </span>
                            <span className="bf-lb-sub">
                              {PLATFORM_LABEL[e.account.platform]}
                              {s && `, ${int.format(s.matches)} ${s.matches > 1 ? 'matchs' : 'match'}`}
                            </span>
                          </span>
                        </span>
                      </td>
                      {s ? (
                        <>
                          {METRICS.map((m) => (
                            <td key={m.id} className={`bf-lb-n num ${m.id === metric ? 'is-on' : ''}`}>
                              {m.fmt(s[m.id])}
                            </td>
                          ))}
                          <td className="bf-lb-n bf-lb-gap num">
                            {d === null ? (
                              <span className="bf-lb-none">–</span>
                            ) : (
                              <span className={d > 0 ? 'is-ahead' : d < 0 ? 'is-behind' : ''} title={d > 0 ? 'Devant toi' : d < 0 ? 'Derrière toi' : 'À égalité avec toi'}>
                                {def.gap(d)}
                              </span>
                            )}
                          </td>
                        </>
                      ) : e.error ? (
                        <td colSpan={METRICS.length + 1} className="bf-lb-error">
                          <span>
                            <Icon name="alert-triangle" size={14} />
                            {e.error}
                          </span>
                        </td>
                      ) : (
                        // Chargement : une barre par chiffre, écart compris.
                        Array.from({ length: METRICS.length + 1 }, (_, j) => (
                          <td key={j} className="bf-lb-n" aria-hidden={j > 0 || undefined}>
                            <span className="skel bf-lb-skel" />
                            {j === 0 && <span className="sr-only">Chargement…</span>}
                          </td>
                        ))
                      )}
                      <td className="bf-lb-x">
                        {!e.me && (
                          <button className="icon-btn icon-btn-sm bf-lb-remove" onClick={() => remove(e.account)} aria-label={`Retirer ${e.name} du classement`} title="Retirer">
                            <Icon name="x" size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
