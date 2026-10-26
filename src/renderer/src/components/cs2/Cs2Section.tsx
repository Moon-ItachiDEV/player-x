// Fiche de Counter-Strike 2 : ton match en direct (seulement pendant un match), l'état de la liaison avec le jeu et tes
// derniers matchs. Tout vient de CS2 lui-même (Game State Integration) ; rien n'est affiché sans envoi du jeu.
// Deux vues : l'aperçu de la fiche (les 3 derniers matchs) et l'onglet « Matchs » (tous les bilans gardés).
import { formatKd, killDeath, mapLabel, modeLabel } from '@shared/cs2'
import type { Cs2Config, Cs2Live, Cs2Recap, Cs2State } from '@shared/types'
import { Icon } from '../ui/Icon'
import { ResultTag } from './Cs2Recap'
import { dayOf, openCs2Recap, sampleCs2Recap, timeFmt } from './useCs2'
import './cs2.css'

const int = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
/** Derniers matchs montrés dans l'aperçu de la fiche. */
const OVERVIEW_ROWS = 3

const other = (s: 'CT' | 'T'): 'CT' | 'T' => (s === 'CT' ? 'T' : 'CT')

function phaseLine(l: Cs2Live): string {
  if (l.phase === 'warmup') return 'Échauffement'
  if (l.phase === 'intermission') return 'Mi-temps'
  if (l.phase === 'gameover') return 'Fin du match'
  return `Round ${l.round}`
}

function LiveCard({ live: l }: { live: Cs2Live }): React.JSX.Element {
  const warm = l.phase === 'warmup'
  return (
    <section className="cs2-live" aria-labelledby="cs2-live-title" aria-live="off">
      <div className="cs2-live-head">
        <span className="cs2-live-badge">
          <span className="cs2-live-dot fx-loop" aria-hidden="true" />
          En direct
        </span>
        <h3 id="cs2-live-title" className="cs2-live-where">
          Match en cours · {mapLabel(l.map)}
        </h3>
        <span className="cs2-live-round num">
          {phaseLine(l)} · {modeLabel(l.mode)}
        </span>
      </div>
      {warm ? (
        <p className="cs2-live-warm caption">Échauffement : ne compte pas.</p>
      ) : (
        <>
          <div className="cs2-live-body">
            {l.score && l.side ? (
              <div className="cs2-score num" aria-label={`Score : ton camp ${l.score.us}, l’autre ${l.score.them}`}>
                <span className="cs2-score-side is-us">
                  <b>{l.score.us}</b>
                  <span className={`cs2-side is-${l.side.toLowerCase()}`}>Ton camp · {l.side}</span>
                </span>
                <span className="cs2-score-dash" aria-hidden="true">
                  :
                </span>
                <span className="cs2-score-side is-them">
                  <b>{l.score.them}</b>
                  <span className={`cs2-side is-${other(l.side).toLowerCase()}`}>Adverses · {other(l.side)}</span>
                </span>
              </div>
            ) : null}
            <dl className="cs2-live-stats num">
              <div>
                <dd>{l.kills}</dd>
                <dt>Éliminations</dt>
              </div>
              <div>
                <dd>{l.deaths}</dd>
                <dt>Morts</dt>
              </div>
              <div>
                <dd>{l.assists}</dd>
                <dt>Assistances</dt>
              </div>
              <div>
                <dd>{formatKd(killDeath(l))}</dd>
                <dt>K/D</dt>
              </div>
            </dl>
          </div>
          <p className="cs2-live-foot num">
            <span>
              <b>{l.mvps}</b> MVP
            </span>
            <span>
              <b>{l.points}</b> points
            </span>
            <span>
              Ce round : <b>{l.roundKills} élim.</b>
            </span>
            {l.health !== undefined ? (
              <>
                <span>
                  <b>{l.health}</b> PV
                </span>
                {l.money !== undefined && (
                  <span>
                    <b>{int.format(l.money)}</b> $
                  </span>
                )}
              </>
            ) : (
              <span className="cs2-live-dead">Mort · tu regardes un coéquipier</span>
            )}
          </p>
        </>
      )}
      <p className="cs2-live-since caption num">
        {l.partial ? `Suivi depuis ${timeFmt.format(l.startedAt)}, match rejoint en cours` : `Depuis ${timeFmt.format(l.startedAt)}`} · suivi par la liaison officielle de
        CS2, ton bilan s’affiche à la fin du match.
      </p>
    </section>
  )
}

