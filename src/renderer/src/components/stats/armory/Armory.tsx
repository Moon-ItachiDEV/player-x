// Stats › Battlefield 6 › Armurerie : les meilleures configs d'accessoires d'une arme (selon la distance ou une qualité,
// dans le budget de 100 points), et ta config avec ce qu'elle change sur le panneau de l'arme. Chaque arme est un relevé
// complet du menu de personnalisation du jeu (shared/armory/weapons) ; aucune valeur devinée.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BUDGET,
  LOWER_BETTER,
  SEARCHED,
  bestBuilds,
  buildPoints,
  computeBuild,
  defaultBuild,
  normalizeBuild,
  opticAccessories,
  pickAtt,
  slotsOf,
  timeToKill,
  type BestBuild,
  type GoalId
} from '@shared/armory/engine'
import { BAR_KEYS, BAR_LABEL, CATEGORY_LABEL, GOAL_GROUPS, GOAL_INFO, SLOT_LABEL, STAT_INFO, type Bf6ClassId } from '@shared/armory/labels'
import type { ArmoryWeapon, Build, SlotId, Stats, WeaponCategory } from '@shared/armory/types'
import { ARMORY_WEAPONS, WEAPON_IMAGE, armoryWeapon } from '@shared/armory/weapons'
import { Icon } from '../../ui/Icon'
import { Segmented, Switch } from '../../ui/Overlay'
import { PickMenu } from '../../ui/PickMenu'
import { useToast } from '../../ui/Toasts'
import { setLoadoutDraft } from '../loadouts/store'
import { AttachmentMenu, EffectChips } from './AttachmentMenu'
import './armory.css'

const SOURCE_URL = 'https://github.com/AntiPhysicsGames/battlefield6-attachment-database'
const LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr'

type Group = 'range' | 'quality'

interface Saved {
  build: Build
  locked: SlotId[]
  /** Garder au moins 30 balles (activé au départ : sinon les chargeurs de 20 gagnent toujours en mobilité). */
  min30: boolean
  suppressed: boolean
}

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
  }
}

function loadSaved(w: ArmoryWeapon): Saved {
  const raw = store.get<Partial<Saved>>(`pg.armory.${w.id}`, {})
  const locked = Array.isArray(raw.locked) ? raw.locked.filter((s): s is SlotId => (SEARCHED as string[]).includes(s)) : []
  return { build: normalizeBuild(w, raw.build), locked, min30: raw.min30 !== false, suppressed: raw.suppressed === true }
}

/** Classe dont c'est l'arme de prédilection (bonus de classe du jeu) ; Assaut pour les armes de toutes les classes. */
const CLASS_OF: Partial<Record<WeaponCategory, Bf6ClassId>> = { 'assault-rifle': 'assault', smg: 'engineer', lmg: 'support', sniper: 'recon' }

const int = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const dateFr = (iso: string): string => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const sameBuild = (a: Build, b: Build): boolean => slotsKey(a) === slotsKey(b)
const slotsKey = (b: Build): string =>
  JSON.stringify(
    Object.keys(b)
      .sort()
      .map((k) => [k, b[k as SlotId]])
  )

