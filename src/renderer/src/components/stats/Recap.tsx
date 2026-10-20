// Bilan de session Battlefield 6 : la carte de fin de session (RecapDialog), l'encart « Dernière session » de la page
// Stats (LastSession) et l'hôte monté par App (RecapHost), qui la propose quand le processus principal l'a préparée.
import { useCallback, useEffect, useState } from 'react'
import { capitalize, plural } from '@shared/text'
import type { Bf6Art, Bf6Recap, Bf6RecapState, Game } from '@shared/types'
import { createStore, useStore } from '../../update/session'
import { Icon } from '../ui/Icon'
import { useEscape } from '../ui/Overlay'
import { useToast } from '../ui/Toasts'
import { dec, int, isBf6Game, percent, PLATFORM_LABEL, playedFor } from './bf6'
import { ClassIcon, classKind } from './ClassIcon'
import './recap.css'

const api = window.launcher

/** Un bilan non ouvert est proposé au retour dans Player X pendant 12 h. */
const OFFER_MS = 12 * 3600_000
/** Le temps de lire la carte et d'aller vers « Voir le bilan ». */
const TOAST_MS = 12_000
/** Cartes jouées montrées dans la carte du bilan (les plus jouées). */
const MAX_MAPS = 3
/** Sessions précédentes listées sous la dernière. */
const MAX_HISTORY = 5

/** Bilan affiché, un seul à la fois. */
const shown = createStore<Bf6Recap | null>(null)
/** Bilans déjà proposés ou ouverts depuis le lancement de Player X : jamais proposés deux fois. */
const offered = new Set<string>()

/** Ouvre la carte d'un bilan. Un vrai bilan ouvert n'est plus proposé. */
export function openRecap(recap: Bf6Recap): void {
  offered.add(recap.id)
  shown.set(recap)
  if (!recap.sample && !recap.seen) api.bf6RecapSeen(recap.id).catch(() => {})
}

/** Ouvre la dernière version d'un bilan (il a pu être complété depuis qu'il a été proposé). */
function openLatest(recap: Bf6Recap): void {
  api
    .bf6Recaps()
    .then(({ recaps }) => openRecap(recaps.find((r) => r.id === recap.id) ?? recap))
    .catch(() => openRecap(recap))
}

/** Exemple : chiffres fictifs, toujours présentés comme tels. */
export function sampleRecap(): Bf6Recap {
  const endedAt = Date.now() - 3 * 60_000
  return {
    id: 'sample',
    sample: true,
    account: { name: 'Exemple', platform: 'ea' },
    startedAt: endedAt - 72 * 60_000,
    endedAt,
    kills: 23,
    deaths: 15,
    assists: 9,
    revives: 4,
    matches: 3,
    wins: 2,
    losses: 1,
    secondsPlayed: 54 * 60,
    killDeath: 23 / 15,
    killsPerMinute: 23 / 54,
    vehicleKills: 4,
    average: { killDeath: 1.32, killsPerMinute: 0.38, winPercent: 51.2 },
    weapon: { name: 'M4A1', kills: 11 },
    role: { name: 'Assaut', kills: 14, seconds: 35 * 60 },
    maps: [
      { name: 'Siège du Caire', matches: 2, wins: 1 },
      { name: 'Empire State', matches: 1, wins: 1 }
    ],
    modes: [
      { name: 'Conquête', matches: 2, wins: 1 },
      { name: 'Percée', matches: 1, wins: 1 }
    ]
  }
}

// ---------- dates ----------

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** « Aujourd'hui », « Hier », « Samedi 17 octobre » */
function dayOf(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Aujourd’hui'
  if (d.toDateString() === new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString()) return 'Hier'
  return capitalize(dayFmt.format(d))
}

/** « 21:04 – 22:16 » */
const hours = (r: Pick<Bf6Recap, 'startedAt' | 'endedAt'>): string => `${timeFmt.format(r.startedAt)} – ${timeFmt.format(r.endedAt)}`

// ---------- carte du bilan ----------

/** Écart à ta moyenne : vert au-dessus, ambre en dessous. */
function Delta({ value, average, fmt }: { value: number; average: number; fmt: (n: number) => string }): React.JSX.Element {
  const diff = value - average
  const dir = Math.abs(diff) < 0.005 ? 0 : Math.sign(diff)
  return (
    <span className={`rc-delta ${dir > 0 ? 'is-up' : dir < 0 ? 'is-down' : ''}`}>
      <Icon name={dir < 0 ? 'trend-down' : 'trend'} size={14} />
      {dir === 0 ? (
        <span>
          Pile ta moyenne (<span className="num">{fmt(average)}</span>)
        </span>
      ) : (
        <>
          <b className="num">
            {dir > 0 ? '+' : '−'}
            {fmt(Math.abs(diff))}
          </b>
          <span>
            par rapport à ta moyenne (<span className="num">{fmt(average)}</span>)
          </span>
        </>
      )}
    </span>
  )
}

