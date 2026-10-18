import { useEffect, useMemo, useRef, useState } from 'react'
import { cleanName, norm } from '@shared/text'
import type { Account, Friend, FriendPlatform, FriendsResult, FriendStatus, Game } from '@shared/types'
import type { FriendsPanelProps } from '../../contracts'
import { Avatar } from '../ui/Avatar'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { Segmented } from '../ui/Overlay'
import { StoreTag } from '../ui/StoreTag'
import './friends.css'

type Filter = 'all' | FriendPlatform

const PLATFORM_ORDER: FriendPlatform[] = ['steam', 'psn', 'discord']
// Discord : membres en ligne d'un serveur, jamais des « amis ».
const PLATFORM_NAME: Record<FriendPlatform, string> = { steam: 'Steam', psn: 'PlayStation', discord: 'Serveur Discord' }

const SECTIONS: { key: FriendStatus; label: string }[] = [
  { key: 'in-game', label: 'En jeu' },
  { key: 'online', label: 'En ligne' },
  { key: 'away', label: 'Absent' },
  { key: 'offline', label: 'Hors ligne' }
]
const STATUS_LABEL: Record<FriendStatus, string> = { 'in-game': 'En jeu', online: 'En ligne', away: 'Absent', offline: 'Hors ligne' }

const COLLAPSED_KEY = 'pg.friends.collapsed'
type Collapsed = Record<FriendStatus, boolean>
const DEFAULT_COLLAPSED: Collapsed = { 'in-game': false, online: false, away: false, offline: true }

/** Ami (ou membre Discord) classé pour l'affichage. */
interface Entry {
  friend: Friend
  status: FriendStatus
  /** Clé du jeu (EN JEU uniquement). */
  gameKey?: string
  /** Activité Discord qui ne correspond à aucun jeu de la bibliothèque. */
  activity?: string
}

interface GameGroup {
  key: string
  name: string
  game: Pick<Game, 'name' | 'coverUrl' | 'heroUrl'>
  coverKey: string
  entries: Entry[]
}

const gameKey = (name: string): string => norm(name) || name.trim().toLowerCase()
const byName = (a: Entry, b: Entry): number => a.friend.name.localeCompare(b.friend.name, 'fr', { sensitivity: 'base' })

function readCollapsed(): Collapsed {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    if (!raw) return { ...DEFAULT_COLLAPSED }
    const v: unknown = JSON.parse(raw)
    if (Array.isArray(v)) return { 'in-game': v.includes('in-game'), online: v.includes('online'), away: v.includes('away'), offline: v.includes('offline') }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      const pick = (k: FriendStatus): boolean => (typeof o[k] === 'boolean' ? (o[k] as boolean) : DEFAULT_COLLAPSED[k])
      return { 'in-game': pick('in-game'), online: pick('online'), away: pick('away'), offline: pick('offline') }
    }
  } catch {
    // stockage indisponible ou valeur illisible : valeurs par défaut
  }
  return { ...DEFAULT_COLLAPSED }
}

function writeCollapsed(c: Collapsed): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(c))
  } catch {
    // sans importance : simple confort
  }
}

function libraryIndex(games: Game[]): Map<string, Game> {
  const map = new Map<string, Game>()
  for (const g of games) {
    const k = norm(g.name)
    if (k && !map.has(k)) map.set(k, g)
  }
  return map
}

/** Un membre Discord n'est « en jeu » que si son activité est un jeu de la bibliothèque (sinon Spotify, statut perso…). */
function classify(friend: Friend, library: Map<string, Game>): Entry {
  if (friend.status !== 'in-game') return { friend, status: friend.status }
  if (!friend.game) return { friend, status: 'online' }
  const key = gameKey(friend.game)
  if (friend.platform === 'discord' && !library.has(key)) return { friend, status: 'online', activity: friend.game }
  return { friend, status: 'in-game', gameKey: key }
}