/** Meilleures configs, calculées après l'affichage et gardées tant que ce qui compte pour la recherche ne change pas. */
function useBest(w: ArmoryWeapon, build: Build, saved: Saved): Record<GoalId, BestBuild | null> | null {
  const cache = useRef(new Map<string, Record<GoalId, BestBuild | null>>())
  // Seules comptent les pièces que la recherche garde (optique, accessoires d'optique et de droite, ergonomie,
  // emplacements verrouillés) et les options.
  const kept: Build = {}
  for (const s of slotsOf(w)) if (!SEARCHED.includes(s) || saved.locked.includes(s)) kept[s] = build[s]
  const key = JSON.stringify([w.id, slotsKey(kept), [...saved.locked].sort(), saved.min30, saved.suppressed])
  const [result, setResult] = useState<{ key: string; best: Record<GoalId, BestBuild | null> } | null>(null)
  useEffect(() => {
    const hit = cache.current.get(key)
    if (hit) return setResult({ key, best: hit })
    const t = setTimeout(() => {
      const best = bestBuilds(w, kept, { locked: saved.locked, minMag: saved.min30 ? 30 : undefined, suppressed: saved.suppressed })
      cache.current.set(key, best)
      setResult({ key, best })
    }, 16)
    return () => clearTimeout(t)
    // `kept` et `saved` sont résumés par `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return result?.key === key ? result.best : null
}

export function Armory({ switcher, onOpenLoadouts }: { switcher: React.ReactNode; onOpenLoadouts: () => void }): React.JSX.Element {
  const notify = useToast()
  const [weaponId, setWeaponId] = useState(() => store.get<string>('pg.armory.weapon', ARMORY_WEAPONS[0].id))
  const w = armoryWeapon(weaponId) ?? ARMORY_WEAPONS[0]
  const [saved, setSavedState] = useState<Saved>(() => loadSaved(w))
  const [group, setGroup] = useState<Group>(() => (store.get<string>('pg.armory.group', 'range') === 'quality' ? 'quality' : 'range'))

  const setSaved = (next: Saved): void => {
    setSavedState(next)
    store.set(`pg.armory.${w.id}`, next)
  }
  const pickWeapon = (id: string): void => {
    const next = armoryWeapon(id)
    if (!next) return
    setWeaponId(id)
    store.set('pg.armory.weapon', id)
    setSavedState(loadSaved(next))
  }

  const build = useMemo(() => normalizeBuild(w, saved.build), [w, saved.build])
  const { base, out, beyond } = useMemo(() => computeBuild(w, build), [w, build])
  const points = buildPoints(w, build)
  const best = useBest(w, build, saved)

  const setPart = (slot: SlotId, name: string | undefined): void => {
    const next: Build = { ...build }
    if (name) next[slot] = name
    else delete next[slot]
    setSaved({ ...saved, build: normalizeBuild(w, next) })
  }
  const toggleLock = (slot: SlotId): void => setSaved({ ...saved, locked: saved.locked.includes(slot) ? saved.locked.filter((s) => s !== slot) : [...saved.locked, slot] })

  const apply = (g: GoalId, b: BestBuild): void => {
    const before = saved
    setSaved({ ...saved, build: normalizeBuild(w, b.build) })
    notify(`Config « ${GOAL_INFO[g].label} » posée sur ton ${w.name}`, {
      kind: 'success',
      id: 'armory-apply',
      action: { label: 'Annuler', onClick: () => setSaved(before) }
    })
  }

  const saveAsLoadout = (): void => {
    const parts: Record<string, { name: string; pts?: number }> = {}
    for (const s of slotsOf(w)) {
      const a = pickAtt(w, s, build[s])
      if (a) parts[s] = a.pts === null ? { name: a.name } : { name: a.name, pts: a.pts }
    }
    // Nommé d'après l'objectif dont c'est la meilleure config (« M433 longue portée »), sinon d'après l'arme.
    const goal = best ? GOAL_GROUPS.flatMap((g) => g.goals).find((g) => best[g] && sameBuild(best[g]!.build, build)) : undefined
    const name = goal ? `${w.name} ${GOAL_INFO[goal].label.toLowerCase()}` : w.name
    setLoadoutDraft({ name, weapon: w.name, armoryId: w.id, cls: CLASS_OF[w.category] ?? 'assault', parts })
    onOpenLoadouts()
  }

  const goals = GOAL_GROUPS.find((g) => g.id === group)!.goals

  return (
    <div className="ar">
      <div className="ar-top">{switcher}</div>
      <WeaponHero w={w} base={base} onPick={ARMORY_WEAPONS.length > 1 ? pickWeapon : undefined} />

      <section className="bf-card ar-best" aria-labelledby="ar-best-title">
        <header className="ar-best-head">
          <div>
            <h2 id="ar-best-title" className="bf-card-title">
              Meilleures configs
            </h2>
            <p className="caption">Toutes les combinaisons sont essayées dans le budget de {BUDGET} points. Ton optique et tes pièces verrouillées restent en place.</p>
          </div>
          <Segmented<Group>
            label="Classer les configs"
            value={group}
            onChange={(g) => {
              setGroup(g)
              store.set('pg.armory.group', g)
            }}
            options={GOAL_GROUPS.map((g) => ({ value: g.id, label: g.label }))}
          />
        </header>
        <div className="ar-opts">
          <label className="ar-opt-row">
            <Switch checked={saved.min30} onChange={(v) => setSaved({ ...saved, min30: v })} label="Garder au moins 30 balles" />
            <span>Garder au moins 30 balles</span>
          </label>
          <label className="ar-opt-row">
            <Switch checked={saved.suppressed} onChange={(v) => setSaved({ ...saved, suppressed: v })} label="Avec silencieux" />
            <span>Avec silencieux</span>
          </label>
          {saved.suppressed && saved.locked.includes('muzzle') && <span className="caption">Ta bouche est verrouillée : elle reste en place.</span>}
        </div>
        <ol className={`ar-cards is-${goals.length}`} aria-busy={!best}>
          {goals.map((g, i) => {
            const b = best?.[g] ?? null
            const twin = b ? goals.slice(0, i).find((o) => best?.[o] && sameBuild(best[o]!.build, b.build)) : undefined
            return <GoalCard key={g} goal={g} w={w} best={b} loading={!best} current={build} twin={twin} onApply={() => b && apply(g, b)} />
          })}
        </ol>
      </section>

      <section className="ar-mine" aria-labelledby="ar-mine-title">
        <div className="bf-card ar-slots">
          <header className="bf-card-head">
            <h2 id="ar-mine-title" className="bf-card-title">
              Ta config
            </h2>
            <span className="caption">Le cadenas garde une pièce pendant la recherche</span>
          </header>
          <ul className="ar-slot-list">
            {slotsOf(w).map((s) => {
              const options = s === 'optic-accessory' ? opticAccessories(w, build) : (w.attachments[s] ?? [])
              const lockable = SEARCHED.includes(s)
              const locked = saved.locked.includes(s)
              const a = pickAtt(w, s, build[s])
              return (
                <li key={s} className="ar-slot">
                  <div className="ar-slot-main">
                    <AttachmentMenu
                      slot={s}
                      options={options}
                      value={build[s]}
                      allowNone={!['optic', 'barrel', 'magazine', 'ammo'].includes(s)}
                      onPick={(name) => setPart(s, name)}
                      unavailable={s === 'optic-accessory' && !options.length ? 'Pas avec cette optique' : undefined}
                    />
                    {lockable ? (
                      <button
                        type="button"
                        className={`icon-btn ar-lock ${locked ? 'is-on' : ''}`}
                        aria-pressed={locked}
                        aria-label={`${locked ? 'Déverrouiller' : 'Verrouiller'} : ${SLOT_LABEL[s]}`}
                        title={locked ? 'Verrouillée : la recherche la garde' : 'Libre : la recherche peut la changer'}
                        onClick={() => toggleLock(s)}
                      >
                        <Icon name={locked ? 'lock' : 'unlock'} size={16} />
                      </button>
                    ) : (
                      <span className="ar-lock-gap" aria-hidden="true" />
                    )}
                  </div>
                  {a?.tags?.length ? <EffectChips tags={a.tags} /> : null}
                </li>
              )
            })}
          </ul>
          <div className="ar-mine-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={saveAsLoadout}>
              <Icon name="plus" size={16} />
              Enregistrer dans Mes loadouts
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSaved({ ...saved, build: defaultBuild(w) })}>
              Remettre la config de série
            </button>
          </div>
        </div>

        <aside className="bf-card ar-panel" aria-labelledby="ar-panel-title">
          <h3 id="ar-panel-title" className="ar-panel-title">
            Avec ta config
          </h3>
          <Points total={points.total} unknown={points.unknown} />
          <ul className="ar-bars">
            {BAR_KEYS.map((k) => (
              <Bar key={k} label={BAR_LABEL[k]} value={num(out[k]) ?? 0} stock={num(base[k]) ?? 0} over={beyond.has(k)} />
            ))}
          </ul>
          <dl className="ar-stats">
            {Object.entries(STAT_INFO)
              .filter(([k]) => num(base[k]) !== undefined)
              .map(([k, info]) => (
                <StatRow key={k} k={k} label={info.label} fmt={info.fmt} value={num(out[k])!} stock={num(base[k])!} over={beyond.has(k)} />
              ))}
            {typeof base.reload_in_ads === 'boolean' && (
              <div className="ar-stat">
                <dt>Recharger en visant</dt>
                <dd className={out.reload_in_ads !== base.reload_in_ads ? 'is-up' : ''}>{out.reload_in_ads ? 'Oui' : 'Non'}</dd>
              </div>
            )}
          </dl>
          <Ttk out={out} />
        </aside>
      </section>

      <section className="ar-method" aria-label="Méthode et sources">
        <p className="caption">
          Relevés de la{' '}
          <button type="button" className="link-btn" onClick={() => void window.launcher.openExternal(SOURCE_URL)}>
            BF6 Attachment Database
          </button>{' '}
          d’AntiPhysicsGames, sous{' '}
          <button type="button" className="link-btn" onClick={() => void window.launcher.openExternal(LICENSE_URL)}>
            licence CC BY-NC-SA 4.0
          </button>
          . Image de l’arme : gametools.network.
        </p>
        <details className="ar-details">
          <summary>Comment c’est calculé</summary>
          <p>
            Chaque accessoire est relevé seul sur l’arme de série, dans le menu du jeu. Une config les additionne comme le jeu : le temps de visée, la sortie de sprint, la vitesse
            en visant et la hanche avancent par crans sur l’échelle du jeu ; contrôle, précision, mobilité et vitesse de la balle s’additionnent ; le recul se compte en crans. Le
            panneau du jeu arrondit ses valeurs : une barre peut tomber à un point près.
          </p>
          <p>
            Ce que le panneau ne chiffre pas (recul qui monte en rafale, balancement, discrétion) n’entre pas dans le classement : ces effets s’affichent en pastilles. Le temps
            pour tuer suppose 100 points de vie et toutes les balles au but, avec les dégâts de près et au plus loin affichés par le jeu.
          </p>
        </details>
      </section>
    </div>
  )
}

/* ---------- l'arme ---------- */

function WeaponHero({ w, base, onPick }: { w: ArmoryWeapon; base: Stats; onPick?: (id: string) => void }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const image = WEAPON_IMAGE[w.id]
  const facts: [string, string][] = []
  if (num(base.rof)) facts.push(['Cadence', `${int.format(num(base.rof)!)} coups/min`])
  if (num(base.mag)) facts.push(['Chargeur', `${int.format(num(base.mag)!)} balles`])
  if (num(base.dmg))
    facts.push(['Dégâts', num(base.long_range_dmg) ? `${int.format(num(base.dmg)!)} de près, ${int.format(num(base.long_range_dmg)!)} au plus loin` : int.format(num(base.dmg)!)])
  if (num(base.ads_time_in_ms)) facts.push(['Visée', STAT_INFO.ads_time_in_ms.fmt(num(base.ads_time_in_ms)!)])
  return (
    <section className="ar-hero" aria-labelledby="ar-hero-title">
      <div className="ar-hero-art" aria-hidden="true">
        {image && !failed ? <img src={image} alt="" draggable={false} onError={() => setFailed(true)} /> : <span className="ar-hero-ghost">{w.name}</span>}
      </div>
      <div className="ar-hero-text">
        <span className="bf-overline">{CATEGORY_LABEL[w.category]}</span>
        <h2 id="ar-hero-title" className="ar-hero-title">
          {w.name}
        </h2>
        <p className="caption">
          Relevé en jeu le {dateFr(w.captured)}
          {ARMORY_WEAPONS.length === 1 && ' · Une seule arme pour l’instant : chaque arme demande un relevé complet de ses accessoires.'}
        </p>
        <dl className="ar-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className="num">{v}</dd>
            </div>
          ))}
        </dl>
        {onPick && <PickMenu label="Arme" value={w.id} options={ARMORY_WEAPONS.map((x) => ({ value: x.id, label: x.name, hint: CATEGORY_LABEL[x.category] }))} onPick={onPick} />}
      </div>
    </section>
  )
}

