import { useMemo, useRef, useState } from 'react'
import { capitalize, cleanName, formatDate, plural, timeAgo } from '@shared/text'
import type { Achievement, AchievementGame, AchievementPick, AchievementsOverview, Game, GameAchievements } from '@shared/types'
import type { TrophiesProps } from '../../contracts'
import { motionReduced } from '../../motion'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { PickMenu } from '../ui/PickMenu'
import { completion, formatPercent, isUnlocked, rarityOf } from './format'
import { useAchievements, useAchievementsOverview } from './useAchievements'
import './achievements.css'

export type { TrophiesProps }

const fmt = new Intl.NumberFormat('fr-FR')
const dayFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })
const CARDS = 8
/** Succès montrés d'abord dans le jeu ouvert (trois rangées) ; le reste derrière « Afficher… ». */
const ACH_FIRST = 12
const STEAM_PRIVACY_URL = 'https://steamcommunity.com/my/edit/settings'

type GameOf = (id: string, name: string) => Game
type GameFilter = 'started' | 'perfect' | 'todo' | 'all'
type GameSort = 'progress' | 'recent' | 'name'
type AchFilter = 'all' | 'done' | 'todo'

const SORTS: { value: GameSort; label: string }[] = [
  { value: 'progress', label: 'Progression' },
  { value: 'recent', label: 'Dernier succès' },
  { value: 'name', label: 'Nom' }
]

const byName = (a: AchievementGame, b: AchievementGame): number => cleanName(a.name).localeCompare(cleanName(b.name), 'fr', { sensitivity: 'base' })
const byProgress = (a: AchievementGame, b: AchievementGame): number => b.unlocked / b.total - a.unlocked / a.total || b.unlocked - a.unlocked || byName(a, b)

/** Page Trophées : les succès Steam de tous les jeux joués, un jeu ouvert avec sa grille de succès, puis les autres jeux. */
export function Trophies({ games, notInstalled, onOpen, onOpenAccounts }: TrophiesProps): React.JSX.Element {
  const { data, error, refresh } = useAchievementsOverview()
  // Jeu ouvert choisi dans la liste (sinon : celui du dernier succès).
  const [picked, setPicked] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)

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

  const open = openGameOf(data, picked)
  // Ouvre un jeu ici, puis amène le panneau à l'écran et y place le focus (clavier, lecteur d'écran).
  const show = (gameId: string): void => {
    setPicked(gameId)
    requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      panel.scrollIntoView({ block: 'start', behavior: motionReduced() ? 'auto' : 'smooth' })
      panel.querySelector<HTMLElement>('.tro-open-title')?.focus({ preventScroll: true })
    })
  }

  return (
    <div className="page tro">
      {data.state === 'scanning' && <ScanBand progress={data.progress} />}
      {blocked && <Blocked {...blocked} inline />}

      {!(empty && data.state === 'scanning') && <Summary data={data} onShow={show} />}

      {!empty && open && (
        <>
          <OpenGame key={open.gameId} ref={panelRef} game={open} gameOf={gameOf} onOpen={onOpen} />
          <GameList list={data.games.filter((g) => g.gameId !== open.gameId)} gameOf={gameOf} onShow={show} />
          <Highlights data={data} onShow={show} />
        </>
      )}
      {empty && data.state === 'ready' && (
        <Blocked icon="trophy" title="Aucun succès pour l'instant" text="Aucun de tes jeux Steam joués n'a de succès débloqué ou à débloquer." />
      )}

      <Footer data={data} onRefresh={refresh} />
    </div>
  )
}

/** Le jeu choisi s'il est toujours là, sinon celui du dernier succès, sinon le plus avancé. */
function openGameOf(data: AchievementsOverview, picked: string | null): AchievementGame | undefined {
  const find = (id: string | undefined): AchievementGame | undefined => (id ? data.games.find((g) => g.gameId === id) : undefined)
  return find(picked ?? undefined) ?? find(data.recent[0]?.gameId) ?? [...data.games].sort(byProgress)[0]
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
    <div className={`tro-blocked ${inline ? 'is-inline' : ''}`} role={inline ? 'status' : undefined}>
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

function ScanBand({ progress }: { progress?: { done: number; total: number } }): React.JSX.Element {
  const total = progress?.total ?? 0
  const done = Math.min(progress?.done ?? 0, total)
  return (
    <div className="tro-scan" role="status">
      <span className="spinner" aria-hidden="true" />
      <div className="tro-scan-text">
        <p className="tro-scan-title">
          Relevé de tes succès Steam{total ? <span className="num"> · {done} / {plural(total, 'jeu', 'jeux')}</span> : '…'}
        </p>
      </div>
      {total > 0 && (
        <span className="tro-bar tro-scan-bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${done / total})` }} />
        </span>
      )}
    </div>
  )
}

function TrophiesSkeleton(): React.JSX.Element {
  return (
    <div className="tro-skel" aria-hidden="true">
      <div className="tro-tiles">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skel tro-tile-skel" />
        ))}
      </div>
      <div className="skel tro-open-skel" />
    </div>
  )
}

