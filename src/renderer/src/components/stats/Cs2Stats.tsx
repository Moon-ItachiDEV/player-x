// Counter-Strike 2 sur la page Stats : tes stats à vie de Valve (Steam Web API, Cs2Lifetime.tsx), tes chiffres sur les
// matchs gardés sur ce PC, le match en cours et la liste des derniers matchs (chacun ouvre son bilan). Les matchs viennent
// de CS2 lui-même (Game State Integration) : rien n'est inventé, et en mode démo seuls des exemples présentés comme tels
// s'affichent.
import { useState } from 'react'
import { formatKd, killDeath, mapLabel, modeLabel, RESULT_LABEL } from '@shared/cs2'
import type { Cs2Config, Cs2Live, Cs2Recap, Cs2Round, Cs2State } from '@shared/types'
import { dayOf, openCs2Recap, sampleCs2Recap, timeFmt } from '../cs2/useCs2'
import { Icon } from '../ui/Icon'
import { int, pct } from './bf6'
import { LifetimeCard, LifetimeSide, MapsTab, useCs2Lifetime, WeaponsTab, type OpenSettings } from './Cs2Lifetime'
import { StatsTabs } from './StatsTabs'

type Cs2Tab = 'overview' | 'weapons' | 'maps' | 'matches'

const TAB_KEY = 'pg.stats.cs2tab'
const TAB_IDS: Cs2Tab[] = ['overview', 'weapons', 'maps', 'matches']
/** Derniers matchs montrés dans la vue d'ensemble. */
const OVERVIEW_ROWS = 5
/** Onglet Matchs : jusqu'à 500 bilans gardés, montrés 50 par 50. */
const PAGE_ROWS = 50

function loadTab(): Cs2Tab {
  try {
    const t = localStorage.getItem(TAB_KEY) as Cs2Tab | null
    return t && TAB_IDS.includes(t) ? t : 'overview'
  } catch {
    return 'overview'
  }
}

/** Liaison avec CS2 qui demande quelque chose (les réglages et « Réessayer » sont dans la fiche du jeu). */
const LINK_ISSUE: Partial<Record<Cs2Config, { title: string; text: string }>> = {
  restart: { title: 'Relance CS2', text: 'CS2 lit sa configuration à son démarrage : quitte le jeu et relance-le.' },
  blocked: { title: 'Accès refusé', text: 'Windows a bloqué l’écriture du fichier de liaison dans le dossier de CS2. La fiche du jeu permet de réessayer.' },
  missing: { title: 'Dossier introuvable', text: 'Le dossier de configuration de CS2 manque : lance le jeu une fois, puis réessaie depuis sa fiche.' },
  'no-port': { title: 'Pas de port libre', text: 'Un autre programme occupe les ports 47730 à 47739 de ton PC.' }
}

const adrOf = (r: Pick<Cs2Recap, 'hasRounds' | 'roundsTracked' | 'damage'>): number | null => (r.hasRounds && r.roundsTracked > 0 ? r.damage / r.roundsTracked : null)
const hsOf = (r: Pick<Cs2Recap, 'headshots' | 'trackedKills'>): number | null => (r.trackedKills > 0 ? (r.headshots / r.trackedKills) * 100 : null)

interface Summary {
  count: number
  kills: number
  deaths: number
  kd: number
  headshots: number
  trackedKills: number
  /** null : aucune élimination suivie, aucun round suivi, aucun match joué en équipe. */
  hs: number | null
  adr: number | null
  roundsTracked: number
  wins: number
  losses: number
  ties: number
  winRate: number | null
}

/** Totaux des matchs gardés : K/D, headshots et ADR sur les rounds suivis, victoires sur les matchs joués en équipe. */
function summaryOf(list: Cs2Recap[]): Summary {
  const sum = (f: (r: Cs2Recap) => number, from = list): number => from.reduce((n, r) => n + f(r), 0)
  const kills = sum((r) => r.kills)
  const deaths = sum((r) => r.deaths)
  const withRounds = list.filter((r) => r.hasRounds)
  const roundsTracked = sum((r) => r.roundsTracked, withRounds)
  const trackedKills = sum((r) => r.trackedKills)
  const wins = list.filter((r) => r.result === 'win').length
  const losses = list.filter((r) => r.result === 'loss').length
  const ties = list.filter((r) => r.result === 'tie').length
  const decided = wins + losses + ties
  return {
    count: list.length,
    kills,
    deaths,
    kd: deaths > 0 ? kills / deaths : kills,
    headshots: sum((r) => r.headshots),
    trackedKills,
    hs: trackedKills > 0 ? (sum((r) => r.headshots) / trackedKills) * 100 : null,
    adr: roundsTracked > 0 ? sum((r) => r.damage, withRounds) / roundsTracked : null,
    roundsTracked,
    wins,
    losses,
    ties,
    winRate: decided > 0 ? (wins / decided) * 100 : null
  }
}

