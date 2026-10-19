import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { norm, timeAgo } from '@shared/text'
import type { Bf6Account, Bf6Art, Bf6Match, Bf6Platform, Bf6Row, Bf6Snapshot, Bf6Tracked } from '@shared/types'
import type { StatsProps } from '../../contracts'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { errorMessage } from '../ui/Toasts'
import { ClassIcon, classKind } from './ClassIcon'
import { Progress } from './Progress'
import './stats.css'

export type { StatsProps }

const api = window.launcher

const SOURCE_URL = 'https://gametools.network/stats'
const PLATFORM_LABEL: Record<Bf6Platform, string> = { ea: 'EA', pc: 'PC', steam: 'Steam', psn: 'PlayStation', xbox: 'Xbox' }
const TOP = 10

const int = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const dec = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

const keyOf = (a: Bf6Account): string => `${a.platform}:${a.personaId ?? a.name.toLowerCase()}`
const percent = (n: number): string => `${pct.format(n)} %`

/** « 312 h », « 45 min » */
function duration(seconds: number): string {
  if (seconds < 3600) return `${int.format(Math.round(seconds / 60))} min`
  return `${int.format(Math.round(seconds / 3600))} h`
}

/** Stats d'un compte, relues à la demande. */
function useBf6(account: Bf6Account | null): { snap: Bf6Snapshot | null; error: string | null; loading: boolean; refresh: () => void } {
  const [snap, setSnap] = useState<Bf6Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [doneKey, setDoneKey] = useState<string | null>(null)
  const [force, setForce] = useState(0)
  const key = account ? keyOf(account) : ''
  const lastKey = useRef(key)
  const usedForce = useRef(0)

  useEffect(() => {
    // Autre compte (ou plus de compte) : on n'affiche jamais les stats du précédent.
    if (lastKey.current !== key) {
      lastKey.current = key
      setSnap(null)
    }
    setError(null)
    if (!account) {
      setLoading(false)
      setDoneKey(null)
      return
    }
    // Seul le passage lancé par « Actualiser » contourne le cache.
    const refresh = force !== usedForce.current
    usedForce.current = force
    let live = true
    setLoading(true)
    api
      .bf6Stats(account, refresh)
      .then((s) => live && setSnap(s))
      .catch((e) => {
        if (!live) return
        setSnap(null)
        setError(errorMessage(e))
      })
      .finally(() => {
        if (!live) return
        setLoading(false)
        setDoneKey(key)
      })
    return () => {
      live = false
    }
    // Le compte compte par identité : le même compte renvoyé par le stockage ne relance rien.
  }, [key, force])

  // Tant que le compte affiché n'a reçu ni stats ni erreur, il est en cours de chargement (y compris avant le premier effet).
  const pending = !!account && doneKey !== key
  return { snap, error, loading: loading || pending, refresh: useCallback(() => setForce((n) => n + 1), []) }
}

