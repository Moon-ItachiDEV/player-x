// Bilan d'un match de Counter-Strike 2 : la carte de fin de match (Cs2RecapDialog) et l'hôte monté par App
// (Cs2RecapHost), qui la propose quand le processus principal l'a préparée. Même charpente que le bilan Battlefield 6
// (classes .recap-* de stats/recap.css) ; ce qui est propre à CS2 (frise des rounds, résultat) est en .cs2-.
import { useCallback, useEffect, useRef } from 'react'
import { CS2_GAME_ID, formatKd, killDeath, longestStreak, mapLabel, modeLabel, RESULT_LABEL } from '@shared/cs2'
import { plural } from '@shared/text'
import type { Cs2Recap, Cs2Round, Cs2RoundEnd, Game } from '@shared/types'
import { useStore } from '../../update/session'
import { Icon } from '../ui/Icon'
import { useEscape } from '../ui/Overlay'
import { useToast } from '../ui/Toasts'
import { dayOf, minutes, openCs2Recap, shownCs2, timeFmt } from './useCs2'
import '../stats/recap.css'
import './cs2.css'
import { useLeave } from '../../motion'
import { CountUp } from '../ui/CountUp'

const api = window.launcher

/** Un bilan non ouvert est proposé au retour dans Player X pendant 12 h. */
const OFFER_MS = 12 * 3600_000
const TOAST_MS = 12_000

const int = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

const END_ICON: Record<Cs2RoundEnd, 'crosshair' | 'bomb' | 'defuse' | 'clock' | 'users' | 'check'> = {
  elimination: 'crosshair',
  bomb: 'bomb',
  defuse: 'defuse',
  time: 'clock',
  hostage: 'users',
  other: 'check'
}
const END_LABEL: Record<Cs2RoundEnd, string> = {
  elimination: 'élimination',
  bomb: 'bombe',
  defuse: 'bombe désamorcée',
  time: 'temps écoulé',
  hostage: 'otages',
  other: 'fin du round'
}

/** Bilans déjà proposés ou ouverts depuis le lancement de Player X : jamais proposés deux fois. */
const offered = new Set<string>()

/** « Victoire » en vert, « Défaite » en rouge, les autres en gris. */
export function ResultTag({ r, big }: { r: Pick<Cs2Recap, 'result'>; big?: boolean }): React.JSX.Element {
  return <span className={`cs2-res is-${r.result} ${big ? 'is-big' : ''}`}>{RESULT_LABEL[r.result]}</span>
}

function roundTitle(r: Cs2Round): string {
  const head = r.side ? (r.side === r.winner ? 'gagné' : 'perdu') : `gagné par les ${r.winner}`
  const kills = r.kills !== undefined ? ` · ${plural(r.kills, 'élimination', 'éliminations')}` : ''
  return `Round ${r.n} · ${head} (${END_LABEL[r.end]})${r.side ? ` · tu étais ${r.side}` : ''}${kills}`
}

/** Frise des rounds : gagné (vert), perdu (rouge), camp inconnu (gris). Un filet sépare les changements de camp. */
function Strip({ rounds }: { rounds: Cs2Round[] }): React.JSX.Element {
  const streak = longestStreak(rounds)
  const sides = rounds.map((r) => r.side).filter(Boolean)
  return (
    <section className="cs2-strip-wrap" aria-labelledby="cs2-strip-title">
      <div className="cs2-strip-head">
        <h3 id="cs2-strip-title" className="overline">
          Rounds
          {sides.length > 0 && <span className="cs2-strip-sides"> · tu commences {sides[0]}</span>}
        </h3>
        {streak >= 2 && <span className="caption num">Plus longue série : {streak} rounds gagnés</span>}
      </div>
      <ol className="cs2-strip num">
        {rounds.map((r, i) => {
          const prev = rounds[i - 1]
          const swap = !!prev?.side && !!r.side && prev.side !== r.side
          const tone = !r.side ? 'is-unknown' : r.side === r.winner ? 'is-won' : 'is-lost'
          return (
            <li key={r.n} className={`cs2-r ${tone} ${swap ? 'is-swap' : ''}`} title={roundTitle(r)}>
              <Icon name={END_ICON[r.end]} size={12} />
              <span className="cs2-r-k">{r.kills ?? ''}</span>
            </li>
          )
        })}
      </ol>
      <p className="cs2-legend caption">
        <span>
          <Icon name="crosshair" size={12} />
          Élimination
        </span>
        <span>
          <Icon name="bomb" size={12} />
          Bombe
        </span>
        <span>
          <Icon name="defuse" size={12} />
          Désamorcée
        </span>
        <span>
          <Icon name="clock" size={12} />
          Temps écoulé
        </span>
        <span>Le chiffre : tes éliminations du round</span>
      </p>
    </section>
  )
}