/* ---------- meilleures configs ---------- */

/** Les deux chiffres qui comptent pour chaque objectif. */
const GOAL_KEYS: Record<GoalId, string[]> = {
  close: ['hipfire', 'mobility'],
  mid: ['control', 'precision'],
  long: ['control', 'muzzle_velocity'],
  control: ['control', 'recoil_amount_deg'],
  ads: ['ads_time_in_ms', 'mobility'],
  hipfire: ['hipfire', 'mobility'],
  balanced: ['bars', 'ads_time_in_ms']
}

function keyFigure(k: string, o: Stats): { label: string; value: string } {
  if (k === 'bars') return { label: 'Les 4 barres', value: int.format(BAR_KEYS.reduce((s, b) => s + (num(o[b]) ?? 0), 0)) }
  if (k in BAR_LABEL) return { label: BAR_LABEL[k as keyof typeof BAR_LABEL], value: int.format(num(o[k]) ?? 0) }
  const info = STAT_INFO[k]
  return { label: info.label, value: info.fmt(num(o[k]) ?? 0) }
}

interface GoalCardProps {
  goal: GoalId
  w: ArmoryWeapon
  best: BestBuild | null
  loading: boolean
  current: Build
  /** Objectif précédent de la rangée qui donne la même config. */
  twin?: GoalId
  onApply: () => void
}