/* ---------- résumé ---------- */

function Summary({ data, onShow }: { data: AchievementsOverview; onShow: (gameId: string) => void }): React.JSX.Element {
  const started = data.games.filter((g) => g.unlocked > 0).length
  const last = data.recent[0] as AchievementPick | undefined
  return (
    <section className="tro-tiles" aria-label="Résumé">
      <div className="tro-tile is-gold">
        <span className="tro-tile-num num">{fmt.format(data.unlocked)}</span>
        <span className="tro-tile-label">Succès débloqués</span>
        <span className="tro-tile-sub num">sur {fmt.format(data.total)}</span>
      </div>
      <div className="tro-tile">
        <span className="tro-tile-num num">{fmt.format(data.games.length)}</span>
        <span className="tro-tile-label">Jeux avec des succès</span>
        <span className="tro-tile-sub num">{data.perfect ? `dont ${fmt.format(data.perfect)} à 100 %` : 'Aucun à 100 % pour l’instant'}</span>
      </div>
      <div className="tro-tile">
        <span className="tro-tile-num num">{data.average}&#8239;%</span>
        <span className="tro-tile-label">Progression moyenne</span>
        <span className="tro-tile-sub">{started ? `sur ${plural(started, 'jeu commencé', 'jeux commencés')}` : 'Aucun jeu commencé'}</span>
      </div>
      {last ? (
        <button className="tro-tile is-last" onClick={() => onShow(last.gameId)} title={`${last.name} · ${formatDate(last.unlockedAt)}`}>
          <span className="tro-tile-name">{last.name}</span>
          <span className="tro-tile-label">
            Dernier succès · {cleanName(last.gameName)} · <span className="tro-tile-when num">{timeAgo(last.unlockedAt)}</span>
          </span>
        </button>
      ) : (
        <div className="tro-tile is-last">
          <span className="tro-tile-name is-none">Aucun succès débloqué</span>
          <span className="tro-tile-label">Dernier succès</span>
        </div>
      )}
    </section>
  )
}

/* ---------- jeu ouvert ---------- */

const byRecent = (a: Achievement, b: Achievement): number => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0)
// Pas encore débloqués : les plus courants d'abord (les plus faciles à aller chercher).
const byCommon = (a: Achievement, b: Achievement): number => (b.percent ?? -1) - (a.percent ?? -1)

/** Pourquoi la liste d'un jeu ne vient pas (le relevé de la page, lui, a pu la lire). */
function gameBlockedText(state: GameAchievements['state']): string {
  switch (state) {
    case 'no-account':
      return 'Connecte ton compte Steam (Paramètres › Comptes) pour voir ces succès.'
    case 'no-key':
      return 'Ajoute ta clé Steam Web API (Paramètres › Comptes) pour voir ces succès.'
    case 'key-refused':
      return 'Steam refuse ta clé Web API : vérifie-la dans Paramètres › Comptes.'
    case 'private':
      return 'Ton profil Steam cache les détails de tes jeux : passe-les en « Public » dans ta confidentialité Steam.'
    default:
      return 'Steam ne donne pas la liste des succès de ce jeu.'
  }
}

interface OpenGameProps {
  ref: React.Ref<HTMLElement>
  game: AchievementGame
  gameOf: GameOf
  onOpen: (g: Game) => void
}