export function Cs2Stats({ state, live, onOpenSettings }: { state: Cs2State; live: Cs2Live | null; onOpenSettings: OpenSettings }): React.JSX.Element {
  const [tab, setTab] = useState<Cs2Tab>(loadTab)
  const lifetime = useCs2Lifetime(state.demo)
  const recaps = state.recaps
  const steamTab = tab === 'weapons' || tab === 'maps'

  const pick = (next: Cs2Tab): void => {
    if (next === tab) return
    setTab(next)
    try {
      localStorage.setItem(TAB_KEY, next)
    } catch {
      /* stockage indisponible : l'onglet vaut pour la session */
    }
    document.querySelector('.content')?.scrollTo({ top: 0 })
  }

  const issue = !state.demo ? LINK_ISSUE[state.config] : undefined

  return (
    <>
      <StatsTabs<Cs2Tab>
        label="Stats Counter-Strike 2"
        idBase="cs"
        value={tab}
        onChange={pick}
        tabs={[
          { id: 'overview', label: 'Vue d’ensemble' },
          { id: 'weapons', label: 'Armes' },
          { id: 'maps', label: 'Cartes' },
          { id: 'matches', label: 'Matchs', badge: recaps.length ? int.format(recaps.length) : undefined }
        ]}
      >
        {steamTab ? (
          <LifetimeSide state={lifetime} />
        ) : (
          <span className={`bf-cs-source ${state.connected ? 'is-on' : ''}`}>
            {state.connected && <span className="bf-cs-source-dot" aria-hidden="true" />}
            {state.connected ? 'Liaison active · ' : ''}Envoyé par CS2, tes chiffres seulement
          </span>
        )}
      </StatsTabs>

      <div id="cs-panel" className="bf-panel" role="tabpanel" aria-labelledby={`cs-tab-${tab}`}>
        {state.demo && !steamTab && (
          <p className="bf-banner-msg bf-note">
            <Icon name="info" size={16} />
            <span>
              <b>Mode démo</b> · tes vrais matchs Counter-Strike 2 ne s’affichent pas ici.
            </span>
          </p>
        )}
        {issue && !steamTab && (
          <p className="bf-banner-msg bf-warn" role="status">
            <Icon name="alert-triangle" size={16} />
            <span>
              <b>{issue.title}</b> · {issue.text}
            </span>
          </p>
        )}
        {live && !steamTab && <LiveCard live={live} />}

        {tab === 'overview' && (
          <>
            <LifetimeCard state={lifetime} onOpenSettings={onOpenSettings} />
            {recaps.length === 0 ? (
              !live && <Empty />
            ) : (
              <>
                <header className="bf-card-head bf-cs-block-head">
                  <h2 className="bf-card-title">Tes matchs suivis par Player X</h2>
                  <span className="caption">{recaps.length > 1 ? `Tes ${int.format(recaps.length)} derniers matchs, gardés sur ce PC` : 'Ton dernier match, gardé sur ce PC'}</span>
                </header>
                <Kpis list={recaps} />
                <Matches list={recaps.slice(0, OVERVIEW_ROWS)} title="Derniers matchs" total={recaps.length} onAll={() => pick('matches')} />
              </>
            )}
          </>
        )}
        {tab === 'weapons' && <WeaponsTab state={lifetime} onOpenSettings={onOpenSettings} />}
        {tab === 'maps' && <MapsTab state={lifetime} recaps={recaps} onOpenSettings={onOpenSettings} />}
        {tab === 'matches' && (recaps.length === 0 ? !live && <Empty /> : <Matches list={recaps} title="Tous tes matchs" full />)}
      </div>
    </>
  )
}

/* ---------- chiffres phares ---------- */

