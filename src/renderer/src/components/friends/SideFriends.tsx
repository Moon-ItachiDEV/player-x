import { useEffect, useMemo, useRef, useState } from 'react'
import { cleanName, norm, plural } from '@shared/text'
import type { Friend, FriendPlatform, FriendStatus, Game, HiddenMember } from '@shared/types'
import type { SideFriendsProps } from '../../contracts'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { StoreTag } from '../ui/StoreTag'
import './friends.css'

export type { SideFriendsProps }

// Discord : membres en ligne d'un serveur, jamais des « amis ».
const PLATFORM_NAME: Record<FriendPlatform, string> = { steam: 'Steam', psn: 'PlayStation', discord: 'Serveur Discord' }
const STATUS_LABEL: Record<FriendStatus, string> = { 'in-game': 'En jeu', online: 'En ligne', away: 'Absent', offline: 'Hors ligne' }
const STATUS_RANK: Record<FriendStatus, number> = { 'in-game': 0, online: 1, away: 2, offline: 3 }
const ERROR_ORDER: FriendPlatform[] = ['steam', 'psn', 'discord']

const GROUPS_KEY = 'pg.side.groups'
type Group = 'offline' | 'discord'
type Folded = Record<Group, boolean>
const DEFAULT_FOLDED: Folded = { offline: true, discord: true }

/** Ami (ou membre Discord) classé pour l'affichage. */
interface Entry {
  friend: Friend
  status: FriendStatus
  /** Jeu de la bibliothèque (ou nommé par Steam / PSN) quand il est en jeu. */
  game?: string
  /** Activité Discord qui ne correspond à aucun jeu de la bibliothèque. */
  activity?: string
}

function readFolded(): Folded {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? 'null')
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      return { offline: o.offline !== false, discord: o.discord !== false }
    }
  } catch {
    // stockage indisponible ou valeur illisible : valeurs par défaut
  }
  return { ...DEFAULT_FOLDED }
}

function writeFolded(f: Folded): void {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(f))
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
  const lib = library.get(norm(friend.game))
  if (friend.platform === 'discord' && !lib) return { friend, status: 'online', activity: friend.game }
  return { friend, status: 'in-game', game: cleanName(lib?.name ?? friend.game) || friend.game }
}

/** En jeu d'abord (regroupés par jeu), puis en ligne, absents, hors ligne ; par nom ensuite. */
function byStatus(a: Entry, b: Entry): number {
  return (
    STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
    (a.game ?? '').localeCompare(b.game ?? '', 'fr', { sensitivity: 'base' }) ||
    a.friend.name.localeCompare(b.friend.name, 'fr', { sensitivity: 'base' })
  )
}