/** Plateformes présentes dans les résultats ou connectées. Un compte Discord seul n'apporte pas de membres : il ne compte pas. */
function presentPlatforms(result: FriendsResult, accounts: Account[]): FriendPlatform[] {
  return PLATFORM_ORDER.filter(
    (p) =>
      result.friends.some((f) => f.platform === p) ||
      Boolean(result.errors[p]) ||
      (p !== 'discord' && accounts.some((a) => a.platform === p))
  )
}

function groupByGame(entries: Entry[], library: Map<string, Game>): GameGroup[] {
  const groups = new Map<string, GameGroup>()
  for (const e of entries) {
    const key = e.gameKey ?? ''
    let g = groups.get(key)
    if (!g) {
      const lib = library.get(key)
      const name = cleanName(lib?.name ?? e.friend.game ?? '') || (e.friend.game ?? '')
      g = { key, name, game: lib ?? { name }, coverKey: lib?.id ?? `jeu:${key}`, entries: [] }
      groups.set(key, g)
    }
    g.entries.push(e)
  }
  const list = [...groups.values()]
  for (const g of list) g.entries.sort(byName)
  return list.sort((a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
}

function subLine({ friend, status, activity }: Entry): string {
  const parts = [STATUS_LABEL[status]]
  if (friend.platform === 'discord') {
    if (activity) parts.push(activity)
    parts.push('Serveur Discord')
  } else if (friend.device && (status === 'in-game' || status === 'online')) {
    parts.push(friend.device)
  }
  return parts.join(' · ')
}

/**
 * Vrai une fois un premier chargement terminé (ou des données reçues).
 * Sans chargement en cours au montage, on attend un court instant qu'il démarre.
 */
function useSettled(loading: boolean, hasData: boolean): boolean {
  const [settled, setSettled] = useState(hasData)
  const wasLoading = useRef(false)
  useEffect(() => {
    if (loading) {
      wasLoading.current = true
      return
    }
    if (wasLoading.current) {
      setSettled(true)
      return
    }
    const t = setTimeout(() => setSettled(true), 400)
    return () => clearTimeout(t)
  }, [loading])
  return settled || hasData
}

/** Ids des amis qui viennent de passer « en jeu » (deux impulsions d'anneau, une seule fois). */
function useInGamePulse(entries: Entry[]): ReadonlySet<string> {
  const prev = useRef<Map<string, FriendStatus> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [pulsing, setPulsing] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    const next = new Map(entries.map((e) => [e.friend.id, e.status]))
    const before = prev.current
    prev.current = next
    if (!before) return
    const fresh = [...next].filter(([id, s]) => s === 'in-game' && before.has(id) && before.get(id) !== 'in-game').map(([id]) => id)
    if (!fresh.length) return
    setPulsing(new Set(fresh))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPulsing(new Set()), 2500)
  }, [entries])
  useEffect(() => () => clearTimeout(timer.current), [])
  return pulsing
}

