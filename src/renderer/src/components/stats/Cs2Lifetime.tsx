// Counter-Strike 2 sur la page Stats : stats à vie de Valve (Steam Web API, avec ta clé) et tes matchs suivis par carte.
// Vue d'ensemble « À vie (Steam) », onglets Armes et Cartes. Les totaux mélangent CS:GO et CS2, tous modes : c'est écrit.
// Sans clé, sans compte relié, profil privé ou Steam muet : un état clair avec quoi faire, jamais de faux chiffres.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatKd, mapLabel, mapSummaries } from '@shared/cs2'
import {
  deltaOf,
  headshotPct,
  hoursOf,
  kdOf,
  mapWinPct,
  matchWinPct,
  weaponBase,
  weaponKind,
  WEAPON_KIND_LABEL,
  weaponLabel,
  type Cs2Delta,
  type WeaponKind
} from '@shared/cs2Lifetime'
import { timeAgo } from '@shared/text'
import type { Cs2Lifetime, Cs2LifetimeReason, Cs2LifetimeResult, Cs2Recap } from '@shared/types'
import type { SettingsSection } from '../../contracts'
import { Icon } from '../ui/Icon'
import { Segmented } from '../ui/Overlay'
import { errorMessage } from '../ui/Toasts'
import { int, pct, playedFor } from './bf6'

const api = window.launcher

const STEAM_PRIVACY_URL = 'https://steamcommunity.com/my/edit/settings'
const TOP = 10
const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const percent = (n: number): string => `${pct.format(n)} %`
/** Une part minuscule ne s'affiche pas « 0 % ». */
const shareOf = (n: number): string => (n > 0 && n < 0.05 ? '< 0,1 %' : percent(n))

export type OpenSettings = (section: SettingsSection) => void

// ---------- lecture ----------

export interface LifetimeState {
  data: Cs2LifetimeResult | null
  loading: boolean
  /** Relit Steam sans passer par le cache (« Réessayer », « Actualiser »). */
  reload: () => void
}