function subLine({ friend, status, game, activity }: Entry): string {
  const parts = [status === 'in-game' && game ? game : STATUS_LABEL[status]]
  if (activity) parts.push(activity)
  if (friend.device && (status === 'in-game' || status === 'online')) parts.push(friend.device)
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

/** « 4 bots masqués », « 1 membre masqué », « 4 bots et 1 membre masqués » ; vide si personne. */
function maskedLabel(hidden: HiddenMember[]): string {
  const bots = hidden.filter((h) => h.reason === 'bot').length
  const users = hidden.length - bots
  const parts = [bots ? plural(bots, 'bot', 'bots') : '', users ? plural(users, 'membre', 'membres') : ''].filter(Boolean)
  return parts.length ? `${parts.join(' et ')} masqué${hidden.length > 1 ? 's' : ''}` : ''
}

/** Liste d'amis (page Amis) : en jeu, en ligne et absents visibles ; hors ligne et serveur Discord repliables. */
export function SideFriends(props: SideFriendsProps): React.JSX.Element {
  const { result, accounts, games, demo, discordConfigured, loading, open, onToggleOpen, onRefresh, onOpenAccounts, onHideMember, onManageHidden } = props
  const [folded, setFolded] = useState<Folded>(readFolded)

  const library = useMemo(() => libraryIndex(games), [games])
  const entries = useMemo(() => result.friends.map((f) => classify(f, library)), [result.friends, library])
  const pulsing = useInGamePulse(entries)

  const { pals, offline, members } = useMemo(() => {
    const real = entries.filter((e) => e.friend.platform !== 'discord').sort(byStatus)
    return {
      pals: real.filter((e) => e.status !== 'offline'),
      offline: real.filter((e) => e.status === 'offline'),
      members: entries.filter((e) => e.friend.platform === 'discord').sort(byStatus)
    }
  }, [entries])
  const inGame = pals.filter((e) => e.status === 'in-game').length
  // Membres masqués présents sur le serveur (bots connus, « Masquer ») : une ligne discrète pour les retrouver.
  const masked = maskedLabel((result.hidden ?? []).filter((h) => h.online))

  // Après « Masquer », la ligne disparaît avec son bouton : le focus passe à l'œil du membre suivant (sinon du précédent,
  // sinon à l'en-tête du groupe) une fois la liste relue. On attend que le membre masqué ait quitté la liste, et on
  // oublie la demande si « Masquer » a échoué : sinon un rafraîchissement plus tard volerait le focus.
  const focusAfterHide = useRef<{ hidden: string; next: string } | null>(null)
  const hide = (e: Entry): void => {
    const i = members.findIndex((m) => m.friend.id === e.friend.id)
    const next = members[i + 1] ?? members[i - 1]
    const pending = { hidden: e.friend.id, next: next ? next.friend.id : 'fold' }
    focusAfterHide.current = pending
    void onHideMember(e.friend).then((ok) => {
      if (!ok && focusAfterHide.current === pending) focusAfterHide.current = null
    })
  }
  useEffect(() => {
    const pending = focusAfterHide.current
    if (!pending || members.some((m) => m.friend.id === pending.hidden)) return
    focusAfterHide.current = null
    const active = document.activeElement
    if (active && active !== document.body) return
    const id = pending.next
    const target =
      id === 'fold'
        ? document.querySelector<HTMLElement>('.sf-fold-head[aria-controls="sf-fold-discord"], .sf-masked-btn')
        : document.querySelector<HTMLElement>(`[data-member="${CSS.escape(id)}"] .sf-hide`)
    target?.focus({ preventScroll: true })
  }, [members])

  const hasData = result.friends.length > 0 || Object.values(result.errors).some(Boolean)
  const settled = useSettled(loading, hasData)
  const firstLoad = !hasData && !settled
  // Un compte Discord seul n'apporte personne (il faut un serveur) : on propose les sources d'amis.
  const noAccount = !firstLoad && !hasData && !accounts.some((a) => a.platform !== 'discord') && !demo && !discordConfigured
  const errors = ERROR_ORDER.filter((p) => result.errors[p])

  const toggle = (g: Group): void => {
    const next = { ...folded, [g]: !folded[g] }
    setFolded(next)
    writeFolded(next)
  }

  let body: React.ReactNode
  if (firstLoad) {
    body = <SkeletonRows />
  } else if (noAccount) {
    body = <NoAccount onOpenAccounts={onOpenAccounts} />
  } else {
    body = (
      <>
        {errors.map((p) => (
          <div key={p} className="sf-error">
            <Icon name="alert-triangle" size={14} className="sf-error-icon" />
            <span className="sf-error-text">
              <strong>{PLATFORM_NAME[p]}</strong> {result.errors[p]}
            </span>
            <button className="link-btn" aria-label={`Corriger : ${PLATFORM_NAME[p]}`} onClick={onOpenAccounts}>
              Corriger
            </button>
          </div>
        ))}
        {pals.length > 0 && (
          <ul className="sf-rows">
            {pals.map((e) => (
              <Row key={e.friend.id} entry={e} pulse={pulsing.has(e.friend.id)} />
            ))}
          </ul>
        )}
        {pals.length === 0 && errors.length === 0 && (
          <p className="sf-caption">{offline.length ? 'Tous tes amis sont hors ligne.' : members.length ? 'Aucun ami en ligne.' : "Personne à afficher pour l'instant."}</p>
        )}
        {offline.length > 0 && (
          <Fold id="offline" label="Hors ligne" count={offline.length} folded={folded.offline} onToggle={() => toggle('offline')}>
            {offline.map((e) => (
              <Row key={e.friend.id} entry={e} pulse={false} />
            ))}
          </Fold>
        )}
        {members.length > 0 && (
          <Fold id="discord" label="Serveur Discord" count={members.length} folded={folded.discord} onToggle={() => toggle('discord')} discord>
            {members.map((e) => (
              <Row key={e.friend.id} entry={e} pulse={pulsing.has(e.friend.id)} onHide={() => hide(e)} />
            ))}
            {masked && (
              <li className="sf-masked">
                <MaskedButton text={masked} onClick={onManageHidden} />
              </li>
            )}
          </Fold>
        )}
        {members.length === 0 && masked && (
          <div className="sf-masked">
            <MaskedButton text={masked} onClick={onManageHidden} />
          </div>
        )}
      </>
    )
  }

  return (
    <section className={`side-friends ${open ? '' : 'is-folded'}`} aria-label="Amis">
      <div className="sf-head">
        <button className="sf-toggle" aria-expanded={open} aria-controls="sf-body" onClick={onToggleOpen}>
          <span className="side-label">Amis</span>
          <Icon name="chevron-down" size={12} className="sf-chev" />
        </button>
        {inGame > 0 ? (
          <span className="sf-live num">{inGame} en jeu</span>
        ) : (
          pals.length > 0 && <span className="sf-online num">{pals.length} en ligne</span>
        )}
        <button
          className="icon-btn icon-btn-sm sf-refresh"
          aria-label="Actualiser les amis"
          title="Actualiser les amis"
          aria-busy={loading}
          onClick={() => {
            if (!loading) onRefresh()
          }}
        >
          <Icon name="refresh" size={14} className={loading ? 'spin' : undefined} />
        </button>
      </div>
      <div id="sf-body" className="sf-body" aria-busy={loading} hidden={!open}>
        {body}
      </div>
    </section>
  )
}

interface FoldProps {
  id: Group
  label: string
  count: number
  folded: boolean
  onToggle: () => void
  discord?: boolean
  children: React.ReactNode
}

function Fold({ id, label, count, folded, onToggle, discord, children }: FoldProps): React.JSX.Element {
  const bodyId = `sf-fold-${id}`
  return (
    <div className={`sf-fold ${folded ? 'is-folded' : ''}`}>
      <button className="sf-fold-head" aria-expanded={!folded} aria-controls={bodyId} onClick={onToggle}>
        {discord && <StoreTag kind="discord" size={18} />}
        <span>
          {label} · <span className="num">{count}</span>
        </span>
        <Icon name="chevron-right" size={12} className="sf-fold-chev" />
      </button>
      <ul id={bodyId} className="sf-rows" hidden={folded}>
        {children}
      </ul>
    </div>
  )
}

/** `onHide` : membre du serveur Discord, qu'on peut masquer (jamais un ami Steam ou PlayStation). */
function Row({ entry, pulse, onHide }: { entry: Entry; pulse: boolean; onHide?: () => void }): React.JSX.Element {
  const { friend, status } = entry
  const sub = subLine(entry)
  return (
    <li className={`sf-row st-${status}`} data-member={onHide ? friend.id : undefined}>
      <span className={`sf-av ${status === 'in-game' ? 'fx-loop' : ''} ${pulse ? 'is-pulsing' : ''}`}>
        <Avatar name={friend.name} url={friend.avatarUrl} size={30} status={status} />
      </span>
      <span className="sf-text">
        <span className="sf-name" title={friend.name}>
          {friend.name}
        </span>
        <span className="sf-sub" title={sub}>
          {sub}
        </span>
      </span>
      {onHide && (
        <button className="icon-btn icon-btn-sm sf-hide" aria-label={`Masquer ${friend.name}`} title="Masquer de la liste" onClick={onHide}>
          <Icon name="eye-off" size={14} />
        </button>
      )}
      {friend.platform !== 'discord' && <StoreTag kind={friend.platform} size={18} className="sf-tag" />}
    </li>
  )
}

/** « 4 bots masqués · Gérer » : vers Paramètres › Comptes › Membres masqués. */
function MaskedButton({ text, onClick }: { text: string; onClick: () => void }): React.JSX.Element {
  return (
    <button className="sf-masked-btn" onClick={onClick} aria-label={`${text}. Gérer les membres masqués dans Paramètres`}>
      <Icon name="eye-off" size={13} />
      <span className="sf-masked-text">{text}</span>
      <span className="sf-masked-link">Gérer</span>
    </button>
  )
}

function NoAccount({ onOpenAccounts }: { onOpenAccounts: () => void }): React.JSX.Element {
  return (
    <div className="sf-empty">
      <p>Connecte Steam, PlayStation ou un serveur Discord pour voir qui est en ligne.</p>
      <button className="btn btn-secondary btn-sm" onClick={onOpenAccounts}>
        <Icon name="link" size={14} />
        Connecter un compte
      </button>
    </div>
  )
}

const SKELETON_WIDTHS = [62, 48, 70, 55, 66]

function SkeletonRows(): React.JSX.Element {
  return (
    <div className="sf-skeleton">
      <span className="sr-only">Chargement…</span>
      {SKELETON_WIDTHS.map((w, i) => (
        <div key={i} className="sf-skel-row" aria-hidden="true">
          <span className="skel sf-skel-av" />
          <span className="sf-skel-lines">
            <span className="skel sf-skel-line" style={{ width: `${w}%` }} />
            <span className="skel sf-skel-line short" style={{ width: `${w - 20}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}