function GoalCard({ goal, w, best, loading, current, twin, onApply }: GoalCardProps): React.JSX.Element {
  const info = GOAL_INFO[goal]
  const mine = best ? sameBuild(best.build, current) : false
  return (
    <li className={`ar-card ${mine ? 'is-mine' : ''}`}>
      <header className="ar-card-head">
        <h3 className="ar-card-title">{info.label}</h3>
        <span className="caption">{info.hint}</span>
      </header>
      {loading ? (
        <div className="skel ar-card-skel" />
      ) : !best ? (
        <p className="caption ar-card-none">Aucune config ne tient dans {BUDGET} points avec tes pièces verrouillées.</p>
      ) : (
        <>
          <div className="ar-figs">
            {GOAL_KEYS[goal].map((k) => {
              const f = keyFigure(k, best.out)
              return (
                <div key={k} className="ar-fig">
                  <span className="ar-fig-value num">{f.value}</span>
                  <span className="ar-fig-label">{f.label}</span>
                </div>
              )
            })}
          </div>
          <ul className="ar-parts">
            {SEARCHED.filter((s) => (w.attachments[s]?.length ?? 0) > 0).map((s) => {
              const a = pickAtt(w, s, best.build[s])
              const changed = best.build[s] !== current[s]
              return (
                <li key={s} className={`ar-part ${changed ? 'is-changed' : ''}`}>
                  <span className="ar-part-slot">{SLOT_LABEL[s]}</span>
                  <span className="ar-part-name">{a?.name ?? 'Aucun'}</span>
                  <span className="ar-part-pts num">{a?.pts ?? 0}</span>
                </li>
              )
            })}
          </ul>
          <footer className="ar-card-foot">
            <span className="ar-card-total num">
              {best.pts}
              <span> / {BUDGET} points</span>
            </span>
            {mine ? (
              <span className="ar-card-mine">
                <Icon name="check" size={16} />
                C’est ta config
              </span>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onApply}>
                Utiliser cette config
              </button>
            )}
          </footer>
          {twin && <p className="caption ar-card-twin">Même config que « {GOAL_INFO[twin].label} ».</p>}
          <p className="ar-card-rule">{info.rule}</p>
        </>
      )}
    </li>
  )
}