export function FriendsPanel({ result, accounts, games, demo, discordConfigured, loading, onRefresh, onHide, onOpenAccounts }: FriendsPanelProps): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')
  const [collapsed, setCollapsed] = useState<Collapsed>(readCollapsed)

  const library = useMemo(() => libraryIndex(games), [games])
  const entries = useMemo(() => result.friends.map((f) => classify(f, library)), [result.friends, library])
  const platforms = useMemo(() => presentPlatforms(result, accounts), [result, accounts])
  const pulsing = useInGamePulse(entries)

  const hasData = result.friends.length > 0 || Object.values(result.errors).some(Boolean)
  const settled = useSettled(loading, hasData)

  // Une plateforme filtrée qui disparaît : retour à « Tous ».
  const active: Filter = filter !== 'all' && platforms.includes(filter) ? filter : 'all'
  const visible = useMemo(() => (active === 'all' ? entries : entries.filter((e) => e.friend.platform === active)), [entries, active])
  const errors = PLATFORM_ORDER.filter((p) => result.errors[p] && (active === 'all' || active === p))
  const onlineCount = entries.filter((e) => e.status !== 'offline').length

  const bySection = useMemo(() => {
    const out: Record<FriendStatus, Entry[]> = { 'in-game': [], online: [], away: [], offline: [] }
    for (const e of visible) out[e.status].push(e)
    for (const k of Object.keys(out) as FriendStatus[]) out[k].sort(byName)
    return out
  }, [visible])
  const gameGroups = useMemo(() => groupByGame(bySection['in-game'], library), [bySection, library])

  const toggle = (k: FriendStatus): void => {
    const next = { ...collapsed, [k]: !collapsed[k] }
    setCollapsed(next)
    writeCollapsed(next)
  }

  // Premier chargement d'abord : « aucun compte » seulement une fois la réponse arrivée.
  const firstLoad = !hasData && !settled
  const noAccount = !firstLoad && !hasData && accounts.length === 0 && !demo && !discordConfigured
  // Serveur Discord seul, sans membre en ligne : la légende Discord plutôt que la générique.
  const captionFilter: Filter = active === 'all' && discordConfigured && platforms.length === 0 ? 'discord' : active
  const allOffline = visible.length > 0 && bySection.offline.length === visible.length

  let body: React.ReactNode
  if (firstLoad) {
    body = <SkeletonRows />
  } else if (noAccount) {
    body = <NoAccount onOpenAccounts={onOpenAccounts} />
  } else {
    body = (
      <>
        {errors.map((p) => (
          <div key={p} className="fr-error">
            <Icon name="alert-triangle" size={16} className="fr-error-icon" />
            <div className="fr-error-text">
              <strong>{PLATFORM_NAME[p]}</strong>
              <span>{result.errors[p]}</span>
              <button className="link-btn" aria-label={`Corriger : ${PLATFORM_NAME[p]}`} onClick={onOpenAccounts}>
                Corriger
              </button>
            </div>
          </div>
        ))}
        {visible.length === 0 && errors.length === 0 && <p className="caption fr-caption">{emptyCaption(captionFilter)}</p>}
        {allOffline && <p className="caption fr-caption">Tous tes amis sont hors ligne.</p>}
        {SECTIONS.map(({ key, label }) => {
          const list = bySection[key]
          if (!list.length) return null
          return (
            <Section key={key} id={key} label={label} count={list.length} collapsed={collapsed[key]} onToggle={() => toggle(key)}>
              {key === 'in-game' ? (
                gameGroups.map((g) => <GameGroupBlock key={g.key} group={g} pulsing={pulsing} />)
              ) : (
                <ul className="fr-rows">
                  {list.map((e) => (
                    <Row key={e.friend.id} entry={e} pulse={false} />
                  ))}
                </ul>
              )}
            </Section>
          )
        })}
      </>
    )
  }

  return (
    <aside className="friends" aria-label="Amis">
      <header className="fr-head">
        <h2 className="fr-title">Amis</h2>
        {result.friends.length > 0 && (
          <span className={`pill fr-count num ${onlineCount > 0 ? 'pill-success' : 'pill-muted'}`}>{onlineCount} en ligne</span>
        )}
        <div className="fr-head-actions">
          <button
            className="icon-btn icon-btn-sm"
            aria-label="Actualiser"
            title="Actualiser"
            aria-busy={loading}
            onClick={() => {
              if (!loading) onRefresh()
            }}
          >
            <Icon name="refresh" size={16} className={loading ? 'spin' : undefined} />
          </button>
          <button className="icon-btn icon-btn-sm" aria-label="Masquer les amis" title="Masquer les amis" onClick={onHide}>
            <Icon name="panel-right" size={16} />
          </button>
        </div>
      </header>

      {!noAccount && platforms.length > 1 && (
        <div className="fr-filter">
          <Segmented<Filter>
            className={`fr-seg ${platforms.length >= 3 ? 'is-grid' : ''}`}
            label="Filtrer par plateforme"
            value={active}
            onChange={setFilter}
            options={[{ value: 'all', label: 'Tous' }, ...platforms.map((p) => ({ value: p as Filter, label: PLATFORM_NAME[p] }))]}
          />
        </div>
      )}

      <div className="fr-list" aria-busy={loading}>
        {body}
      </div>
    </aside>
  )
}

