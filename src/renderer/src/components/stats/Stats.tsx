import { useCallback, useEffect, useMemo, useState } from 'react'
import { norm, timeAgo } from '@shared/text'
import type { Bf6Account, Bf6Match, Bf6Platform, Bf6Row, Bf6Snapshot, Bf6Tracked } from '@shared/types'
import type { StatsProps } from '../../contracts'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { errorMessage } from '../ui/Toasts'
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
  const [force, setForce] = useState(0)
  const key = account ? keyOf(account) : ''

  useEffect(() => {
    if (!account) return
    let live = true
    setLoading(true)
    setError(null)
    api
      .bf6Stats(account, force > 0)
      .then((s) => live && setSnap(s))
      .catch((e) => {
        if (!live) return
        setSnap(null)
        setError(errorMessage(e))
      })
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
    // Le compte compte par identité : le même compte renvoyé par le stockage ne relance rien.
  }, [key, force])

  return { snap, error, loading, refresh: useCallback(() => setForce((n) => n + 1), []) }
}

export function Stats({ games }: StatsProps): React.JSX.Element {
  const [tracked, setTracked] = useState<Bf6Tracked | null>(null)
  const me = useBf6(tracked?.me ?? null)

  useEffect(() => {
    api.bf6GetTracked().then(setTracked)
  }, [])

  const save = useCallback(async (next: Bf6Tracked) => setTracked(await api.bf6SetTracked(next)), [])

  // Visuel du jeu quand Battlefield 6 est dans la bibliothèque.
  const art = useMemo(() => {
    const g = games.find((x) => norm(x.name).includes('battlefield6'))
    return g?.heroUrl || g?.coverUrl
  }, [games])

  return (
    <div className="page bf">
      <header className="bf-head">
        <div className={`bf-banner ${art ? 'has-art' : ''}`} aria-hidden="true">
          {art && <img src={art} alt="" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}
          <div className="bf-banner-tint" />
        </div>
        <div className="bf-head-text">
          <span className="overline">Stats de jeu</span>
          <h1 className="display-l">Battlefield 6</h1>
        </div>
      </header>

      {!tracked ? (
        <div className="skel bf-skel" />
      ) : !tracked.me ? (
        <section className="card-surface bf-card bf-link">
          <h2 className="bf-card-title">Relie ton profil Battlefield 6</h2>
          <p className="bf-text">Entre ton pseudo EA (celui affiché en jeu). Player X retrouve ton compte, même si tu joues sur Steam, PlayStation ou Xbox.</p>
          <PlayerSearch action="C’est moi" onPick={(a) => save({ me: a, rivals: tracked.rivals })} />
        </section>
      ) : (
        <>
          <PlayerHeader account={tracked.me} state={me} onUnlink={() => save({ me: null, rivals: tracked.rivals })} />
          {me.snap && (
            <>
              <Overview snap={me.snap} />
              <Details snap={me.snap} />
            </>
          )}
          {me.loading && !me.snap && <div className="skel bf-skel" />}
          <Leaderboard tracked={tracked} meSnap={me.snap} onChange={save} />
        </>
      )}

      <p className="caption bf-source">
        Statistiques fournies par{' '}
        <button className="link-btn" onClick={() => api.openExternal(SOURCE_URL)}>
          gametools.network
        </button>
        , un service communautaire non officiel : EA ne propose pas d’API publique pour Battlefield 6. Player X n’est ni affilié à EA ni à DICE.
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
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pseudo EA exact" maxLength={64} aria-label="Pseudo Battlefield 6" spellCheck={false} />
        <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
          {busy ? <span className="spinner" /> : <Icon name="search" size={16} />}
          Chercher
        </button>
      </form>
      {error && <p className="bf-error">{error}</p>}
      {results && results.length === 0 && (
        <p className="bf-text">Aucun joueur trouvé avec ce pseudo exact. Vérifie l’orthographe, majuscules comprises. Si tu viens de chercher, réessaie dans 30 secondes.</p>
      )}
      {results && results.length > 0 && (
        <ul className="bf-results">
          {results.map((r) => {
            const taken = exclude.includes(keyOf(r))
            return (
              <li key={keyOf(r)} className="bf-result">
                <span className="bf-result-name">{r.name}</span>
                <span className="bf-plat">{PLATFORM_LABEL[r.platform]}</span>
                <span className="caption num bf-result-kills">{r.kills === null ? 'Stats indisponibles' : `${int.format(r.kills)} éliminations`}</span>
                <button className="btn btn-secondary btn-sm" disabled={taken} onClick={() => onPick({ name: r.name, platform: r.platform, personaId: r.personaId, nucleusId: r.nucleusId })}>
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

function PlayerHeader({ account, state, onUnlink }: { account: Bf6Account; state: ReturnType<typeof useBf6>; onUnlink: () => void }): React.JSX.Element {
  const { snap, error, loading, refresh } = state
  const name = snap?.stats.account.name ?? account.name
  return (
    <section className="bf-player" aria-label="Joueur">
      <Avatar name={name} url={snap?.stats.avatarUrl} size={56} />
      <div className="bf-player-text">
        <h2 className="bf-player-name" title={name}>
          {name}
        </h2>
        <p className="caption">
          <span className="bf-plat">{PLATFORM_LABEL[account.platform]}</span>
          {snap && (
            <>
              {' · '}
              {duration(snap.stats.secondsPlayed)} de jeu{snap.stats.bestClass && ` · Classe favorite : ${snap.stats.bestClass}`}
              {' · '}Mis à jour {timeAgo(snap.fetchedAt)}
            </>
          )}
        </p>
        {snap?.stale && <p className="bf-warn">{snap.stale} Dernières stats connues affichées.</p>}
        {error && <p className="bf-error">{error}</p>}
      </div>
      <div className="bf-player-actions">
        <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>
          {loading ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
          Actualiser
        </button>
        <button className="link-btn muted" onClick={onUnlink}>
          Changer de compte
        </button>
      </div>
    </section>
  )
}

/* ---------- chiffres clés ---------- */

function Overview({ snap }: { snap: Bf6Snapshot }): React.JSX.Element {
  const s = snap.stats
  const tiles: { label: string; value: string; foot: string }[] = [
    { label: 'K/D', value: dec.format(s.killDeath), foot: `${int.format(s.deaths)} morts` },
    { label: 'Éliminations / min', value: dec.format(s.killsPerMinute), foot: 'Par minute de jeu' },
    { label: 'Victoires', value: percent(s.winPercent), foot: `${int.format(s.wins)} V · ${int.format(s.losses)} D` },
    { label: 'Matchs', value: int.format(s.matches), foot: `${duration(s.secondsPlayed)} de jeu` },
    { label: 'Éliminations', value: int.format(s.kills), foot: `${int.format(s.assists)} assistances` },
    { label: 'Précision', value: percent(s.accuracy), foot: 'Tirs touchés' },
    { label: 'Tirs à la tête', value: percent(s.headshots), foot: 'Des éliminations' },
    { label: 'Réanimations', value: int.format(s.revives), foot: 'Coéquipiers relevés' }
  ]
  return (
    <section className="bf-tiles" aria-label="Chiffres clés">
      {tiles.map((t) => (
        <div key={t.label} className="card-surface bf-tile">
          <span className="overline">{t.label}</span>
          <span className="bf-tile-value num">{t.value}</span>
          <span className="caption num">{t.foot}</span>
        </div>
      ))}
    </section>
  )
}

/* ---------- détails ---------- */

type Tab = 'weapons' | 'vehicles' | 'classes' | 'modes' | 'maps'

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
  { id: 'classes', label: 'Classes', cols: [COL.kills, COL.kd, COL.kpm, COL.time], sort: COL.kills },
  { id: 'modes', label: 'Modes', cols: [COL.matches, COL.win, COL.kills, COL.kd], sort: COL.matches },
  { id: 'maps', label: 'Cartes', cols: [COL.matches, COL.win, COL.time], sort: COL.matches }
]

function Details({ snap }: { snap: Bf6Snapshot }): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('weapons')
  const [all, setAll] = useState(false)
  const def = TABS.find((t) => t.id === tab)!
  const list = useMemo(
    () =>
      snap.stats[tab]
        .filter((r) => (def.sort.get(r) ?? 0) > 0)
        .sort((a, b) => (def.sort.get(b) ?? 0) - (def.sort.get(a) ?? 0)),
    [snap, tab, def]
  )
  // Une colonne que l'API ne remplit pour aucune ligne est masquée.
  const cols = def.cols.filter((c) => list.some((r) => c.get(r) !== undefined))
  const shown = all ? list : list.slice(0, TOP)

  return (
    <section className="card-surface bf-card" aria-labelledby="bf-details-title">
      <header className="bf-card-head">
        <h2 id="bf-details-title" className="bf-card-title">
          Détails
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
                  <span className="bf-row-name">
                    {r.image && <img src={r.image} alt="" loading="lazy" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}
                    {r.name}
                  </span>
                </td>
                {cols.map((c) => {
                  const v = c.get(r)
                  return (
                    <td key={c.label} className="bf-n num">
                      {v === undefined ? '—' : c.fmt(v)}
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

function Leaderboard({ tracked, meSnap, onChange }: { tracked: Bf6Tracked; meSnap: Bf6Snapshot | null; onChange: (t: Bf6Tracked) => void }): React.JSX.Element {
  const [metric, setMetric] = useState<Metric>('killDeath')
  const [adding, setAdding] = useState(false)
  const [rivals, setRivals] = useState<Record<string, { snap?: Bf6Snapshot; error?: string }>>({})
  const [loading, setLoading] = useState(false)
  const [force, setForce] = useState(0)
  const rivalKeys = tracked.rivals.map(keyOf).join('|')

  // Un joueur après l'autre : le service limite les appels rapprochés.
  useEffect(() => {
    let live = true
    setLoading(true)
    ;(async () => {
      for (const a of tracked.rivals) {
        const k = keyOf(a)
        try {
          const snap = await api.bf6Stats(a, force > 0)
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
    ...(tracked.me ? [{ account: tracked.me, snap: meSnap ?? undefined, me: true }] : []),
    ...tracked.rivals.map((a) => ({ account: a, ...rivals[keyOf(a)], me: false }))
  ]
  const value = (e: Entry): number | undefined => e.snap?.stats[metric]
  const ranked = [...entries].sort((a, b) => (value(b) ?? -1) - (value(a) ?? -1))
  const max = Math.max(...ranked.map((e) => value(e) ?? 0), 0)

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

      <ol className="bf-board">
        {ranked.map((e, i) => {
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
                <button className="btn btn-ghost btn-sm bf-remove" onClick={() => remove(e.account)} aria-label={`Retirer ${name} du classement`} title="Retirer">
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
          <PlayerSearch
            action="Ajouter"
            exclude={entries.map((e) => keyOf(e.account))}
            onPick={(a) => {
              onChange({ ...tracked, rivals: [...tracked.rivals, a] })
              setAdding(false)
            }}
          />
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