function multiLine(m: Cs2Recap['multi']): string {
  return [m.k3 && `${m.k3} × 3K`, m.k4 && `${m.k4} × 4K`, m.k5 && plural(m.k5, 'ace', 'aces')].filter(Boolean).join(' · ')
}

interface DialogProps {
  recap: Cs2Recap
  /** Visuel de CS2 en tête de carte. */
  art?: string
  onClose: () => void
}

export function Cs2RecapDialog({ recap: r, art, onClose }: DialogProps): React.JSX.Element {
  // Fermeture : sortie animée (motion.ts useLeave), puis onClose.
  const scrim = useRef<HTMLDivElement>(null)
  const close = useLeave(scrim, onClose)
  useEscape(true, close)
  const kd = killDeath(r)
  const hsPct = r.trackedKills > 0 ? (r.headshots / r.trackedKills) * 100 : null
  const adr = r.hasRounds && r.roundsTracked > 0 ? r.damage / r.roundsTracked : null
  const multi = multiLine(r.multi)
  const played = r.score ? r.score.us + r.score.them : r.rounds.length

  return (
    <div ref={scrim} className="dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog recap cs2-recap" role="dialog" aria-modal="true" aria-labelledby="cs2-recap-title">
        <header className="recap-head">
          <div className="recap-art" aria-hidden="true">
            {art && <img src={art} alt="" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />}
            <span className="recap-mark">CS2</span>
            <div className="recap-scrim" />
          </div>
          <span className="overline recap-kicker">
            {r.sample ? 'Exemple · bilan de match' : 'Bilan de match'} · {modeLabel(r.mode)}
          </span>
          <h2 id="cs2-recap-title" className="recap-title cs2-recap-title">
            {mapLabel(r.map)}
            <ResultTag r={r} big />
            {r.score && (
              <span className="cs2-recap-score num">
                {r.score.us}–{r.score.them}
              </span>
            )}
          </h2>
          <p className="recap-meta">
            <span className="num">
              {dayOf(r.endedAt)} · {timeFmt.format(r.startedAt)} – {timeFmt.format(r.endedAt)}
            </span>
            <span className="recap-sep" aria-hidden="true" />
            <span className="num">{minutes(r.endedAt - r.startedAt)}</span>
            {r.hasRounds && played > 0 && (
              <>
                <span className="recap-sep" aria-hidden="true" />
                <span className="num">{plural(played, 'round', 'rounds')}</span>
              </>
            )}
            {r.sample && <span className="recap-chip">Chiffres fictifs</span>}
          </p>
        </header>

        <div className="recap-body">
          <section className="recap-main" aria-label="Le match en chiffres">
            <div className="recap-kd">
              <span className="overline">K/D du match</span>
              <b className="recap-kd-value num">
                <CountUp value={kd} format={formatKd} />
              </b>
              <span className="recap-delta num">
                {plural(r.kills, 'élimination', 'éliminations')} pour {plural(r.deaths, 'mort', 'morts')}
              </span>
            </div>
            <dl className="recap-big">
              <div>
                <dt>Éliminations</dt>
                <dd className="num">
                  <CountUp value={r.kills} format={(n) => int.format(Math.round(n))} />
                </dd>
              </div>
              <div>
                <dt>Morts</dt>
                <dd className="num">
                  <CountUp value={r.deaths} format={(n) => int.format(Math.round(n))} />
                </dd>
              </div>
              <div>
                <dt>Assistances</dt>
                <dd className="num">
                  <CountUp value={r.assists} format={(n) => int.format(Math.round(n))} />
                </dd>
              </div>
            </dl>
          </section>

          <dl className="recap-tiles">
            <div className="recap-tile">
              <dt>Headshots</dt>
              <dd className="num">{hsPct === null ? '–' : <CountUp value={hsPct} format={(n) => `${pct.format(n)} %`} />}</dd>
              {hsPct !== null && (
                <span className="caption num">
                  {int.format(r.headshots)} sur {int.format(r.trackedKills)}
                </span>
              )}
            </div>
            {r.hasRounds && (
              <div className="recap-tile">
                <dt>ADR</dt>
                <dd className="num">{adr === null ? '–' : <CountUp value={adr} format={(n) => int.format(Math.round(n))} />}</dd>
                <span className="caption">dégâts par round</span>
              </div>
            )}
            <div className="recap-tile">
              <dt>MVP</dt>
              <dd className="num">
                <CountUp value={r.mvps} format={(n) => int.format(Math.round(n))} />
              </dd>
            </div>
            <div className="recap-tile">
              <dt>Points</dt>
              <dd className="num">
                <CountUp value={r.points} format={(n) => int.format(Math.round(n))} />
              </dd>
            </div>
          </dl>

          {r.hasRounds && r.rounds.length > 0 && <Strip rounds={r.rounds} />}

          {(r.best || multi) && (
            <div className="recap-pair">
              {r.best && (
                <article className="recap-card cs2-card">
                  <span className="recap-card-body">
                    <span className="overline">Meilleur round</span>
                    <b className="recap-card-name num">
                      Round {r.best.n} · {r.best.kills} élim.
                    </b>
                    <span className="caption num">{plural(r.best.damage, 'dégât', 'dégâts')}</span>
                  </span>
                </article>
              )}
              {multi && (
                <article className="recap-card cs2-card">
                  <span className="recap-card-body">
                    <span className="overline">Multi-éliminations</span>
                    <b className="recap-card-name num">{multi}</b>
                    <span className="caption">rounds à 3 éliminations ou plus</span>
                  </span>
                </article>
              )}
            </div>
          )}

          {r.partial && (
            <p className="recap-note">
              <Icon name="info" size={14} />
              Match rejoint en cours : headshots, ADR et frise portent sur les {plural(r.roundsTracked, 'round suivi', 'rounds suivis')} par Player X.
            </p>
          )}
          {r.result === 'left' && (
            <p className="recap-note">
              <Icon name="info" size={14} />
              Match quitté avant la fin (ou jeu fermé) : le bilan s’arrête au dernier envoi de CS2.
            </p>
          )}
        </div>

        <div className="dialog-actions recap-actions">
          <span className="caption recap-source">
            {r.sample ? 'Ton vrai bilan arrive à la fin de ton prochain match.' : 'Envoyé par CS2 pendant le match (Game State Integration de Valve).'}
          </span>
          <button className="btn btn-primary" onClick={close} autoFocus>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

/** Visuel de CS2 : celui de la bibliothèque. */
const cs2Art = (games: Game[]): string | undefined => {
  const g = games.find((x) => x.id === CS2_GAME_ID)
  return g?.heroUrl || g?.coverUrl
}

/** Monté une fois par App : propose les bilans prêts et affiche la carte ouverte. */
export function Cs2RecapHost({ games }: { games: Game[] }): React.JSX.Element | null {
  const notify = useToast()
  const recap = useStore(shownCs2)

  const offer = useCallback(
    (r: Cs2Recap) => {
      if (offered.has(r.id) || shownCs2.get()?.id === r.id) return
      offered.add(r.id)
      notify(r.sample ? 'Exemple : ton bilan CS2 est prêt' : 'Ton bilan Counter-Strike 2 est prêt', {
        id: 'cs2-recap',
        duration: TOAST_MS,
        action: { label: 'Voir le bilan', onClick: () => openCs2Recap(r) }
      })
    },
    [notify]
  )

  useEffect(
    () =>
      api.onCs2Recap(({ recap: r, reason }) => {
        if (reason === 'open') {
          offered.add(r.id)
          return openCs2Recap(r)
        }
        if (reason === 'ready') offer(r)
      }),
    [offer]
  )

  // Bilan prêt pendant que Player X était caché ou au second plan : proposé au retour, une seule fois.
  useEffect(() => {
    const check = (): void => {
      if (!document.hasFocus()) return
      api
        .cs2State()
        .then(({ recaps }) => {
          const r = recaps.find((x) => !x.seen && !x.sample && Date.now() - x.endedAt < OFFER_MS)
          if (r) offer(r)
        })
        .catch(() => {})
    }
    check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [offer])

  if (!recap) return null
  return <Cs2RecapDialog recap={recap} art={cs2Art(games)} onClose={() => shownCs2.set(null)} />
}