/* ---------- panneau de l'arme ---------- */

function Points({ total, unknown }: { total: number; unknown: boolean }): React.JSX.Element {
  const over = total > BUDGET
  return (
    <div className={`ar-points ${over ? 'is-over' : ''}`}>
      <span className="ar-points-value num">
        {total}
        <span> / {BUDGET} points</span>
      </span>
      <span className="ar-meter" aria-hidden="true">
        <span style={{ '--v': Math.min(1, total / BUDGET) } as React.CSSProperties} />
      </span>
      {over && <span className="ar-points-warn">Au-dessus de {BUDGET} points : le jeu ne laisse pas monter cette config.</span>}
      {unknown && <span className="caption">Une pièce n’a pas de points relevés.</span>}
    </div>
  )
}

function delta(k: string, value: number, stock: number): { text: string; tone: 'up' | 'down' } | null {
  const d = +(value - stock).toFixed(3)
  if (!d) return null
  const better = LOWER_BETTER.has(k) ? d < 0 : d > 0
  const info = STAT_INFO[k]
  const mag = info ? info.fmt(Math.abs(d)).replace(/^×\s*/, '') : int.format(Math.abs(d))
  return { text: `${d > 0 ? '+' : '−'}${mag}`, tone: better ? 'up' : 'down' }
}