/** `demo` : le mode démo vient d'être activé ou coupé, on relit (rien n'est lu de Steam en démo). */
export function useCs2Lifetime(demo: boolean): LifetimeState {
  const [data, setData] = useState<Cs2LifetimeResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [force, setForce] = useState(0)
  useEffect(() => {
    let live = true
    setLoading(true)
    api
      .cs2Lifetime(force > 0)
      .then((r) => live && setData(r))
      .catch((e) => live && setData({ ok: false, reason: 'error', message: errorMessage(e) }))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [force, demo])
  return { data, loading, reload: useCallback(() => setForce((n) => n + 1), []) }
}

// ---------- état sans chiffres ----------

interface StateInfo {
  icon: 'info' | 'user' | 'key' | 'shield' | 'crosshair' | 'alert-circle'
  title: string
  action?: { label: string; onClick: () => void; external?: boolean }
  retry: boolean
}

function stateOf(reason: Cs2LifetimeReason, open: OpenSettings): StateInfo {
  switch (reason) {
    case 'demo':
      return { icon: 'info', title: 'Pas en mode démo', retry: false }
    case 'no-account':
      return { icon: 'user', title: 'Relie ton compte Steam', action: { label: 'Ouvrir Comptes', onClick: () => open('accounts') }, retry: true }
    case 'no-key':
      return { icon: 'key', title: 'Ajoute ta clé Steam Web API', action: { label: 'Ouvrir Avancé', onClick: () => open('advanced') }, retry: true }
    case 'key-refused':
      return { icon: 'key', title: 'Steam refuse ta clé Web API', action: { label: 'Ouvrir Avancé', onClick: () => open('advanced') }, retry: true }
    case 'private':
      return {
        icon: 'shield',
        title: 'Tes stats Steam sont privées',
        action: { label: 'Confidentialité Steam', onClick: () => void api.openExternal(STEAM_PRIVACY_URL), external: true },
        retry: true
      }
    case 'none':
      return { icon: 'crosshair', title: 'Aucune stat à vie', retry: true }
    case 'network':
      return { icon: 'alert-circle', title: 'Pas de connexion à Steam', retry: true }
    default:
      return { icon: 'alert-circle', title: 'Steam ne répond pas', retry: true }
  }
}

/** Les stats à vie ne s'affichent pas : pourquoi, et quoi faire. */
export function SteamState({ result, loading, onRetry, onOpenSettings }: { result: Extract<Cs2LifetimeResult, { ok: false }>; loading: boolean; onRetry: () => void; onOpenSettings: OpenSettings }): React.JSX.Element {
  const info = stateOf(result.reason, onOpenSettings)
  return (
    <section className="bf-card bf-cs-empty" aria-labelledby="cs-life-state-title">
      <span className="bf-cs-empty-icon" aria-hidden="true">
        <Icon name={info.icon} size={22} />
      </span>
      <div className="bf-cs-empty-text">
        <span className="bf-overline">À vie (Steam)</span>
        <h2 id="cs-life-state-title" className="bf-card-title">
          {info.title}
        </h2>
        <p className="bf-text">{result.message}</p>
      </div>
      {(info.action || info.retry) && (
        <div className="bf-cs-empty-actions">
          {info.action && (
            <button className="btn btn-secondary btn-sm" onClick={info.action.onClick}>
              {info.action.label}
              {info.action.external && <Icon name="external-link" size={14} />}
            </button>
          )}
          {info.retry && (
            <button className="btn btn-ghost btn-sm" onClick={onRetry} disabled={loading}>
              {loading ? <span className="spinner" /> : <Icon name="refresh" size={14} />}
              Réessayer
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/** Chargement, état sans chiffres, ou le contenu (avec l'avertissement si Steam n'a pas répondu cette fois). */
function WithLifetime(props: {
  state: LifetimeState
  onOpenSettings: OpenSettings
  children: (data: Extract<Cs2LifetimeResult, { ok: true }>) => React.ReactNode
}): React.JSX.Element {
  const { state, onOpenSettings, children } = props
  const { data, loading, reload } = state
  if (!data) return <div className="skel bf-skel" aria-hidden="true" />
  if (!data.ok) return <SteamState result={data} loading={loading} onRetry={reload} onOpenSettings={onOpenSettings} />
  return (
    <>
      {data.stale && (
        <p className="bf-warn bf-banner-msg">
          <Icon name="alert-triangle" size={16} />
          {data.stale} Dernières stats connues affichées.
        </p>
      )}
      {children(data)}
    </>
  )
}

/** À droite des onglets Armes et Cartes : d'où viennent les chiffres, quand, et « Actualiser ». */
export function LifetimeSide({ state }: { state: LifetimeState }): React.JSX.Element {
  const { data, loading, reload } = state
  const ok = data?.ok ? data : null
  return (
    <span className="bf-cs-source">
      {ok?.sample && <span className="bf-plat">Exemple</span>}
      Totaux Steam à vie{ok ? ` · mis à jour ${timeAgo(ok.fetchedAt)}` : ''}
      {ok && (
        <button className="icon-btn icon-btn-sm" onClick={reload} disabled={loading} aria-label="Actualiser les stats Steam" title="Actualiser les stats Steam">
          {loading ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
        </button>
      )}
    </span>
  )
}

// ---------- vue d'ensemble : à vie ----------

/** « Ces 7 derniers jours : +142 élim. · K/D 1,12 · 9 matchs (6 gagnés) · 11 h de jeu » */
function weekLine(d: Cs2Delta): string {
  const parts: string[] = []
  if (d.kills !== undefined) parts.push(`+${int.format(d.kills)} élim.`)
  if (d.kd !== null) parts.push(`K/D ${formatKd(d.kd)}`)
  if (d.kills && d.headshots !== undefined && d.headshots <= d.kills) parts.push(`${percent((d.headshots / d.kills) * 100)} de headshots`)
  if (d.matchesPlayed !== undefined) parts.push(`${int.format(d.matchesPlayed)} ${d.matchesPlayed > 1 ? 'matchs' : 'match'}${d.matchesWon !== undefined && d.matchesPlayed ? ` (${int.format(d.matchesWon)} ${d.matchesWon > 1 ? 'gagnés' : 'gagné'})` : ''}`)
  if (d.timePlayed) parts.push(`${playedFor(d.timePlayed)} de jeu`)
  return parts.join(' · ')
}

interface Tile {
  label: string
  value: string
  foot?: string
  /** Une vraie proportion (0-100), dessinée en jauge. */
  meter?: number
}

function tilesOf(s: Cs2Lifetime): Tile[] {
  const t = s.totals
  const kd = kdOf(t)
  const hs = headshotPct(t)
  const win = matchWinPct(t)
  const hours = hoursOf(t)
  const tiles: (Tile | null)[] = [
    kd === null ? null : { label: 'Ratio K/D', value: formatKd(kd), foot: `${int.format(t.kills!)} élim. · ${int.format(t.deaths!)} morts` },
    hs === null ? null : { label: 'Headshots', value: percent(hs), foot: `${int.format(t.headshots!)} sur ${int.format(t.kills!)} élim.`, meter: hs },
    win === null
      ? null
      : { label: 'Matchs gagnés', value: percent(win), foot: `${int.format(t.matchesWon!)} sur ${int.format(t.matchesPlayed!)} matchs`, meter: win },
    t.mvps === undefined ? null : { label: 'MVP', value: int.format(t.mvps), foot: t.matchesPlayed ? `${pct.format(t.mvps / t.matchesPlayed)} par match` : 'Meilleur du round' },
    hours === null ? null : { label: 'Heures de jeu', value: `${int.format(Math.round(hours))} h`, foot: 'Temps passé en partie' },
    t.plantedBombs === undefined ? null : { label: 'Bombes posées', value: int.format(t.plantedBombs) },
    t.defusedBombs === undefined ? null : { label: 'Bombes désamorcées', value: int.format(t.defusedBombs) },
    t.damage === undefined
      ? null
      : { label: 'Dégâts', value: int.format(t.damage), foot: t.roundsPlayed ? `${int.format(Math.round(t.damage / t.roundsPlayed))} par round` : undefined }
  ]
  return tiles.filter((x): x is Tile => !!x)
}

export function LifetimeCard({ state, onOpenSettings }: { state: LifetimeState; onOpenSettings: OpenSettings }): React.JSX.Element {
  return (
    <WithLifetime state={state} onOpenSettings={onOpenSettings}>
      {(data) => {
        const tiles = tilesOf(data.stats)
        const week = deltaOf(data.history, 7)
        const exact = week && week.days >= 6 && week.days <= 8
        return (
          <section className="bf-card" aria-labelledby="cs-life-title">
            <header className="bf-card-head">
              <div className="bf-cs-life-head">
                <h2 id="cs-life-title" className="bf-card-title">
                  À vie (Steam)
                  {data.sample && <span className="bf-plat">Exemple</span>}
                </h2>
                <p className="caption">Totaux de Valve depuis tes débuts : CS:GO et CS2 confondus, tous modes</p>
              </div>
              <span className="bf-cs-source">
                {data.sample ? 'Chiffres fictifs du simulateur' : `Mis à jour ${timeAgo(data.fetchedAt)}`}
                <button className="icon-btn icon-btn-sm" onClick={state.reload} disabled={state.loading} aria-label="Actualiser les stats Steam" title="Actualiser les stats Steam">
                  {state.loading ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
                </button>
              </span>
            </header>
            {tiles.length ? (
              <dl className="bf-tiles bf-cs-tiles">
                {tiles.map((t, i) => (
                  <div key={t.label} className="bf-tile" style={{ '--i': i } as React.CSSProperties}>
                    <dt className="bf-tile-label">{t.label}</dt>
                    <dd className="bf-tile-value num">{t.value}</dd>
                    {t.meter !== undefined && (
                      <dd className="bf-meter" aria-hidden="true">
                        <span style={{ '--v': Math.min(100, Math.max(0, t.meter)) / 100 } as React.CSSProperties} />
                      </dd>
                    )}
                    {t.foot && <dd className="bf-tile-foot num">{t.foot}</dd>}
                  </div>
                ))}
              </dl>
            ) : (
              <p className="bf-text">Steam a répondu, mais sans les totaux attendus. Réessaie plus tard.</p>
            )}
            {week && (
              <p className="bf-cs-week">
                <b>{exact ? 'Ces 7 derniers jours' : `Depuis le ${dayFmt.format(week.from)}`}</b>
                <span className="num">{weekLine(week) || 'aucune partie comptée par Steam'}</span>
              </p>
            )}
          </section>
        )
      }}
    </WithLifetime>
  )
}

// ---------- tableaux triables ----------

type Dir = 'asc' | 'desc'

/** En-tête de colonne qui trie : un clic trie dans le sens naturel de la colonne, un second clic inverse. */
function SortTh<K extends string>(props: { id: K; label: string; sort: { key: K; dir: Dir }; onSort: (key: K) => void; num?: boolean; className?: string }): React.JSX.Element {
  const { id, label, sort, onSort, num, className = '' } = props
  const on = sort.key === id
  const arrow = <Icon name="chevron-down" size={12} className={on && sort.dir === 'asc' ? 'is-up' : ''} />
  return (
    <th className={`${num ? 'bf-n' : ''} ${className}`} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className={`bf-sort ${on ? 'is-on' : ''}`} onClick={() => onSort(id)}>
        {/* Colonne de chiffres (alignée à droite) : la flèche avant le libellé, pour que le libellé tombe au bord des chiffres. */}
        {num && arrow}
        {label}
        {!num && arrow}
      </button>
    </th>
  )
}

function useSort<K extends string>(initial: K, natural: (k: K) => Dir): [{ key: K; dir: Dir }, (k: K) => void] {
  const [sort, setSort] = useState({ key: initial, dir: natural(initial) })
  const onSort = (key: K): void => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: natural(key) }))
  return [sort, onSort]
}

const compare = (a: number | string | null | undefined, b: number | string | null | undefined, dir: Dir): number => {
  // Valeur absente : toujours en bas.
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1
  if (b === null || b === undefined) return -1
  const c = typeof a === 'string' ? a.localeCompare(String(b), 'fr') : a - (b as number)
  return dir === 'asc' ? c : -c
}

// ---------- onglet Armes ----------

interface WeaponRow {
  id: string
  name: string
  kind: WeaponKind
  kills: number
  share: number
}

type WeaponKey = 'name' | 'kind' | 'kills' | 'share'

export function WeaponsTab({ state, onOpenSettings }: { state: LifetimeState; onOpenSettings: OpenSettings }): React.JSX.Element {
  return (
    <WithLifetime state={state} onOpenSettings={onOpenSettings}>
      {(data) => <Weapons stats={data.stats} />}
    </WithLifetime>
  )
}

function Weapons({ stats }: { stats: Cs2Lifetime }): React.JSX.Element {
  const [kind, setKind] = useState<WeaponKind | 'all'>('all')
  const [all, setAll] = useState(false)
  const [sort, onSort] = useSort<WeaponKey>('kills', (k) => (k === 'name' || k === 'kind' ? 'asc' : 'desc'))

  const rows = useMemo<WeaponRow[]>(() => {
    const ids = new Set(stats.weapons.map((w) => w.id))
    const base = weaponBase(stats)
    return stats.weapons.map((w) => ({ id: w.id, name: weaponLabel(w.id, ids), kind: weaponKind(w.id), kills: w.kills, share: base ? (w.kills / base) * 100 : 0 }))
  }, [stats])

  if (!rows.length) {
    return (
      <section className="bf-card" aria-labelledby="cs-weapons-title">
        <h2 id="cs-weapons-title" className="bf-card-title">
          Tes armes
        </h2>
        <p className="bf-text">Steam n’a envoyé aucune élimination par arme pour ton compte.</p>
      </section>
    )
  }

  const kinds = (Object.keys(WEAPON_KIND_LABEL) as WeaponKind[]).filter((k) => rows.some((r) => r.kind === k))
  const families = kinds
    .map((k) => ({ kind: k, kills: rows.filter((r) => r.kind === k).reduce((n, r) => n + r.kills, 0) }))
    .sort((a, b) => b.kills - a.kills)
  const base = weaponBase(stats)

  const value = (r: WeaponRow): number | string => (sort.key === 'name' ? r.name : sort.key === 'kind' ? WEAPON_KIND_LABEL[r.kind] : sort.key === 'kills' ? r.kills : r.share)
  const list = rows.filter((r) => kind === 'all' || r.kind === kind).sort((a, b) => compare(value(a), value(b), sort.dir) || b.kills - a.kills)
  const shown = all ? list : list.slice(0, TOP)
  const top = rows.slice(0, 3)

  return (
    <>
      <div className="bf-cols">
        <section className="bf-card" aria-labelledby="cs-fav-title">
          <header className="bf-card-head">
            <h2 id="cs-fav-title" className="bf-card-title">
              Armes favorites
            </h2>
            <span className="caption">Par éliminations, à vie</span>
          </header>
          <ol className="bf-arsenal">
            {top.map((w, i) => (
              <li key={w.id} className={`bf-weapon ${i === 0 ? 'is-first' : ''}`}>
                <span className="bf-weapon-rank num">{i + 1}</span>
                <span className="bf-weapon-art" aria-hidden="true">
                  <span className="bf-weapon-ghost">{w.name.split(' / ')[0]}</span>
                </span>
                <span className="bf-weapon-name" title={w.name}>
                  {w.name}
                </span>
                <span className="bf-weapon-stats">
                  <span>
                    <span className="num">{int.format(w.kills)}</span> élim.
                  </span>
                  <span>
                    <span className="num">{shareOf(w.share)}</span> du total
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section className="bf-card" aria-labelledby="cs-kinds-title">
          <header className="bf-card-head">
            <h2 id="cs-kinds-title" className="bf-card-title">
              Familles
            </h2>
            <span className="caption">Part de tes éliminations à vie</span>
          </header>
          <ul className="bf-classes">
            {families.map((f, i) => {
              const share = base ? (f.kills / base) * 100 : 0
              return (
                <li key={f.kind} className={`bf-class ${i === 0 ? 'is-first' : ''}`}>
                  <span className="bf-class-body">
                    <span className="bf-class-head">
                      <span className="bf-class-name">
                        {WEAPON_KIND_LABEL[f.kind]} <span className="caption num">· {int.format(f.kills)} élim.</span>
                      </span>
                      <span className="bf-class-share num">{shareOf(share)}</span>
                    </span>
                    <span className="bf-meter" aria-hidden="true">
                      <span style={{ '--v': share / 100 } as React.CSSProperties} />
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <section className="bf-card" aria-labelledby="cs-weapons-title">
        <header className="bf-card-head">
          <div className="bf-cs-life-head">
            <h2 id="cs-weapons-title" className="bf-card-title">
              Toutes tes armes
            </h2>
            <p className="caption">Valve compte certaines armes ensemble (M4A4 et M4A1-S, par exemple) : le nom le dit.</p>
          </div>
          {kinds.length > 1 && (
            <Segmented
              className="bf-seg"
              label="Famille"
              value={kind}
              options={[{ value: 'all' as const, label: 'Toutes' }, ...kinds.map((k) => ({ value: k, label: WEAPON_KIND_LABEL[k] }))]}
              onChange={(k) => {
                setKind(k)
                setAll(false)
              }}
            />
          )}
        </header>
        <table className="bf-table">
          <thead>
            <tr>
              <th className="bf-rank">#</th>
              <SortTh id="name" label="Arme" sort={sort} onSort={onSort} />
              <SortTh id="kind" label="Famille" sort={sort} onSort={onSort} className="bf-cs-col-kind" />
              <SortTh id="kills" label="Élim." sort={sort} onSort={onSort} num />
              <SortTh id="share" label="Part du total" sort={sort} onSort={onSort} num />
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id}>
                <td className="bf-rank num">{i + 1}</td>
                <td>
                  <span className="bf-row-name">{r.name}</span>
                </td>
                <td className="bf-cs-col-kind">{WEAPON_KIND_LABEL[r.kind]}</td>
                <td className="bf-n num">{int.format(r.kills)}</td>
                <td className="bf-n num">
                  <span className="bf-cs-share">
                    <span className="bf-meter" aria-hidden="true">
                      <span style={{ '--v': Math.min(1, r.share / (rows[0]?.share || 1)) } as React.CSSProperties} />
                    </span>
                    {shareOf(r.share)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length > TOP && (
          <button className="link-btn bf-more" onClick={() => setAll((a) => !a)}>
            {all ? 'Afficher le top 10' : `Tout afficher (${list.length})`}
          </button>
        )}
      </section>
    </>
  )
}

// ---------- onglet Cartes ----------

type MapKey = 'name' | 'won' | 'rounds' | 'rate'

export function MapsTab({ state, recaps, onOpenSettings }: { state: LifetimeState; recaps: Cs2Recap[]; onOpenSettings: OpenSettings }): React.JSX.Element {
  return (
    <>
      <WithLifetime state={state} onOpenSettings={onOpenSettings}>
        {(data) => <SteamMaps stats={data.stats} />}
      </WithLifetime>
      <TrackedMaps recaps={recaps} />
    </>
  )
}

function SteamMaps({ stats }: { stats: Cs2Lifetime }): React.JSX.Element {
  const [all, setAll] = useState(false)
  const [sort, onSort] = useSort<MapKey>('rounds', (k) => (k === 'name' ? 'asc' : 'desc'))
  const value = (m: Cs2Lifetime['maps'][number]): number | string | null | undefined =>
    sort.key === 'name' ? mapLabel(m.id) : sort.key === 'won' ? m.roundsWon : sort.key === 'rounds' ? m.rounds : mapWinPct(m)
  const list = [...stats.maps].sort((a, b) => compare(value(a), value(b), sort.dir) || (b.rounds ?? 0) - (a.rounds ?? 0))
  const shown = all ? list : list.slice(0, TOP)

  return (
    <section className="bf-card" aria-labelledby="cs-maps-title">
      <header className="bf-card-head">
        <div className="bf-cs-life-head">
          <h2 id="cs-maps-title" className="bf-card-title">
            Tes cartes à vie
          </h2>
          <p className="caption">Totaux Steam en rounds, pas en matchs : CS:GO et CS2 confondus, tous modes</p>
        </div>
      </header>
      {list.length === 0 ? (
        <p className="bf-text">Steam n’a envoyé aucun round par carte pour ton compte.</p>
      ) : (
        <table className="bf-table">
          <thead>
            <tr>
              <th className="bf-rank">#</th>
              <SortTh id="name" label="Carte" sort={sort} onSort={onSort} />
              <SortTh id="won" label="Rounds gagnés" sort={sort} onSort={onSort} num />
              <SortTh id="rounds" label="Rounds joués" sort={sort} onSort={onSort} num />
              <SortTh id="rate" label="Taux" sort={sort} onSort={onSort} num />
            </tr>
          </thead>
          <tbody>
            {shown.map((m, i) => {
              const rate = mapWinPct(m)
              return (
                <tr key={m.id}>
                  <td className="bf-rank num">{i + 1}</td>
                  <td>
                    <span className="bf-row-name" title={m.id}>
                      {mapLabel(m.id)}
                    </span>
                  </td>
                  <td className="bf-n num">{m.roundsWon === undefined ? '–' : int.format(m.roundsWon)}</td>
                  <td className="bf-n num">{m.rounds === undefined ? '–' : int.format(m.rounds)}</td>
                  <td className="bf-n num">
                    {rate === null ? (
                      '–'
                    ) : (
                      <span className="bf-cs-share">
                        <span className="bf-meter" aria-hidden="true">
                          <span style={{ '--v': rate / 100 } as React.CSSProperties} />
                        </span>
                        {percent(rate)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
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

function TrackedMaps({ recaps }: { recaps: Cs2Recap[] }): React.JSX.Element {
  const list = useMemo(() => mapSummaries(recaps), [recaps])
  return (
    <section className="bf-card" aria-labelledby="cs-tracked-maps-title">
      <header className="bf-card-head">
        <div className="bf-cs-life-head">
          <h2 id="cs-tracked-maps-title" className="bf-card-title">
            Tes matchs suivis par Player X
          </h2>
          <p className="caption">Par carte, d’après tes bilans gardés sur ce PC</p>
        </div>
      </header>
      {list.length === 0 ? (
        <p className="bf-text">Aucun match suivi pour l’instant : joue avec Player X ouvert, tes cartes s’ajoutent ici à la fin de chaque match.</p>
      ) : (
        <table className="bf-table">
          <thead>
            <tr>
              <th>Carte</th>
              <th className="bf-n">Matchs</th>
              <th className="bf-n">V / D</th>
              <th className="bf-n">K/D</th>
              <th className="bf-n">ADR</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.map}>
                <td>
                  <span className="bf-row-name">{mapLabel(m.map)}</span>
                </td>
                <td className="bf-n num">{int.format(m.matches)}</td>
                <td className="bf-n num">
                  {int.format(m.wins)} V · {int.format(m.losses)} D{m.ties ? ` · ${int.format(m.ties)} N` : ''}
                </td>
                <td className="bf-n num">{formatKd(m.kd)}</td>
                <td className="bf-n num">{m.adr === null ? '–' : int.format(Math.round(m.adr))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
