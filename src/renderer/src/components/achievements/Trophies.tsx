import { useMemo, useState } from 'react'
import { capitalize, cleanName, plural, timeAgo } from '@shared/text'
import type { AchievementGame, AchievementPick, AchievementsOverview, Game } from '@shared/types'
import type { TrophiesProps } from '../../contracts'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { PickMenu } from '../ui/PickMenu'
import { AchIcon } from './AchIcon'
import { completion, formatPercent, rarityOf } from './format'
import { useAchievementsOverview } from './useAchievements'
import './achievements.css'

export type { TrophiesProps }

const fmt = new Intl.NumberFormat('fr-FR')
const CARDS = 8
const STEAM_PRIVACY_URL = 'https://steamcommunity.com/my/edit/settings'

type GameFilter = 'started' | 'perfect' | 'todo' | 'all'
type GameSort = 'progress' | 'recent' | 'name'

const SORTS: { value: GameSort; label: string }[] = [
  { value: 'progress', label: 'Progression' },
  { value: 'recent', label: 'Dernier succès' },
  { value: 'name', label: 'Nom' }
]

/** Page Trophées : les succès Steam de tous les jeux joués, le niveau Steam, les plus rares et les derniers débloqués. */
export function Trophies({ games, notInstalled, onOpen, onOpenAccounts }: TrophiesProps): React.JSX.Element {
  const { data, error, refresh } = useAchievementsOverview()

  // Le jeu de la bibliothèque (jaquette, fiche), ou un jeu Steam minimal s'il n'y est plus.
  const gameOf = useMemo(() => {
    const byId = new Map([...notInstalled, ...games].map((g) => [g.id, g]))
    return (id: string, name: string): Game => byId.get(id) ?? { id, store: 'steam', storeId: id.slice(6), name }
  }, [games, notInstalled])

  if (!data) {
    return (
      <div className="page tro">
        {error ? <Blocked icon="alert-circle" title="Trophées indisponibles" text={error} action={{ label: 'Réessayer', onClick: refresh }} /> : <TrophiesSkeleton />}
      </div>
    )
  }

  const blocked = blockedOf(data, onOpenAccounts, refresh)
  const empty = !data.games.length
  if (blocked && empty) {
    return (
      <div className="page tro">
        <Blocked {...blocked} />
      </div>
    )
  }

  return (
    <div className="page tro">
      {data.state === 'scanning' && <ScanBand progress={data.progress} first={!data.updatedAt} />}
      {blocked && <Blocked {...blocked} inline />}

      {!(empty && data.state === 'scanning') && <Figures data={data} gameOf={gameOf} />}

      {!empty && (
        <>
          {data.recent.length > 0 && (
            <PickSection title="Derniers débloqués" picks={data.recent.slice(0, CARDS)} gameOf={gameOf} onOpen={onOpen} meta={(p) => capitalize(timeAgo(p.unlockedAt))} />
          )}
          {data.rarest.length > 0 && (
            <PickSection title="Tes plus rares" picks={data.rarest.slice(0, CARDS)} gameOf={gameOf} onOpen={onOpen} meta={(p) => `${formatPercent(p.percent!)} des joueurs`} rare />
          )}
          <GameList list={data.games} gameOf={gameOf} onOpen={onOpen} />
        </>
      )}
      {empty && data.state === 'ready' && (
        <Blocked icon="trophy" title="Aucun succès pour l'instant" text="Aucun de tes jeux Steam joués n'a de succès débloqué ou à débloquer." />
      )}

      <p className="caption tro-foot">
        {data.updatedAt ? `Relevé ${timeAgo(data.updatedAt)} · ` : ''}Succès des jeux Steam seulement : Epic et EA ne les partagent pas.
        {data.state !== 'scanning' && (
          <button className="link-btn" onClick={refresh}>
            Actualiser
          </button>
        )}
      </p>
    </div>
  )
}

/* ---------- états ---------- */

interface BlockedInfo {
  icon: 'trophy' | 'alert-circle' | 'shield' | 'key' | 'user'
  title: string
  text: string
  action?: { label: string; onClick: () => void; external?: boolean }
  /** Deuxième bouton, discret (« Actualiser » une fois le réglage changé). */
  then?: { label: string; onClick: () => void }
}

function blockedOf(data: AchievementsOverview, onOpenAccounts: () => void, refresh: () => void): BlockedInfo | null {
  const accounts = { label: 'Ouvrir Comptes', onClick: onOpenAccounts }
  switch (data.state) {
    case 'no-account':
      return { icon: 'user', title: 'Connecte ton compte Steam', text: 'Tes succès viennent de ton profil Steam.', action: accounts }
    case 'no-key':
      return {
        icon: 'key',
        title: 'Ajoute ta clé Steam Web API',
        text: 'Elle sert déjà à tes amis et à ta bibliothèque Steam : avec elle, Player X lit aussi tes succès.',
        action: accounts
      }
    case 'key-refused':
      return { icon: 'key', title: 'Steam refuse ta clé Web API', text: 'Vérifie-la dans Paramètres › Comptes.', action: accounts }
    case 'private':
      return {
        icon: 'shield',
        title: 'Tes succès sont privés',
        text: 'Ton profil Steam cache les détails de tes jeux. Dans ta confidentialité Steam, passe « Détails des jeux » en « Public », puis actualise.',
        action: { label: 'Confidentialité Steam', onClick: () => void window.launcher.openExternal(STEAM_PRIVACY_URL), external: true },
        then: { label: 'Actualiser', onClick: refresh }
      }
    case 'offline':
      return { icon: 'alert-circle', title: 'Steam ne répond pas', text: 'Vérifie ta connexion internet, puis réessaie.', action: { label: 'Réessayer', onClick: refresh } }
    default:
      return null
  }
}