export function Stats({ games }: StatsProps): React.JSX.Element {
  const [tracked, setTracked] = useState<Bf6Tracked | null>(null)
  const [gameArt, setGameArt] = useState<Bf6Art>({})
  const [logoFailed, setLogoFailed] = useState(false)
  const me = useBf6(tracked?.me ?? null)

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
    const g = games.find((x) => norm(x.name).includes('battlefield6'))
    return g?.heroUrl || gameArt.heroUrl || g?.coverUrl
  }, [games, gameArt])
  const logo = !logoFailed && gameArt.logoUrl

  const name = me.snap?.stats.account.name ?? tracked?.me?.name

  return (
    <div className="page bf">
      <header className={`bf-hero ${art ? 'has-art' : ''}`}>
        <div className="bf-hero-art" aria-hidden="true">
          {art && <img src={art} alt="" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}
          <span className="bf-hero-mark">BF6</span>
          <div className="bf-hero-grid" />
          <div className="bf-hero-scrim" />
        </div>

        <div className="bf-hero-body">
          {tracked?.me && name ? (
            <>
              <span className="bf-kicker-row">
                {logo && <img className="bf-logo is-small" src={logo} alt="" draggable={false} onError={() => setLogoFailed(true)} />}
                <span className="overline bf-kicker">Stats de jeu{logo ? '' : ' · Battlefield 6'}</span>
              </span>
              <PlayerIdentity account={tracked.me} name={name} state={me} onUnlink={() => save({ me: null, rivals: tracked.rivals })} />
            </>
          ) : (
            <>
              <span className="overline bf-kicker">Stats de jeu</span>
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

        {tracked?.me && me.snap && <Headline snap={me.snap} />}
        {tracked?.me && !me.snap && me.loading && <div className="skel bf-headline-skel" aria-hidden="true" />}
      </header>

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
        <>
          {(me.error || me.snap?.stale) && (
            <p className={me.error ? 'bf-error bf-banner-msg' : 'bf-warn bf-banner-msg'}>
              {me.error ?? `${me.snap?.stale} Dernières stats connues affichées.`}
            </p>
          )}
          {me.snap && (
            <>
              <Overview snap={me.snap} />
              <Progress account={tracked.me} fetchedAt={me.snap.fetchedAt} />
              <div className="bf-cols">
                <Arsenal snap={me.snap} />
                <Classes snap={me.snap} />
              </div>
              <Maps snap={me.snap} />
              <Details snap={me.snap} />
            </>
          )}
          {me.loading && !me.snap && <div className="skel bf-skel" />}
          <Leaderboard tracked={tracked} meSnap={me.snap} meError={me.error} meLoading={me.loading} onChange={save} />
        </>
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
                <span className="caption num bf-result-kills">{r.kills === null ? 'Stats indisponibles' : `${int.format(r.kills)} ${r.kills > 1 ? 'éliminations' : 'élimination'}`}</span>
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
  onUnlink
}: {
  account: Bf6Account
  name: string
  state: ReturnType<typeof useBf6>
  onUnlink: () => void
}): React.JSX.Element {
  const { snap, loading, refresh } = state
  return (
    <div className="bf-id">
      <span className="bf-id-avatar">
        <Avatar name={name} url={snap?.stats.avatarUrl} size={76} />
      </span>
      <div className="bf-id-text">
        <h1 className="bf-hero-title" title={name}>
          {name}
        </h1>
        <div className="bf-id-meta">
          <span className="bf-plat">{PLATFORM_LABEL[account.platform]}</span>
          {snap && (
            <>
              <span className="bf-meta-item">
                <span className="num">{duration(snap.stats.secondsPlayed)}</span> de jeu
              </span>
              {snap.stats.bestClass && <span className="bf-meta-item">Classe favorite : {snap.stats.bestClass}</span>}
              <span className="bf-meta-item">Mis à jour {timeAgo(snap.fetchedAt)}</span>
            </>
          )}
        </div>
        <div className="bf-id-actions">
          <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>
            {loading ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
            Actualiser
          </button>
          <button className="link-btn muted" onClick={onUnlink}>
            Changer de compte
          </button>
        </div>
      </div>
    </div>
  )
}

/** Les trois chiffres phares, en grand dans l'en-tête. */
function Headline({ snap }: { snap: Bf6Snapshot }): React.JSX.Element {
  const s = snap.stats
  return (
    <dl className="bf-headline">
      <div className="bf-headline-item is-main">
        <dt className="overline">K/D</dt>
        <dd className="num">{dec.format(s.killDeath)}</dd>
      </div>
      <div className="bf-headline-item">
        <dt className="overline">Élim./min</dt>
        <dd className="num">{dec.format(s.killsPerMinute)}</dd>
      </div>
      <div className="bf-headline-item">
        <dt className="overline">Victoires</dt>
        <dd className="num">{percent(s.winPercent)}</dd>
      </div>
    </dl>
  )
}

/* ---------- chiffres clés ---------- */

function Overview({ snap }: { snap: Bf6Snapshot }): React.JSX.Element {
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
  const top = snap.stats.weapons
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
              {w.accuracy !== undefined && (
                <span>
                  <span className="num">{percent(w.accuracy)}</span> préc.
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
  const list = snap.stats.classes.filter((c) => (c.kills ?? 0) > 0).sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0))
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
  const top = snap.stats.maps
    .filter((m) => (m.matches ?? 0) > 0)
    .sort((a, b) => (b.matches ?? 0) - (a.matches ?? 0))
    .slice(0, 4)
  if (!top.length) return null
  return (
    <section className="bf-maps" aria-labelledby="bf-maps-title">
      <h2 id="bf-maps-title" className="bf-card-title">
        Tes cartes
      </h2>
      <ol className="bf-maps-list">
        {top.map((m, i) => (
          <li key={m.id} className="bf-map">
            {m.image && <img key={m.image} src={m.image} alt="" loading="lazy" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}
            <span className="bf-map-shade" aria-hidden="true" />
            <span className="bf-map-rank num">{i + 1}</span>
            <span className="bf-map-text">
              <span className="bf-map-name">{m.name}</span>
              <span className="bf-map-stats">
                <span className="num">{int.format(m.matches ?? 0)}</span> {(m.matches ?? 0) > 1 ? 'matchs' : 'match'}
                {m.winPercent !== undefined && (
                  <>
                    {' · '}
                    <span className="num">{percent(m.winPercent)}</span> de victoires
                  </>
                )}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
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
  acc: { label: 'Précision', get: (r) => r.accuracy, fmt: percent },
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

function Details({ snap }: { snap: Bf6Snapshot }): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('weapons')
  const [all, setAll] = useState(false)
  const def = TABS.find((t) => t.id === tab)!
  const list = useMemo(
    () => snap.stats[tab].filter((r) => (def.sort.get(r) ?? 0) > 0).sort((a, b) => (def.sort.get(b) ?? 0) - (def.sort.get(a) ?? 0)),
    [snap, tab, def]
  )
  // Une colonne que l'API ne remplit pour aucune ligne est masquée.
  const cols = def.cols.filter((c) => list.some((r) => c.get(r) !== undefined))
  const shown = all ? list : list.slice(0, TOP)

  return (
    <section className="card-surface bf-card" aria-labelledby="bf-details-title">
      <header className="bf-card-head">
        <h2 id="bf-details-title" className="bf-card-title">
          Tout le détail
        </h2>
        <div className="seg" role="tablist" aria-label="Catégorie">
          {TABS.map((t) => (
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
                    {r.image && <img key={r.image} src={r.image} alt="" loading="lazy" draggable={false} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />}
                    {r.name}
                  </span>
                </td>
                {cols.map((c) => {
                  const v = c.get(r)
                  return (
                    <td key={c.label} className="bf-n num">
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
  onChange: (t: Bf6Tracked) => void
}

function Leaderboard({ tracked, meSnap, meError, meLoading, onChange }: LeaderboardProps): React.JSX.Element {
  const [metric, setMetric] = useState<Metric>('killDeath')
  const [adding, setAdding] = useState(false)
  const [rivals, setRivals] = useState<Record<string, { snap?: Bf6Snapshot; error?: string }>>({})
  const [loading, setLoading] = useState(false)
  const [force, setForce] = useState(0)
  /** Joueurs que le dernier « Actualiser le classement » doit encore relire sans cache, et relectures en cours. */
  const forced = useRef<{ force: number; pending: Set<string>; inflight: Map<string, Promise<Bf6Snapshot>> }>({
    force: 0,
    pending: new Set(),
    inflight: new Map()
  })
  const rivalKeys = tracked.rivals.map(keyOf).join('|')

  // Un joueur après l'autre : le service limite les appels rapprochés.
  useEffect(() => {
    // Seul « Actualiser le classement » contourne le cache, pour les joueurs présents au clic. Un ajout ou un retrait
    // pendant ce passage le relance : les joueurs pas encore relus le sont toujours sans cache, les nouveaux venus non.
    const keys = tracked.rivals.map(keyOf)
    if (forced.current.force !== force) forced.current = { force, pending: new Set(keys), inflight: new Map() }
    const { pending, inflight } = forced.current
    for (const k of pending) if (!keys.includes(k)) pending.delete(k)
    let live = true
    setLoading(true)
    ;(async () => {
      for (const a of tracked.rivals) {
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
          if (live) setRivals((prev) => ({ ...prev, [k]: { snap } }))
        } catch (e) {
          if (live) setRivals((prev) => ({ ...prev, [k]: { error: errorMessage(e) } }))
        }
        if (!live) return
      }
      if (live) setLoading(false)
    })()
    return () => {
      live = false
    }
  }, [rivalKeys, force])

  const def = METRICS.find((m) => m.id === metric)!
  const entries: Entry[] = [
    ...(tracked.me ? [{ account: tracked.me, snap: meSnap ?? undefined, error: meLoading ? undefined : (meError ?? (meSnap ? undefined : 'Stats indisponibles')), me: true }] : []),
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
              <button className="btn btn-ghost btn-sm" onClick={() => setForce((n) => n + 1)} disabled={loading}>
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