function Kpis({ list }: { list: Cs2Recap[] }): React.JSX.Element {
  const s = summaryOf(list)
  const over = `sur ${s.count > 1 ? `tes ${int.format(s.count)} derniers matchs` : 'ton dernier match'}`
  return (
    <section className="bf-kpis" aria-label={`Chiffres phares ${over}`}>
      <div className="bf-kpi" style={{ '--i': 0 } as React.CSSProperties}>
        <span className="bf-kpi-value num">{formatKd(s.kd)}</span>
        <span className="bf-kpi-label">Ratio K/D</span>
        <span className="bf-kpi-foot num">
          {int.format(s.kills)} élim. · {int.format(s.deaths)} morts
        </span>
      </div>
      <div className="bf-kpi" style={{ '--i': 1 } as React.CSSProperties}>
        <span className="bf-kpi-value num">{s.hs === null ? '–' : `${pct.format(s.hs)} %`}</span>
        <span className="bf-kpi-label">Headshots</span>
        <span className="bf-kpi-foot num">{s.trackedKills ? `${int.format(s.headshots)} sur ${int.format(s.trackedKills)} élim. suivies` : 'Aucune élimination suivie'}</span>
      </div>
      <div className="bf-kpi" style={{ '--i': 2 } as React.CSSProperties}>
        <span className="bf-kpi-value num">{s.adr === null ? '–' : int.format(Math.round(s.adr))}</span>
        <span className="bf-kpi-label">ADR · dégâts par round</span>
        <span className="bf-kpi-foot num">{s.roundsTracked ? `Sur ${int.format(s.roundsTracked)} rounds suivis` : 'Aucun mode en rounds'}</span>
      </div>
      <div className="bf-kpi" style={{ '--i': 3 } as React.CSSProperties}>
        <span className="bf-kpi-value num">{s.winRate === null ? '–' : `${pct.format(s.winRate)} %`}</span>
        <span className="bf-kpi-label">Victoires</span>
        <span className="bf-kpi-foot num">
          {s.winRate === null ? 'Aucun match terminé en équipe' : `${int.format(s.wins)} V · ${int.format(s.losses)} D${s.ties ? ` · ${int.format(s.ties)} N` : ''}`} · {over}
        </span>
      </div>
    </section>
  )
}

/* ---------- match en cours ---------- */

function phaseLine(l: Cs2Live): string {
  if (l.phase === 'warmup') return 'Échauffement'
  if (l.phase === 'intermission') return 'Mi-temps'
  if (l.phase === 'gameover') return 'Fin du match'
  return `Round ${l.round}`
}