function OpenGame({ ref, game, gameOf, onOpen }: OpenGameProps): React.JSX.Element {
  const { state, reload } = useAchievements(game.gameId, true)
  const [filter, setFilter] = useState<AchFilter>('all')
  const [all, setAll] = useState(false)
  const full = gameOf(game.gameId, game.name)
  const name = cleanName(game.name)

  const data = state.status === 'ready' && state.data.state === 'ready' ? state.data : null
  // Les chiffres du relevé tant que la liste n'est pas lue, puis ceux de Steam.
  const unlocked = data?.unlocked ?? game.unlocked
  const total = data?.total ?? game.total
  const pct = completion(unlocked, total)

  const list = useMemo(() => {
    if (!data) return []
    const done = data.list.filter(isUnlocked).sort(byRecent)
    const todo = data.list.filter((a) => !isUnlocked(a)).sort(byCommon)
    return filter === 'done' ? done : filter === 'todo' ? todo : [...done, ...todo]
  }, [data, filter])
  const shown = all ? list : list.slice(0, ACH_FIRST)

  const filters: { id: AchFilter; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'done', label: 'Débloqués' },
    { id: 'todo', label: 'À faire' }
  ]

  return (
    <section ref={ref} className="tro-open" aria-labelledby="tro-open-h" aria-busy={state.status === 'loading'}>
      <div className="tro-open-head">
        <span className="tro-thumb is-lg">
          <Cover game={full} showTitle={false} />
        </span>
        <div className="tro-open-main">
          <div className="tro-open-line">
            <h2 id="tro-open-h" className="tro-open-title" tabIndex={-1}>
              {name}
            </h2>
            <span className="tro-open-count num">
              {unlocked} / {total} · {pct}&#8239;%
            </span>
          </div>
          <span className="tro-bar is-big" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Succès débloqués dans ${name}`}>
            <span style={{ transform: `scaleX(${pct / 100})` }} />
          </span>
        </div>
        <div className="tro-seg" role="group" aria-label="Filtrer les succès">
          {filters.map((f) => (
            <button key={f.id} className="tro-seg-btn" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} disabled={!data}>
              {f.label}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm tro-open-sheet" onClick={() => onOpen(full)}>
          Ouvrir la fiche
          <Icon name="chevron-right" size={14} />
        </button>
      </div>

      {state.status === 'loading' && (
        <div className="tro-achs" aria-hidden="true">
          {Array.from({ length: CARDS }, (_, i) => (
            <span key={i} className="skel tro-ach-skel" />
          ))}
        </div>
      )}
      {state.status === 'error' && (
        <div className="tro-open-note">
          <p className="caption">{state.message}</p>
          <button className="btn btn-secondary btn-sm" onClick={reload}>
            <Icon name="refresh" size={14} />
            Réessayer
          </button>
        </div>
      )}
      {state.status === 'ready' && !data && (
        <div className="tro-open-note">
          <p className="caption">{gameBlockedText(state.data.state)}</p>
        </div>
      )}
      {data &&
        (shown.length ? (
          <>
            <ul className="tro-achs">
              {shown.map((a) => (
                <li key={a.id}>
                  <AchCard ach={a} />
                </li>
              ))}
            </ul>
            {list.length > ACH_FIRST && (
              <button className="btn btn-ghost btn-sm tro-achs-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
                {all ? 'Réduire' : `Afficher les ${list.length - ACH_FIRST} autres`}
                <Icon name="chevron-down" size={14} className={`tro-more-chevron ${all ? 'is-open' : ''}`} />
              </button>
            )}
          </>
        ) : (
          <p className="caption tro-open-note">{filter === 'done' ? 'Aucun succès débloqué dans ce jeu pour l’instant.' : 'Tous les succès de ce jeu sont débloqués.'}</p>
        ))}
    </section>
  )
}

/** Un succès du jeu ouvert : trophée doré une fois débloqué, cadenas sinon. Un succès caché reste masqué. */
function AchCard({ ach }: { ach: Achievement }): React.JSX.Element {
  const done = isUnlocked(ach)
  const secret = ach.hidden && !done
  const name = secret ? 'Succès caché' : ach.name
  const rarity = ach.percent !== undefined ? `${formatPercent(ach.percent)} des joueurs` : ''
  const tip = [secret ? 'Steam ne le dévoile qu’une fois débloqué.' : ach.description, rarity].filter(Boolean).join(' · ')
  return (
    <div className={`tro-ach ${done ? 'is-done' : ''}`} title={tip || undefined}>
      <span className="tro-ach-icon" aria-hidden="true">
        <Icon name={done ? 'trophy' : 'lock'} size={22} />
      </span>
      <span className="tro-ach-text">
        <span className="tro-ach-name">{name}</span>
        <span className="tro-ach-sub num">{done ? `Débloqué le ${dayFmt.format(ach.unlockedAt!)}` : 'Pas encore débloqué'}</span>
      </span>
    </div>
  )
}

/* ---------- les autres jeux ---------- */

function GameList({ list, gameOf, onShow }: { list: AchievementGame[]; gameOf: GameOf; onShow: (gameId: string) => void }): React.JSX.Element | null {
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
    if (sort === 'name') return [...base].sort(byName)
    if (sort === 'recent') return [...base].sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0) || byName(a, b))
    return [...base].sort(byProgress)
  }, [groups, filter, sort])

  if (!list.length) return null

  const filters: { id: GameFilter; label: string; count: number }[] = [
    { id: 'started', label: 'En cours', count: groups.started.length },
    { id: 'perfect', label: 'À 100 %', count: groups.perfect.length },
    { id: 'todo', label: 'Pas commencés', count: groups.todo.length },
    { id: 'all', label: 'Tous', count: list.length }
  ]

  return (
    <section className="tro-others" aria-labelledby="tro-others-h">
      <div className="tro-others-head">
        <h2 id="tro-others-h" className="tro-h">
          Tes autres jeux
        </h2>
        <div className="tro-seg" role="group" aria-label="Afficher">
          {filters.map((f) => (
            <button key={f.id} className="tro-seg-btn" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
              <span className="tro-seg-count num">{f.count}</span>
            </button>
          ))}
        </div>
        <PickMenu label="Trier" value={sort} options={SORTS} onPick={setSort} className="tro-sort" />
      </div>
      {shown.length ? (
        <ul className="tro-games">
          {shown.map((g) => {
            const pct = completion(g.unlocked, g.total)
            const name = cleanName(g.name)
            return (
              <li key={g.gameId}>
                <button
                  className="tro-game"
                  onClick={() => onShow(g.gameId)}
                  aria-label={`${name} : ${g.unlocked} succès sur ${g.total}, ${pct} %`}
                  title={g.lastAt ? `Dernier succès ${timeAgo(g.lastAt)}` : 'Aucun succès débloqué'}
                >
                  <span className="tro-thumb">
                    <Cover game={gameOf(g.gameId, g.name)} showTitle={false} />
                  </span>
                  <span className="tro-game-name">{name}</span>
                  <span className="tro-bar" aria-hidden="true">
                    <span style={{ transform: `scaleX(${pct / 100})` }} />
                  </span>
                  <span className="tro-game-count num">
                    {g.unlocked} / {g.total}
                  </span>
                  <Icon name="chevron-right" size={18} className="tro-game-chevron" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="caption tro-others-empty">Aucun jeu ici pour l'instant.</p>
      )}
    </section>
  )
}

/* ---------- derniers et plus rares ---------- */

function Highlights({ data, onShow }: { data: AchievementsOverview; onShow: (gameId: string) => void }): React.JSX.Element | null {
  const tabs = [
    { id: 'recent' as const, label: 'Derniers débloqués', picks: data.recent.slice(0, CARDS) },
    { id: 'rarest' as const, label: 'Tes plus rares', picks: data.rarest.slice(0, CARDS) }
  ].filter((t) => t.picks.length)
  const [tab, setTab] = useState<'recent' | 'rarest'>('recent')
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]
  if (!current) return null

  return (
    <section className="tro-picks" aria-labelledby="tro-picks-h">
      <div className="tro-others-head">
        <h2 id="tro-picks-h" className="tro-h">
          Succès à retenir
        </h2>
        {tabs.length > 1 && (
          <div className="tro-seg" role="group" aria-label="Succès à retenir">
            {tabs.map((t) => (
              <button key={t.id} className="tro-seg-btn" aria-pressed={current.id === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="tro-achs">
        {current.picks.map((p) => {
          const rarity = current.id === 'rarest' ? rarityOf(p.percent) : null
          return (
            <li key={`${p.gameId}:${p.id}`}>
              <button className="tro-ach is-done is-pick" onClick={() => onShow(p.gameId)} title={p.description}>
                <span className="tro-ach-icon" aria-hidden="true">
                  <Icon name="trophy" size={22} />
                </span>
                <span className="tro-ach-text">
                  <span className="tro-ach-name">{p.name}</span>
                  <span className="tro-ach-sub">{cleanName(p.gameName)}</span>
                  <span className={`tro-ach-sub num ${rarity ? `is-${rarity.tier}` : ''}`}>
                    {current.id === 'rarest' ? `${formatPercent(p.percent!)} des joueurs${rarity ? ` · ${rarity.label}` : ''}` : capitalize(timeAgo(p.unlockedAt))}
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

/* ---------- pied ---------- */

function Footer({ data, onRefresh }: { data: AchievementsOverview; onRefresh: () => void }): React.JSX.Element {
  const lvl = data.level
  const xpPct = lvl && lvl.xpForLevel ? Math.round((lvl.xpInLevel / lvl.xpForLevel) * 100) : 0
  return (
    <footer className="tro-foot">
      {lvl && (
        <div className="tro-level-row">
          <span className="tro-level num" aria-label={`Niveau Steam ${lvl.level}`}>
            {lvl.level}
          </span>
          <span className="tro-level-text">
            <span className="tro-level-title">Niveau Steam</span>
            <span className="caption num">
              {plural(lvl.badges, 'badge', 'badges')} · {fmt.format(lvl.xpInLevel)} / {fmt.format(lvl.xpForLevel)} XP vers le niveau {lvl.level + 1}
            </span>
          </span>
          <span className="tro-bar tro-level-bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${xpPct / 100})` }} />
          </span>
        </div>
      )}
      <p className="caption tro-foot-note">
        {data.updatedAt ? `Relevé ${timeAgo(data.updatedAt)} · ` : ''}
        {data.state !== 'scanning' && (
          <button className="link-btn" onClick={onRefresh}>
            Actualiser
          </button>
        )}
      </p>
    </footer>
  )
}
