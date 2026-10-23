// Fiche de Counter-Strike 2 : ton match en direct (seulement pendant un match), l'état de la liaison avec le jeu et tes
// derniers matchs. Tout vient de CS2 lui-même (Game State Integration) ; rien n'est affiché sans envoi du jeu.
import { formatKd, killDeath, mapLabel, modeLabel } from '@shared/cs2'
import type { Cs2Config, Cs2Live, Cs2Recap, Cs2State } from '@shared/types'
import { Icon } from '../ui/Icon'
import { LiveBadge } from '../ui/LiveBadge'
import { ResultTag } from './Cs2Recap'
import { dayOf, openCs2Recap, sampleCs2Recap, timeFmt, useCs2 } from './useCs2'
import './cs2.css'

const int = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
/** Derniers matchs montrés dans la fiche. */
const MAX_ROWS = 5

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
    <article className="cs2-live" aria-live="off">
      <div className="cs2-live-head">
        <LiveBadge label="En match" />
        <span className="cs2-live-where">
          {modeLabel(l.mode)} · {mapLabel(l.map)}
        </span>
        <span className="cs2-live-round num">{phaseLine(l)}</span>
      </div>
      {warm ? (
        <p className="cs2-live-warm caption">Le match commence à la fin de l’échauffement : ce qui s’y passe ne compte pas.</p>
      ) : (
        <>
          {l.score && l.side ? (
            <div className="cs2-score num" aria-label={`Score : ton camp ${l.score.us}, l’autre ${l.score.them}`}>
              <span className="cs2-score-side is-us">
                <span className={`cs2-side is-${l.side.toLowerCase()}`}>Ton camp · {l.side}</span>
                <b>{l.score.us}</b>
              </span>
              <span className="cs2-score-dash" aria-hidden="true">
                –
              </span>
              <span className="cs2-score-side is-them">
                <span className={`cs2-side is-${other(l.side).toLowerCase()}`}>{other(l.side)}</span>
                <b>{l.score.them}</b>
              </span>
            </div>
          ) : null}
          <dl className="cs2-live-stats num">
            <div>
              <dt>K / D / A</dt>
              <dd>
                {l.kills} / {l.deaths} / {l.assists}
              </dd>
            </div>
            <div>
              <dt>K/D</dt>
              <dd>{formatKd(killDeath(l))}</dd>
            </div>
            <div>
              <dt>MVP</dt>
              <dd>{l.mvps}</dd>
            </div>
            <div>
              <dt>Points</dt>
              <dd>{l.points}</dd>
            </div>
          </dl>
          <p className="cs2-live-foot num">
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
        {l.partial ? `Suivi depuis ${timeFmt.format(l.startedAt)}, match rejoint en cours` : `Depuis ${timeFmt.format(l.startedAt)}`}
      </p>
    </article>
  )
}

/** Liaison avec CS2 : ce qui se passe, et quoi faire si ça bloque. */
function LinkLine({ config, connected, onRetry, onOpenFolder }: { config: Cs2Config; connected: boolean; onRetry?: () => void; onOpenFolder?: () => void }): React.JSX.Element | null {
  const line: Record<Cs2Config, { tone: 'ok' | 'warn' | 'muted'; title: string; text: string } | null> = {
    off: null,
    ready: connected
      ? { tone: 'ok', title: 'Liaison active', text: 'CS2 envoie ton match à Player X.' }
      : { tone: 'ok', title: 'Liaison prête', text: 'Lance un match : il s’affiche ici, et ton bilan arrive à la fin.' },
    restart: { tone: 'warn', title: 'Relance CS2', text: 'CS2 lit sa configuration à son démarrage : quitte le jeu et relance-le.' },
    blocked: { tone: 'warn', title: 'Accès refusé', text: 'Windows a bloqué l’écriture du fichier de liaison dans le dossier de CS2.' },
    missing: { tone: 'muted', title: 'Dossier introuvable', text: 'Le dossier de configuration de CS2 manque : lance le jeu une fois, puis réessaie.' },
    'no-port': { tone: 'warn', title: 'Pas de port libre', text: 'Un autre programme occupe les ports 47730 à 47739 de ton PC.' }
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

function MatchRow({ r }: { r: Cs2Recap }): React.JSX.Element {
  const score = r.score && r.result !== 'left' ? ` · ${r.score.us}–${r.score.them}` : ''
  return (
    <li>
      <button className="cs2-row" onClick={() => openCs2Recap(r)}>
        <ResultTag r={r} />
        <span className="cs2-row-main">
          <span className="cs2-row-map">
            {mapLabel(r.map)}
            {!r.seen && !r.sample && <span className="cs2-row-new">Nouveau</span>}
          </span>
          <span className="cs2-row-sub caption num">
            {modeLabel(r.mode)}
            {score} · {dayOf(r.endedAt)} {timeFmt.format(r.endedAt)}
          </span>
        </span>
        <span className="cs2-row-kda num">
          <span>
            <b>{r.kills}</b>/{r.deaths}/{r.assists}
          </span>
          <span className="caption">K/D {formatKd(killDeath(r))}</span>
        </span>
        <Icon name="chevron-right" size={14} className="cs2-row-go" />
      </button>
    </li>
  )
}

interface Props {
  /** « Réessayer » : relance l'analyse de la bibliothèque, qui réécrit le fichier de liaison. */
  onRetry?: () => void
  onOpenFolder?: () => void
}

export function Cs2Section({ onRetry, onOpenFolder }: Props): React.JSX.Element | null {
  const { state, live } = useCs2()
  if (!state?.enabled) return null
  return <Cs2Body state={state} live={live} onRetry={onRetry} onOpenFolder={onOpenFolder} />
}

function Cs2Body({ state, live, onRetry, onOpenFolder }: Props & { state: Cs2State; live: Cs2Live | null }): React.JSX.Element {
  const rows = state.recaps.slice(0, MAX_ROWS)
  return (
    <section className="sheet-section cs2-section" aria-labelledby="cs2-section-title">
      <h3 id="cs2-section-title" className="sheet-h">
        {live ? 'Match en direct' : 'Tes matchs'}
        <span className="sheet-h-count">· envoyés par CS2, tes chiffres seulement</span>
      </h3>
      {live && <LiveCard live={live} />}
      {state.demo ? (
        <p className="cs2-link is-muted">
          <Icon name="info" size={16} />
          <span className="cs2-link-text">
            <b>Mode démo</b> · tes vrais matchs Counter-Strike 2 ne s’affichent pas ici.
          </span>
        </p>
      ) : (
        <LinkLine config={state.config} connected={state.connected} onRetry={onRetry} onOpenFolder={onOpenFolder} />
      )}
      {rows.length > 0 ? (
        <>
          <h4 className="overline cs2-rows-title">Derniers matchs</h4>
          <ul className="cs2-rows">
            {rows.map((r) => (
              <MatchRow key={r.id} r={r} />
            ))}
          </ul>
        </>
      ) : (
        !live && (
          <div className="cs2-empty">
            <p className="caption">À la fin de chaque match : ton résultat, ton K/D, tes headshots, tes dégâts par round et la frise des rounds.</p>
            <button className="btn btn-ghost btn-sm" onClick={() => openCs2Recap(sampleCs2Recap())}>
              Voir un exemple
            </button>
          </div>
        )
      )}
    </section>
  )
}