function Blocked({ icon, title, text, action, then, inline = false }: BlockedInfo & { inline?: boolean }): React.JSX.Element {
  return (
    <div className={`card-surface tro-blocked ${inline ? 'is-inline' : ''}`} role={inline ? 'status' : undefined}>
      <span className="tro-blocked-icon">
        <Icon name={icon} size={inline ? 20 : 26} />
      </span>
      <div className="tro-blocked-text">
        <p className="tro-blocked-title">{title}</p>
        <p className="caption">{text}</p>
      </div>
      {action && (
        <button className="btn btn-secondary btn-sm" onClick={action.onClick}>
          {action.label}
          {action.external && <Icon name="external-link" size={14} />}
        </button>
      )}
      {then && (
        <button className="btn btn-ghost btn-sm" onClick={then.onClick}>
          <Icon name="refresh" size={14} />
          {then.label}
        </button>
      )}
    </div>
  )
}

function ScanBand({ progress, first }: { progress?: { done: number; total: number }; first: boolean }): React.JSX.Element {
  const total = progress?.total ?? 0
  const done = Math.min(progress?.done ?? 0, total)
  return (
    <div className="card-surface tro-scan" role="status">
      <span className="spinner" aria-hidden="true" />
      <div className="tro-scan-text">
        <p className="tro-scan-title">
          Relevé de tes succès Steam{total ? <span className="num"> · {done} / {plural(total, 'jeu', 'jeux')}</span> : '…'}
        </p>
        <p className="caption">
          {first ? 'La première fois prend quelques minutes. Ensuite, seuls les jeux joués depuis sont relus.' : 'Les jeux joués depuis le dernier relevé sont relus.'}
        </p>
      </div>
      {total > 0 && (
        <span className="ach-bar tro-scan-bar" aria-hidden="true">
          <span style={{ width: `${(done / total) * 100}%` }} />
        </span>
      )}
    </div>
  )
}

function TrophiesSkeleton(): React.JSX.Element {
  return (
    <div className="tro-figures" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skel tro-figure" />
      ))}
    </div>
  )
}

/* ---------- chiffres ---------- */

function Figures({ data, gameOf }: { data: AchievementsOverview; gameOf: (id: string, name: string) => Game }): React.JSX.Element {
  const pct = completion(data.unlocked, data.total)
  const perfect = data.games.filter((g) => g.total > 0 && g.unlocked === g.total).sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0))
  const started = data.games.filter((g) => g.unlocked > 0).length
  const lvl = data.level
  const xpPct = lvl && lvl.xpForLevel ? Math.round((lvl.xpInLevel / lvl.xpForLevel) * 100) : 0
  return (
    <section className="tro-figures" aria-label="Chiffres">
      <div className="card-surface tro-figure is-main">
        <span className="overline">Succès débloqués</span>
        <span className="tro-big num">{fmt.format(data.unlocked)}</span>
        <span className="ach-bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="caption num">
          sur {fmt.format(data.total)} · {pct}&#8239;%
        </span>
      </div>
      <div className="card-surface tro-figure">
        <span className="overline">Jeux à 100 %</span>
        <div className="tro-fig-row">
          <span className="tro-big num">{fmt.format(data.perfect)}</span>
          {perfect.length > 0 && (
            <span className="tro-minis" aria-hidden="true">
              {perfect.slice(0, 3).map((g) => (
                <span key={g.gameId} className="tro-mini">
                  <Cover game={gameOf(g.gameId, g.name)} showTitle={false} />
                </span>
              ))}
            </span>
          )}
        </div>
        <span className="caption">{perfect[0] ? `Dernier : ${cleanName(perfect[0].name)}` : 'Aucun jeu terminé à 100 % pour l’instant'}</span>
      </div>
      <div className="card-surface tro-figure">
        <span className="overline">Complétion moyenne</span>
        <span className="tro-big num">{data.average}&#8239;%</span>
        <span className="caption">{started ? `sur ${plural(started, 'jeu commencé', 'jeux commencés')}` : 'Aucun jeu commencé'}</span>
      </div>
      <div className="card-surface tro-figure">
        <span className="overline">Niveau Steam</span>
        {lvl ? (
          <>
            <div className="tro-fig-row">
              <span className="tro-level num" aria-label={`Niveau ${lvl.level}`}>
                {lvl.level}
              </span>
              <span className="caption">{plural(lvl.badges, 'badge', 'badges')}</span>
            </div>
            <span className="ach-bar" aria-hidden="true">
              <span style={{ width: `${xpPct}%` }} />
            </span>
            <span className="caption num">
              {fmt.format(lvl.xpInLevel)} / {fmt.format(lvl.xpForLevel)} XP vers le niveau {lvl.level + 1}
            </span>
          </>
        ) : (
          <span className="caption tro-fig-empty">Lu au prochain relevé</span>
        )}
      </div>
    </section>
  )
}