function Bar({ label, value, stock, over }: { label: string; value: number; stock: number; over: boolean }): React.JSX.Element {
  const d = delta('bar', value, stock)
  return (
    <li className="ar-bar">
      <span className="ar-bar-label">{label}</span>
      <span className="ar-bar-value num">
        {over ? '≥ ' : ''}
        {int.format(value)}
      </span>
      {d ? <span className={`ar-delta is-${d.tone} num`}>{d.text}</span> : <span className="ar-delta" />}
      <span className="ar-bar-track" aria-hidden="true">
        <span className="ar-bar-fill" style={{ '--v': Math.max(0, Math.min(1, value / 100)) } as React.CSSProperties} />
        <span className="ar-bar-stock" style={{ '--v': Math.max(0, Math.min(1, stock / 100)) } as React.CSSProperties} />
      </span>
    </li>
  )
}

function StatRow({ k, label, fmt, value, stock, over }: { k: string; label: string; fmt: (v: number) => string; value: number; stock: number; over: boolean }): React.JSX.Element {
  const d = delta(k, value, stock)
  return (
    <div className="ar-stat">
      <dt>{label}</dt>
      <dd>
        <span className="num">
          {over ? (LOWER_BETTER.has(k) ? '≤ ' : '≥ ') : ''}
          {fmt(value)}
        </span>
        {d && <span className={`ar-delta is-${d.tone} num`}>{d.text}</span>}
      </dd>
    </div>
  )
}

function Ttk({ out }: { out: Stats }): React.JSX.Element | null {
  const rows: { label: string; body: ReturnType<typeof timeToKill>; head: ReturnType<typeof timeToKill> }[] = [
    { label: 'De près', body: timeToKill(out, 'close'), head: timeToKill(out, 'close', true) },
    { label: 'Au plus loin', body: timeToKill(out, 'far'), head: timeToKill(out, 'far', true) }
  ]
  if (!rows.some((r) => r.body)) return null
  const cell = (t: ReturnType<typeof timeToKill>): React.JSX.Element =>
    t ? (
      <>
        <span className="num">{int.format(t.ms)} ms</span>
        <span className="caption num">
          {t.shots} balle{t.shots > 1 ? 's' : ''}
        </span>
      </>
    ) : (
      <span className="caption">—</span>
    )
  return (
    <div className="ar-ttk">
      <h3 className="ar-panel-title">Temps pour tuer</h3>
      <table>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Distance</span>
            </th>
            <th scope="col">Au corps</th>
            <th scope="col">À la tête</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{cell(r.body)}</td>
              <td>{cell(r.head)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