function LiveCard({ live: l }: { live: Cs2Live }): React.JSX.Element {
  const warm = l.phase === 'warmup'
  return (
    <section className="bf-card bf-cs-live" aria-labelledby="bf-cs-live-title" aria-live="off">
      <div className="bf-cs-live-head">
        <span className="bf-cs-live-badge">
          <span className="bf-cs-live-dot" aria-hidden="true" />
          En direct
        </span>
        <h2 id="bf-cs-live-title" className="bf-card-title">
          {mapLabel(l.map)}
        </h2>
        <span className="caption num">
          {modeLabel(l.mode)} · {phaseLine(l)}
          {l.partial ? ` · suivi depuis ${timeFmt.format(l.startedAt)}` : ''}
        </span>
      </div>
      {warm ? (
        <p className="bf-text">Le match commence à la fin de l’échauffement : ce qui s’y passe ne compte pas.</p>
      ) : (
        <div className="bf-cs-live-body">
          {l.score && (
            <span className="bf-cs-live-score num" aria-label={`Score : ton camp ${l.score.us}, l’autre ${l.score.them}`}>
              <b>{l.score.us}</b>
              <span aria-hidden="true">–</span>
              {l.score.them}
            </span>
          )}
          {l.rounds.length > 0 && <Strip rounds={l.rounds} />}
          <dl className="bf-cs-live-nums num">
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
            {l.adr !== undefined && (
              <div>
                <dt>ADR</dt>
                <dd>{int.format(Math.round(l.adr))}</dd>
              </div>
            )}
            {l.hsPct !== undefined && (
              <div>
                <dt>Headshots</dt>
                <dd>{pct.format(l.hsPct)} %</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </section>
  )
}

/* ---------- matchs ---------- */

/** Frise des rounds : gagné, perdu, ou camp inconnu (match rejoint en cours). Un écart marque le changement de camp. */
function Strip({ rounds }: { rounds: Cs2Round[] }): React.JSX.Element {
  const won = rounds.filter((r) => r.side && r.side === r.winner).length
  const lost = rounds.filter((r) => r.side && r.side !== r.winner).length
  return (
    <span className="bf-cs-strip" role="img" aria-label={`Rounds : ${won} gagnés, ${lost} perdus`}>
      {rounds.map((r, i) => {
        const prev = rounds[i - 1]
        const swap = !!prev?.side && !!r.side && prev.side !== r.side
        return <i key={r.n} className={`${!r.side ? 'is-unknown' : r.side === r.winner ? 'is-won' : 'is-lost'} ${swap ? 'is-swap' : ''}`} />
      })}
    </span>
  )
}

function Matches({ list, title, full, total, onAll }: { list: Cs2Recap[]; title: string; full?: boolean; total?: number; onAll?: () => void }): React.JSX.Element {
  const [count, setCount] = useState(PAGE_ROWS)
  const rows = full ? list.slice(0, count) : list
  return (
    <section className="bf-card bf-cs-matches" aria-labelledby={`bf-cs-${full ? 'all' : 'last'}-title`}>
      <header className="bf-card-head">
        <h2 id={`bf-cs-${full ? 'all' : 'last'}-title`} className="bf-card-title">
          {title}
        </h2>
        <span className="caption">{full ? `${int.format(list.length)} gardés sur ce PC · les plus récents d’abord` : 'Suivis par Player X pendant que tu joues'}</span>
      </header>
      <ul className={`bf-cs-rows ${full ? 'is-full' : ''}`}>
        {rows.map((r) => (
          <MatchRow key={r.id} r={r} full={full} />
        ))}
      </ul>
      {full && list.length > rows.length && (
        <button className="link-btn bf-more" onClick={() => setCount((n) => n + PAGE_ROWS)}>
          Afficher {int.format(Math.min(PAGE_ROWS, list.length - rows.length))} matchs de plus ({int.format(rows.length)} sur {int.format(list.length)})
        </button>
      )}
      {onAll && total !== undefined && total > list.length && (
        <button className="link-btn bf-more" onClick={onAll}>
          Voir tous tes matchs ({int.format(total)})
        </button>
      )}
    </section>
  )
}

function MatchRow({ r, full }: { r: Cs2Recap; full?: boolean }): React.JSX.Element {
  const adr = adrOf(r)
  const hs = hsOf(r)
  return (
    <li>
      <button className="bf-cs-row" onClick={() => openCs2Recap(r)}>
        <span className={`bf-res is-${r.result}`}>{RESULT_LABEL[r.result]}</span>
        <span className="bf-cs-where">
          <span className="bf-cs-map">
            {mapLabel(r.map)}
            {!r.seen && !r.sample && <span className="bf-cs-new">Nouveau</span>}
          </span>
          <span className="caption num">
            {modeLabel(r.mode)} · {dayOf(r.endedAt)} {timeFmt.format(r.endedAt)}
          </span>
        </span>
        {r.rounds.length > 0 ? <Strip rounds={r.rounds} /> : <span className="bf-cs-strip is-none caption">Pas de rounds dans ce mode</span>}
        <span className="bf-cs-cell num">{r.score && r.result !== 'left' ? `${r.score.us}–${r.score.them}` : '–'}</span>
        {full && (
          <span className="bf-cs-cell is-dim num">
            {r.kills}/{r.deaths}/{r.assists}
          </span>
        )}
        <span className="bf-cs-cell is-dim num">K/D {formatKd(killDeath(r))}</span>
        {full && <span className="bf-cs-cell is-dim num">HS {hs === null ? '–' : `${pct.format(hs)} %`}</span>}
        <span className="bf-cs-cell is-dim num">ADR {adr === null ? '–' : int.format(Math.round(adr))}</span>
        <Icon name="chevron-right" size={14} className="bf-cs-go" />
      </button>
    </li>
  )
}

function Empty(): React.JSX.Element {
  return (
    <section className="bf-card bf-cs-empty" aria-labelledby="bf-cs-empty-title">
      <span className="bf-cs-empty-icon" aria-hidden="true">
        <Icon name="crosshair" size={22} />
      </span>
      <div className="bf-cs-empty-text">
        <h2 id="bf-cs-empty-title" className="bf-card-title">
          Tes matchs arrivent ici
        </h2>
        <p className="bf-text">À la fin de chaque match : ton résultat, ton K/D, tes headshots, tes dégâts par round et la frise des rounds.</p>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={() => openCs2Recap(sampleCs2Recap())}>
        Voir un exemple
      </button>
    </section>
  )
}