function emptyCaption(filter: Filter): string {
  if (filter === 'discord') return 'Aucun membre en ligne sur ce serveur Discord.'
  if (filter === 'all') return "Personne à afficher pour l'instant."
  return `Aucun ami ${PLATFORM_NAME[filter]} à afficher.`
}

interface SectionProps {
  id: FriendStatus
  label: string
  count: number
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}

function Section({ id, label, count, collapsed, onToggle, children }: SectionProps): React.JSX.Element {
  const bodyId = `fr-sec-${id}`
  return (
    <section className={`fr-section ${collapsed ? 'is-collapsed' : ''}`}>
      <button className="fr-section-head" aria-expanded={!collapsed} aria-controls={bodyId} onClick={onToggle}>
        <Icon name="chevron-down" size={12} className="fr-chev" />
        <span className="overline">{label}</span>
        <span className="fr-section-count num">{count}</span>
      </button>
      <div className="fr-section-body" id={bodyId}>
        <div className="fr-section-inner" inert={collapsed}>
          {children}
        </div>
      </div>
    </section>
  )
}

function GameGroupBlock({ group, pulsing }: { group: GameGroup; pulsing: ReadonlySet<string> }): React.JSX.Element {
  return (
    <div className="fr-group">
      <div className="fr-group-head">
        <span className="fr-mini">
          <Cover key={group.coverKey} game={group.game} variant="letter" />
        </span>
        <span className="fr-group-name" title={group.name}>
          {group.name}
        </span>
        <span className="fr-group-count num">{group.entries.length}</span>
      </div>
      <ul className="fr-rows">
        {group.entries.map((e) => (
          <Row key={e.friend.id} entry={e} pulse={pulsing.has(e.friend.id)} />
        ))}
      </ul>
    </div>
  )
}

function Row({ entry, pulse }: { entry: Entry; pulse: boolean }): React.JSX.Element {
  const { friend, status } = entry
  const sub = subLine(entry)
  return (
    <li className={`fr-row st-${status}`}>
      <span className={`fr-av ${status === 'in-game' ? 'fx-loop' : ''} ${pulse ? 'is-pulsing' : ''}`}>
        <Avatar name={friend.name} url={friend.avatarUrl} size={32} status={status} />
      </span>
      <span className="fr-text">
        <span className="fr-name" title={friend.name}>
          {friend.name}
        </span>
        <span className="fr-sub" title={sub}>
          {sub}
        </span>
      </span>
      <StoreTag kind={friend.platform} size={18} className="fr-tag" />
    </li>
  )
}

function NoAccount({ onOpenAccounts }: { onOpenAccounts: () => void }): React.JSX.Element {
  return (
    <div className="fr-empty">
      <span className="fr-empty-icon">
        <Icon name="users" size={24} />
      </span>
      <h3>Personne ici pour l'instant</h3>
      <p>Connecte Steam, PlayStation ou un serveur Discord pour voir qui est en ligne.</p>
      <button className="btn btn-secondary btn-sm" onClick={onOpenAccounts}>
        Connecter un compte
      </button>
    </div>
  )
}

const SKELETON_WIDTHS = [62, 48, 70, 55, 66, 50]

function SkeletonRows(): React.JSX.Element {
  return (
    <div className="fr-skeleton">
      <span className="sr-only">Chargement…</span>
      {SKELETON_WIDTHS.map((w, i) => (
        <div key={i} className="fr-skel-row" aria-hidden="true">
          <span className="skel fr-skel-av" />
          <span className="fr-skel-lines">
            <span className="skel fr-skel-line" style={{ width: `${w}%` }} />
            <span className="skel fr-skel-line short" style={{ width: `${w - 20}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}
