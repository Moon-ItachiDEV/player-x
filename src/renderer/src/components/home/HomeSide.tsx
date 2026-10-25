// Colonne de droite de l'accueil : « Dernier match » (vrai bilan CS2 ou Battlefield 6 seulement) et les amis en ligne.
import { useState } from 'react'
import { formatKd, killDeath, mapLabel, modeLabel, RESULT_LABEL } from '@shared/cs2'
import type { Cs2Result, Cs2Round, Friend, FriendStatus } from '@shared/types'
import { dayOf, openCs2Recap } from '../cs2/useCs2'
import { dec, int } from '../stats/bf6'
import { openRecap } from '../stats/Recap'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { KIND_LABEL } from '../ui/StoreTag'
import { aroundLabel, type Around } from './around'
import type { LastMatch } from './pick'

/** Le chiffre d'une tuile, et sa légende. */
interface Stat {
  value: string
  label: string
  title?: string
}

/** CS2 : le résultat en grand (couleur du résultat), la carte et le mode, la frise des rounds. */
interface Hero {
  result: Cs2Result
  label: string
  score: string | null
  where: string
  rounds: Cs2Round[]
}

/** « Dernier match » : le résultat et la frise (CS2), quatre chiffres du bilan le plus récent, le bilan complet au clic. */
export function LastMatchCard({ match }: { match: LastMatch }): React.JSX.Element {
  // Bilans ouverts d'ici : « Nouveau » s'efface tout de suite (le bilan Battlefield 6 ne prévient pas quand il est vu).
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const r = match.recap
  const fresh = !r.seen && !opened.has(r.id)
  let game: string
  let title: string
  let hero: Hero | null = null
  let stats: Stat[]
  if (match.kind === 'cs2') {
    const c = match.recap
    game = 'CS2'
    title = 'Dernier match'
    hero = {
      result: c.result,
      label: RESULT_LABEL[c.result],
      score: c.score && c.result !== 'left' ? `${c.score.us}–${c.score.them}` : null,
      where: [mapLabel(c.map), modeLabel(c.mode)].filter(Boolean).join(' · '),
      rounds: c.hasRounds ? c.rounds : []
    }
    const adr = c.hasRounds && c.roundsTracked > 0 ? Math.round(c.damage / c.roundsTracked) : null
    stats = [
      { value: `${c.kills}/${c.deaths}/${c.assists}`, label: 'K/D/A', title: `${c.kills} éliminations, ${c.deaths} morts, ${c.assists} assistances` },
      { value: formatKd(killDeath(c)), label: 'K/D' },
      adr !== null
        ? { value: int.format(adr), label: 'ADR', title: 'Dégâts moyens par round' }
        : { value: c.trackedKills ? `${Math.round((c.headshots / c.trackedKills) * 100)} %` : '–', label: 'Headshots' },
      { value: int.format(c.mvps), label: 'MVP' }
    ]
  } else {
    const b = match.recap
    game = 'Battlefield 6'
    title = 'Dernière session'
    stats = [
      { value: dec.format(b.killDeath), label: 'K/D' },
      { value: int.format(b.kills), label: 'Éliminations' },
      { value: int.format(b.assists), label: 'Assistances' },
      ...(b.matches ? [{ value: `${int.format(b.wins)}/${int.format(b.matches)}`, label: 'Victoires' }] : [])
    ]
  }
  const open = (): void => {
    setOpened((prev) => new Set(prev).add(r.id))
    if (match.kind === 'cs2') openCs2Recap(match.recap)
    else openRecap(match.recap)
  }

  return (
    <section className="hm-panel hm-match" data-result={hero?.result} aria-labelledby="hm-match-title">
      <header className="hm-panel-head">
        <h3 id="hm-match-title" className="hm-panel-title">
          {title}
        </h3>
        <span className="hm-match-when">
          {game} · {dayOf(r.endedAt)}
        </span>
      </header>
      {hero && <MatchHero hero={hero} />}
      <dl className="hm-match-stats">
        {stats.map((s) => (
          <div key={s.label} className="hm-stat" title={s.title}>
            <dt>{s.label}</dt>
            <dd className="num">{s.value}</dd>
          </div>
        ))}
      </dl>
      <footer className="hm-match-foot">
        <button className="hm-link" onClick={open}>
          Voir le bilan complet
          <Icon name="chevron-right" size={14} />
        </button>
        {fresh && <span className="hm-new">Nouveau</span>}
      </footer>
    </section>
  )
}