/** Liaison avec CS2 : ce qui se passe, et quoi faire si ça bloque. */
function LinkLine({
  config,
  connected,
  onRetry,
  onOpenFolder
}: {
  config: Cs2Config
  connected: boolean
  onRetry?: () => void
  onOpenFolder?: () => void
}): React.JSX.Element | null {
  const line: Record<Cs2Config, { tone: 'ok' | 'warn' | 'muted'; title: string; text: string } | null> = {
    off: null,
    ready: connected
      ? {
          tone: 'ok',
          title: 'Liaison active',
          text: 'CS2 envoie ton match à Player X.'
        }
      : {
          tone: 'ok',
          title: 'Liaison prête',
          text: 'Lance un match : il s’affiche ici, et ton bilan arrive à la fin.'
        },
    restart: {
      tone: 'warn',
      title: 'Relance CS2',
      text: 'CS2 lit sa configuration à son démarrage : quitte le jeu et relance-le.'
    },
    blocked: {
      tone: 'warn',
      title: 'Accès refusé',
      text: 'Windows a bloqué l’écriture du fichier de liaison dans le dossier de CS2.'
    },
    missing: {
      tone: 'muted',
      title: 'Dossier introuvable',
      text: 'Le dossier de configuration de CS2 manque : lance le jeu une fois, puis réessaie.'
    },
    'no-port': {
      tone: 'warn',
      title: 'Pas de port libre',
      text: 'Un autre programme occupe les ports 47730 à 47739 de ton PC.'
    }
  }
  const l = line[config]
  if (!l) return null
  const retry = (config === 'blocked' || config === 'missing') && onRetry
  return (
    <p className={`cs2-link is-${l.tone}`} role="status">
      <Icon name={l.tone === 'ok' ? 'check-circle' : l.tone === 'warn' ? 'alert-triangle' : 'info'} size={16} />
      <span className="cs2-link-text">
        <b>{l.title}</b> · {l.text}
      </span>
      {config === 'blocked' && onOpenFolder && (
        <button className="link-btn" onClick={onOpenFolder}>
          Ouvrir le dossier
        </button>
      )}
      {retry && (
        <button className="link-btn" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </p>
  )
}

/** Un match : résultat, carte, mode et date, score, K/D/A, K/D, MVP. Ouvre son bilan. */
function MatchRow({ r }: { r: Cs2Recap }): React.JSX.Element {
  const score = r.score && r.result !== 'left' ? `${r.score.us}–${r.score.them}` : '—'
  return (
    <li>
      <button className="cs2-row" onClick={() => openCs2Recap(r)}>
        <ResultTag r={r} />
        <span className="cs2-row-main">
          <span className="cs2-row-map">{mapLabel(r.map)}</span>
          <span className="cs2-row-sub num">
            · {modeLabel(r.mode)} · {dayOf(r.endedAt)} {timeFmt.format(r.endedAt)}
          </span>
          {!r.seen && !r.sample && <span className="cs2-row-new">Nouveau</span>}
        </span>
        <span className="cs2-row-score num" aria-label={r.score && r.result !== 'left' ? `Score ${score}` : 'Score inconnu'}>
          {score}
        </span>
        <span className="cs2-row-kda num" title="Éliminations / morts / assistances">
          <b>{r.kills}</b>/{r.deaths}/{r.assists}
        </span>
        <span className="cs2-row-stat num">K/D {formatKd(killDeath(r))}</span>
        <span className="cs2-row-stat num">{r.mvps} MVP</span>
        <Icon name="chevron-right" size={14} className="cs2-row-go" />
      </button>
    </li>
  )
}

/** Liaison (ou mode démo) : une ligne d'état sous le titre des matchs. */
function Status({ state, onRetry, onOpenFolder }: Pick<Props, 'state' | 'onRetry' | 'onOpenFolder'>): React.JSX.Element | null {
  if (state.demo) {
    return (
      <p className="cs2-link is-muted">
        <Icon name="info" size={16} />
        <span className="cs2-link-text">
          <b>Mode démo</b> · tes vrais matchs Counter-Strike 2 ne s’affichent pas ici.
        </span>
      </p>
    )
  }
  return <LinkLine config={state.config} connected={state.connected} onRetry={onRetry} onOpenFolder={onOpenFolder} />
}

interface Props {
  state: Cs2State
  live: Cs2Live | null
  /** « Réessayer » : relance l'analyse de la bibliothèque, qui réécrit le fichier de liaison. */
  onRetry?: () => void
  onOpenFolder?: () => void
  /** « Tous les matchs » : l'onglet Matchs de la fiche. */
  onShowAll?: (opener: HTMLElement) => void
}

/** Carte des matchs : titre, liaison, liste (ou l'exemple quand il n'y en a pas encore). */
function MatchesCard({ state, live, onRetry, onOpenFolder, onShowAll, limit }: Props & { limit?: number }): React.JSX.Element {
  const rows = limit ? state.recaps.slice(0, limit) : state.recaps
  const more = !!limit && state.recaps.length > limit
  return (
    <section className="cs2-matches" aria-labelledby="cs2-matches-title">
      <div className="cs2-matches-head">
        <h3 id="cs2-matches-title" className="cs2-matches-title">
          {limit ? 'Derniers matchs' : 'Tes matchs'}
        </h3>
        {more && onShowAll && (
          <button className="link-btn cs2-matches-all" onClick={(e) => onShowAll(e.currentTarget)}>
            Tous les matchs
          </button>
        )}
      </div>
      <Status state={state} onRetry={onRetry} onOpenFolder={onOpenFolder} />
      {rows.length > 0 ? (
        <ul className="cs2-rows">
          {rows.map((r) => (
            <MatchRow key={r.id} r={r} />
          ))}
        </ul>
      ) : (
        !live && (
          <div className="cs2-empty">
            <p className="caption">Pas encore de match.</p>
            <button className="btn btn-secondary btn-sm" onClick={() => openCs2Recap(sampleCs2Recap())}>
              Voir un exemple
            </button>
          </div>
        )
      )}
    </section>
  )
}

/** Aperçu de la fiche : le match en direct, puis les 3 derniers matchs. Rien si la liaison est coupée (Paramètres). */
export function Cs2Overview(props: Props): React.JSX.Element | null {
  if (!props.state.enabled) return null
  return (
    <>
      {props.live && <LiveCard live={props.live} />}
      <MatchesCard {...props} limit={OVERVIEW_ROWS} />
    </>
  )
}

/** Onglet « Matchs » : le match en direct, puis tous les bilans gardés. */
export function Cs2Matches(props: Props): React.JSX.Element | null {
  if (!props.state.enabled) return null
  return (
    <div className="cs2-tab">
      {props.live && <LiveCard live={props.live} />}
      <MatchesCard {...props} />
    </div>
  )
}