/** Visuel venu de gametools ; sans image (ou image en échec), le nom en filigrane. */
function Art({ image, name }: { image?: string; name: string }): React.JSX.Element {
  const [failed, setFailed] = useState<string>()
  if (!image || failed === image) return <span className="bf-weapon-ghost">{name}</span>
  return <img src={image} alt="" loading="lazy" draggable={false} onError={() => setFailed(image)} />
}

interface DialogProps {
  recap: Bf6Recap
  /** Visuel de Battlefield 6 en tête de carte. */
  art?: string
  onClose: () => void
  onOpenStats?: () => void
}

export function RecapDialog({ recap: r, art, onClose, onOpenStats }: DialogProps): React.JSX.Element {
  useEscape(true, onClose)
  const winRate = r.matches ? (r.wins / r.matches) * 100 : null
  const maps = r.maps.slice(0, MAX_MAPS)
  const sessionSeconds = Math.max(0, (r.endedAt - r.startedAt) / 1000)

  return (
    <div className="dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog rc" role="dialog" aria-modal="true" aria-labelledby="rc-title">
        <header className="rc-head">
          <div className="rc-art" aria-hidden="true">
            {art && <img src={art} alt="" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}
            <span className="rc-mark">BF6</span>
            <div className="rc-scrim" />
          </div>
          <span className="overline rc-kicker">{r.sample ? 'Exemple · bilan de session' : 'Bilan de session'}</span>
          <h2 id="rc-title" className="rc-title">
            Battlefield 6
          </h2>
          <p className="rc-meta">
            <span className="num">
              {dayOf(r.endedAt)} · {hours(r)}
            </span>
            {r.sample ? (
              <span className="rc-chip">Chiffres fictifs</span>
            ) : (
              <>
                <span className="rc-sep" aria-hidden="true" />
                <span className="rc-account">{r.account.name}</span>
                <span className="bf-plat">{PLATFORM_LABEL[r.account.platform]}</span>
              </>
            )}
          </p>
        </header>

        <div className="rc-body">
          <section className="rc-main" aria-label="La session en chiffres">
            <div className="rc-kd">
              <span className="overline">K/D de la session</span>
              <b className="rc-kd-value num">{dec.format(r.killDeath)}</b>
              <Delta value={r.killDeath} average={r.average.killDeath} fmt={dec.format} />
            </div>
            <dl className="rc-big">
              <div>
                <dt>Éliminations</dt>
                <dd className="num">{int.format(r.kills)}</dd>
                {r.vehicleKills > 0 && <span className="caption num">dont {int.format(r.vehicleKills)} en véhicule</span>}
              </div>
              <div>
                <dt>Morts</dt>
                <dd className="num">{int.format(r.deaths)}</dd>
              </div>
              <div>
                <dt>Victoires</dt>
                <dd className="num">
                  {r.matches ? (
                    <>
                      {int.format(r.wins)}
                      <small>/{int.format(r.matches)}</small>
                    </>
                  ) : (
                    '–'
                  )}
                </dd>
                <span className="caption num">
                  {winRate === null ? 'Aucune partie terminée comptée' : `${percent(winRate)} · ta moyenne ${percent(r.average.winPercent)}`}
                </span>
              </div>
            </dl>
          </section>

          <dl className="rc-tiles">
            <div className="rc-tile">
              <dt>Élim. par minute</dt>
              <dd className="num">{r.killsPerMinute ? dec.format(r.killsPerMinute) : '–'}</dd>
              <span className="caption num">ta moyenne {dec.format(r.average.killsPerMinute)}</span>
            </div>
            <div className="rc-tile">
              <dt>Assistances</dt>
              <dd className="num">{int.format(r.assists)}</dd>
            </div>
            <div className="rc-tile">
              <dt>Réanimations</dt>
              <dd className="num">{int.format(r.revives)}</dd>
            </div>
            <div className="rc-tile">
              <dt>En partie</dt>
              <dd className="num">{r.secondsPlayed >= 60 ? playedFor(r.secondsPlayed) : '–'}</dd>
              {sessionSeconds >= 60 && <span className="caption num">sur {playedFor(sessionSeconds)} de jeu ouvert</span>}
            </div>
          </dl>

          {(r.weapon || r.role) && (
            <div className="rc-pair">
              {r.weapon && (
                <article className="rc-card is-weapon">
                  <span className="rc-card-vis" aria-hidden="true">
                    <Art image={r.weapon.image} name={r.weapon.name} />
                  </span>
                  <span className="rc-card-body">
                    <span className="overline">Arme de la session</span>
                    <b className="rc-card-name" title={r.weapon.name}>
                      {r.weapon.name}
                    </b>
                    <span className="caption num">{plural(r.weapon.kills, 'élimination', 'éliminations')}</span>
                  </span>
                </article>
              )}
              {r.role && (
                <article className={`rc-card is-role is-${classKind(r.role.name)}`}>
                  <span className="rc-card-vis" aria-hidden="true">
                    <ClassIcon name={r.role.name} size={30} />
                  </span>
                  <span className="rc-card-body">
                    <span className="overline">Classe la plus jouée</span>
                    <b className="rc-card-name" title={r.role.name}>
                      {r.role.name}
                    </b>
                    <span className="caption num">
                      {[r.role.seconds >= 60 && playedFor(r.role.seconds), plural(r.role.kills, 'élimination', 'éliminations')].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </article>
              )}
            </div>
          )}

          {maps.length > 0 && (
            <section className="rc-places" aria-labelledby="rc-maps-title">
              <h3 id="rc-maps-title" className="overline">
                {maps.length > 1 ? 'Cartes jouées' : 'Carte jouée'}
                {r.modes.length > 0 && <span className="rc-modes"> · {r.modes.map((m) => m.name).join(', ')}</span>}
              </h3>
              <ul className="rc-maps">
                {maps.map((m) => (
                  <li key={m.name} className="rc-map">
                    {m.image && <img src={m.image} alt="" loading="lazy" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}
                    <span className="rc-map-shade" aria-hidden="true" />
                    <span className="rc-map-name" title={m.name}>
                      {m.name}
                    </span>
                    <span className="rc-map-line num">
                      {plural(m.matches, 'partie', 'parties')} · {plural(m.wins, 'victoire', 'victoires')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {r.partial && (
            <p className="rc-note">
              <Icon name="info" size={14} />
              Suivi à partir de {timeFmt.format(r.startedAt)} : les parties terminées avant ne sont pas comptées.
            </p>
          )}
        </div>

        <div className="dialog-actions rc-actions">
          <span className="caption rc-source">
            {r.sample ? 'Ton vrai bilan arrive quelques minutes après la fermeture du jeu.' : 'D’après gametools.network, relu après la partie.'}
          </span>
          {onOpenStats && (
            <button className="btn btn-ghost" onClick={onOpenStats}>
              Voir mes stats
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose} autoFocus>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- hôte (App) ----------

/** Visuel de Battlefield 6 : celui de la bibliothèque s'il y est, sinon celui du catalogue Steam. */
function useBf6Art(games: Game[]): string | undefined {
  const [art, setArt] = useState<Bf6Art>({})
  useEffect(() => {
    api
      .bf6Art()
      .then(setArt)
      .catch(() => {})
  }, [])
  const g = games.find(isBf6Game)
  return g?.heroUrl || art.heroUrl || g?.coverUrl
}

/** Monté une fois par App : propose les bilans prêts et affiche la carte ouverte. */
export function RecapHost({ games, onOpenStats }: { games: Game[]; onOpenStats: () => void }): React.JSX.Element | null {
  const notify = useToast()
  const recap = useStore(shown)
  const art = useBf6Art(games)

  const offer = useCallback(
    (r: Bf6Recap) => {
      if (offered.has(r.id) || shown.get()?.id === r.id) return
      offered.add(r.id)
      notify('Ton bilan Battlefield 6 est prêt', { id: 'bf6-recap', duration: TOAST_MS, action: { label: 'Voir le bilan', onClick: () => openLatest(r) } })
    },
    [notify]
  )

  useEffect(
    () =>
      api.onBf6Recap(({ recap: r, reason }) => {
        if (reason === 'open') return openRecap(r)
        if (reason === 'ready') offer(r)
        // La carte ouverte suit les chiffres complétés.
        shown.set((cur) => (cur && cur.id === r.id ? { ...r, seen: true } : cur))
      }),
    [offer]
  )

  // Bilan prêt pendant que Player X était caché ou au second plan : proposé au retour, une seule fois.
  useEffect(() => {
    const check = (): void => {
      if (!document.hasFocus()) return
      api
        .bf6Recaps()
        .then(({ recaps }) => {
          const r = recaps.find((x) => !x.seen && Date.now() - x.endedAt < OFFER_MS)
          if (r) offer(r)
        })
        .catch(() => {})
    }
    check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [offer])

  if (!recap) return null
  return (
    <RecapDialog
      recap={recap}
      art={art}
      onClose={() => shown.set(null)}
      onOpenStats={
        recap.sample
          ? undefined
          : () => {
              shown.set(null)
              onOpenStats()
            }
      }
    />
  )
}

// ---------- encart de la page Stats ----------

/** Bilans et session en cours, relus quand un jeu démarre ou s'arrête et quand un bilan arrive ou se ferme. */
function useRecapState(): Bf6RecapState | null {
  const [state, setState] = useState<Bf6RecapState | null>(null)
  useEffect(() => {
    let live = true
    const load = (): void => {
      api
        .bf6Recaps()
        .then((s) => live && setState(s))
        .catch(() => {})
    }
    load()
    const offGames = api.onGamesChanged(load)
    const offRecap = api.onBf6Recap(load)
    const offShown = shown.subscribe(load)
    return () => {
      live = false
      offGames()
      offRecap()
      offShown()
    }
  }, [])
  return state
}

/** Chiffres d'un bilan sur une ligne : « K/D 1,53 · 23 élim. · 2/3 victoires ». */
function Numbers({ r }: { r: Bf6Recap }): React.JSX.Element {
  return (
    <dl className="rc-nums">
      <div>
        <dt>K/D</dt>
        <dd className="num">{dec.format(r.killDeath)}</dd>
      </div>
      <div>
        <dt>Élim.</dt>
        <dd className="num">{int.format(r.kills)}</dd>
      </div>
      <div>
        <dt>Victoires</dt>
        <dd className="num">{r.matches ? `${int.format(r.wins)}/${int.format(r.matches)}` : '–'}</dd>
      </div>
      <div>
        <dt>En partie</dt>
        <dd className="num">{r.secondsPlayed >= 60 ? playedFor(r.secondsPlayed) : '–'}</dd>
      </div>
    </dl>
  )
}

/** « Dernière session » en tête de la vue d'ensemble : session en cours, bilan en préparation, dernier bilan et les précédents. */
export function LastSession(): React.JSX.Element | null {
  const state = useRecapState()
  if (!state?.enabled) return null
  const { pending, recaps } = state
  const [last, ...older] = recaps

  return (
    <section className="rc-last" aria-labelledby="rc-last-title">
      <div className="bf-row-head">
        <h2 id="rc-last-title" className="h-section">
          Dernière session
        </h2>
        <span className="caption">· ton bilan quand tu quittes le jeu</span>
      </div>

      {pending && (
        <p className={`rc-status ${pending.endedAt ? 'is-wait' : 'is-live'}`} role="status">
          {pending.endedAt ? <span className="spinner" aria-hidden="true" /> : <span className="rc-live-dot" aria-hidden="true" />}
          {pending.endedAt ? (
            <span>
              <b>Bilan en préparation</b> · gametools.network met parfois quelques minutes à compter tes dernières parties
            </span>
          ) : (
            <span>
              <b>En jeu depuis {timeFmt.format(pending.startedAt)}</b> · ton bilan arrive quelques minutes après la fermeture du jeu
            </span>
          )}
        </p>
      )}

      {last ? (
        <article className={`card-surface rc-last-card ${last.seen ? '' : 'is-new'}`}>
          <div className="rc-last-when">
            <span className="bf-overline">
              {dayOf(last.endedAt)}
              {!last.seen && <span className="rc-new">Nouveau</span>}
            </span>
            <span className="rc-last-hours num">{hours(last)}</span>
          </div>
          <Numbers r={last} />
          <button className="btn btn-secondary btn-sm rc-last-open" onClick={() => openRecap(last)}>
            Voir le bilan
            <Icon name="chevron-right" size={14} />
          </button>
        </article>
      ) : (
        !pending && (
          <article className="card-surface rc-last-card is-empty">
            <span className="rc-last-icon" aria-hidden="true">
              <Icon name="chart" size={20} />
            </span>
            <p className="bf-text">
              Quand tu quittes Battlefield 6, Player X compare tes stats d’avant et d’après la partie : tes éliminations, ton K/D et tes victoires de la
              session.
            </p>
            <button className="btn btn-ghost btn-sm" onClick={() => openRecap(sampleRecap())}>
              Voir un exemple
            </button>
          </article>
        )
      )}

      {older.length > 0 && (
        <ol className="rc-history" aria-label="Sessions précédentes">
          {older.slice(0, MAX_HISTORY).map((r) => (
            <li key={r.id}>
              <button className="rc-history-row" onClick={() => openRecap(r)}>
                <span className="rc-history-day">{dayOf(r.endedAt)}</span>
                <span className="caption num">{hours(r)}</span>
                <span className="rc-history-nums num">
                  K/D <b>{dec.format(r.killDeath)}</b> · <b>{int.format(r.kills)}</b> élim.
                  {r.matches > 0 && (
                    <>
                      {' '}
                      · <b>{int.format(r.wins)}</b>/{int.format(r.matches)} vict.
                    </>
                  )}
                </span>
                <Icon name="chevron-right" size={14} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