function MatchHero({ hero }: { hero: Hero }): React.JSX.Element {
  const won = hero.rounds.filter((x) => x.side && x.winner === x.side).length
  const lost = hero.rounds.filter((x) => x.side && x.winner !== x.side).length
  return (
    <div className="hm-match-hero">
      <div className="hm-match-line">
        <span className="hm-result">{hero.label}</span>
        {hero.score && <span className="hm-score num">{hero.score}</span>}
      </div>
      <span className="hm-match-map">{hero.where}</span>
      {hero.rounds.length > 0 && (
        <div className="hm-strip" role="img" aria-label={`Rounds : ${won} gagnés, ${lost} perdus`}>
          {hero.rounds.map((x) => (
            <i key={x.n} data-r={!x.side ? 'unknown' : x.winner === x.side ? 'won' : 'lost'} />
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_LABEL: Record<FriendStatus, string> = {
  'in-game': 'En jeu',
  online: 'En ligne',
  away: 'Absent',
  offline: 'Hors ligne'
}
/** Lignes de la liste (sous « Dernier match », ou seule dans la colonne) ; au-delà, « Et N autres » mène à la page Amis. */
const ONLINE_MAX = { short: 3, tall: 6 }

/** « En jeu · Counter-Strike 2 », « En ligne · Steam », « Membre du serveur · En ligne ». */
function subOf(f: Friend): { text: string; live: boolean } {
  // Un membre Discord « en jeu » sur autre chose qu'un jeu (Spotify, statut perso…) : le nom de l'activité suffit.
  const live = f.status === 'in-game' && !!f.game
  if (f.platform === 'discord')
    return {
      text: `Membre du serveur · ${live ? f.game : STATUS_LABEL[f.status === 'in-game' ? 'online' : f.status]}`,
      live
    }
  return {
    text: live ? `En jeu · ${f.game}` : `${STATUS_LABEL[f.status]} · ${KIND_LABEL[f.platform]}`,
    live
  }
}

/** Amis (Steam, PlayStation) et membres du serveur Discord en ligne, ceux qui jouent au jeu à la une d'abord. */
export function OnlinePanel({ around, tall, onShowFriends }: { around: Around; tall: boolean; onShowFriends: () => void }): React.JSX.Element {
  const max = tall ? ONLINE_MAX.tall : ONLINE_MAX.short
  const { people, kind } = around
  const members = people.some((p) => p.platform === 'discord')
  const heading = kind === 'members' ? 'Membres du serveur en ligne' : members ? 'Amis et membres en ligne' : 'Amis en ligne'
  const more = people.length - max

  return (
    <section className="hm-panel hm-online" aria-labelledby="hm-online-title">
      <header className="hm-panel-head hm-online-head">
        <h3 id="hm-online-title" className="hm-panel-title">
          {heading}
          <span className="sr-only"> : {aroundLabel(around)}</span>
        </h3>
        <button className="hm-round" aria-label="Voir tous les amis" title="Voir tous les amis" onClick={onShowFriends}>
          <Icon name="chevron-right" size={16} />
        </button>
      </header>
      <ul className="hm-online-list">
        {people.slice(0, max).map((f) => {
          const sub = subOf(f)
          return (
            <li key={f.id} className="hm-person">
              <Avatar name={f.name} url={f.avatarUrl} size={40} status={f.status} />
              <span className="hm-person-text">
                <span className="hm-person-name">{f.name}</span>
                <span className={`hm-person-sub ${sub.live ? 'is-live' : ''}`}>{sub.text}</span>
              </span>
            </li>
          )
        })}
      </ul>
      {more > 0 && (
        <button className="hm-link hm-online-more" onClick={onShowFriends}>
          Et {more} {more > 1 ? 'autres' : 'autre'} en ligne
          <Icon name="chevron-right" size={14} />
        </button>
      )}
    </section>
  )
}