/* ---------- succès choisis ---------- */

interface PickSectionProps {
  title: string
  picks: AchievementPick[]
  gameOf: (id: string, name: string) => Game
  onOpen: (g: Game) => void
  meta: (p: AchievementPick) => string
  rare?: boolean
}

function PickSection({ title, picks, gameOf, onOpen, meta, rare = false }: PickSectionProps): React.JSX.Element {
  return (
    <section className="tro-section" aria-label={title}>
      <h2 className="tro-section-title">{title}</h2>
      <ul className="tro-picks">
        {picks.map((p) => {
          const rarity = rare ? rarityOf(p.percent) : null
          return (
            <li key={`${p.gameId}:${p.id}`}>
              <button className="card-surface tro-pick" onClick={() => onOpen(gameOf(p.gameId, p.gameName))} title={p.description}>
                <AchIcon ach={p} size={56} />
                <span className="tro-pick-text">
                  <span className="tro-pick-name">{p.name}</span>
                  <span className="tro-pick-game">{cleanName(p.gameName)}</span>
                  <span className={`tro-pick-meta num ${rarity ? `ach-rarity is-${rarity.tier}` : ''}`}>
                    {meta(p)}
                    {rarity && <small>{rarity.label}</small>}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ---------- par jeu ---------- */

function GameList({ list, gameOf, onOpen }: { list: AchievementGame[]; gameOf: (id: string, name: string) => Game; onOpen: (g: Game) => void }): React.JSX.Element {
  const groups = useMemo(
    () => ({
      started: list.filter((g) => g.unlocked > 0 && g.unlocked < g.total),
      perfect: list.filter((g) => g.unlocked === g.total),
      todo: list.filter((g) => g.unlocked === 0),
      all: list
    }),
    [list]
  )
  const [filter, setFilter] = useState<GameFilter>(groups.started.length ? 'started' : 'all')
  const [sort, setSort] = useState<GameSort>('progress')

  const shown = useMemo(() => {
    const base = groups[filter]
    const byName = (a: AchievementGame, b: AchievementGame): number => cleanName(a.name).localeCompare(cleanName(b.name), 'fr', { sensitivity: 'base' })
    if (sort === 'name') return [...base].sort(byName)
    if (sort === 'recent') return [...base].sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0) || byName(a, b))
    return [...base].sort((a, b) => b.unlocked / b.total - a.unlocked / a.total || b.unlocked - a.unlocked || byName(a, b))
  }, [groups, filter, sort])

  const filters: { id: GameFilter; label: string; count: number }[] = [
    { id: 'started', label: 'En cours', count: groups.started.length },
    { id: 'perfect', label: 'À 100 %', count: groups.perfect.length },
    { id: 'todo', label: 'Pas commencés', count: groups.todo.length },
    { id: 'all', label: 'Tous', count: list.length }
  ]

  return (
    <section className="tro-section" aria-label="Par jeu">
      <div className="tro-list-head">
        <h2 className="tro-section-title">Par jeu</h2>
        <div className="ach-chips" role="group" aria-label="Afficher">
          {filters.map((f) => (
            <button key={f.id} className="ach-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
              <span className="num">{f.count}</span>
            </button>
          ))}
        </div>
        <PickMenu label="Trier" value={sort} options={SORTS} onPick={setSort} className="tro-sort" />
      </div>
      {shown.length ? (
        <ul className="tro-games">
          {shown.map((g) => {
            const game = gameOf(g.gameId, g.name)
            const pct = completion(g.unlocked, g.total)
            return (
              <li key={g.gameId}>
                <button className="tro-game" onClick={() => onOpen(game)}>
                  <span className="tro-game-cover">
                    <Cover game={game} showTitle={false} />
                  </span>
                  <span className="tro-game-text">
                    <span className="tro-game-name">{cleanName(g.name)}</span>
                    <span className="caption">{g.lastAt ? `Dernier succès ${timeAgo(g.lastAt)}` : 'Aucun succès débloqué'}</span>
                  </span>
                  <span className="tro-game-progress">
                    <span className="ach-bar" aria-hidden="true">
                      <span style={{ width: `${pct}%` }} className={pct === 100 ? 'is-perfect' : undefined} />
                    </span>
                    <span className="tro-game-count num">
                      {g.unlocked} / {g.total}
                    </span>
                    <span className={`tro-game-pct num ${pct === 100 ? 'is-perfect' : ''}`}>{pct === 100 ? <Icon name="trophy" size={16} /> : `${pct} %`}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="caption">Aucun jeu ici pour l'instant.</p>
      )}
    </section>
  )
}
