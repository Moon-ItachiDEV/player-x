import { useEffect, useMemo, useRef, useState } from 'react'
import { cleanName, norm, plural } from '@shared/text'
import type { Friend, FriendPlatform, FriendStatus, Game, HiddenMember } from '@shared/types'
import type { SideFriendsProps } from '../../contracts'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import './friends.css'

export type { SideFriendsProps }

// Discord : membres d'un serveur, jamais des « amis ».
const PLATFORM_NAME: Record<FriendPlatform, string> = {
  steam: 'Steam',
  psn: 'PlayStation',
  discord: 'Serveur Discord'
}
const STATUS_LABEL: Record<FriendStatus, string> = {
  'in-game': 'En jeu',
  online: 'En ligne',
  away: 'Absent',
  offline: 'Hors ligne'
}
const STATUS_RANK: Record<FriendStatus, number> = {
  'in-game': 0,
  online: 1,
  away: 2,
  offline: 3
}
const ERROR_ORDER: FriendPlatform[] = ['steam', 'psn']

type Pal = 'steam' | 'psn'
type Filter = 'all' | Pal
const PALS: Pal[] = ['steam', 'psn']

// Même clé qu'avant la refonte : seul l'état « hors ligne déplié » sert encore.
const GROUPS_KEY = 'pg.side.groups'

/** Ami (ou membre Discord) classé pour l'affichage. */
interface Entry {
  friend: Friend
  status: FriendStatus
  /** Jeu de la bibliothèque (ou nommé par Steam / PSN) quand il est en jeu. */
  game?: string
  /** Le jeu, s'il est dans la bibliothèque : son image sert de fond à la carte « En jeu ». */
  lib?: Game
  /** Activité Discord qui ne correspond à aucun jeu de la bibliothèque. */
  activity?: string
}

function readShowOffline(): boolean {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? 'null')
    if (v && typeof v === 'object') return (v as Record<string, unknown>).offline === false
  } catch {
    // stockage indisponible ou valeur illisible : replié
  }
  return false
}

function writeShowOffline(show: boolean): void {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify({ offline: !show }))
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
  return {
    friend,
    status: 'in-game',
    game: cleanName(lib?.name ?? friend.game) || friend.game,
    lib
  }
}

/** Amis (Steam, PlayStation) vraiment en jeu, selon la même règle que la page Amis : la pastille du rail dit le même chiffre. */
export function countInGame(friends: Friend[], games: Game[]): number {
  const library = libraryIndex(games)
  return friends.filter((f) => f.platform !== 'discord' && classify(f, library).status === 'in-game').length
}

/** En jeu d'abord (regroupés par jeu), puis en ligne, absents, hors ligne ; par nom ensuite. */
function byStatus(a: Entry, b: Entry): number {
  return (
    STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
    (a.game ?? '').localeCompare(b.game ?? '', 'fr', { sensitivity: 'base' }) ||
    a.friend.name.localeCompare(b.friend.name, 'fr', { sensitivity: 'base' })
  )
}

/** « Steam », « PlayStation · PS5 » : la plateforme, et la console quand l'ami est connecté. */
function palMeta({ friend, status }: Entry): string {
  const parts = [PLATFORM_NAME[friend.platform]]
  if (friend.device && (status === 'in-game' || status === 'online')) parts.push(friend.device)
  return parts.join(' · ')
}

/** « En jeu · Valorant », « En ligne · Spotify », « Absent ». */
function memberMeta({ status, game, activity }: Entry): string {
  const parts = [STATUS_LABEL[status]]
  if (status === 'in-game' && game) parts.push(game)
  if (activity) parts.push(activity)
  return parts.join(' · ')
}

/** Recherche « Chercher un ami » : sans accents ni ponctuation, et telle quelle pour un pseudo fait de symboles. */
function matcher(query: string): (e: Entry) => boolean {
  const raw = query.trim().toLowerCase()
  const q = norm(query)
  if (!raw) return () => true
  return (e) => e.friend.name.toLowerCase().includes(raw) || (!!q && norm(e.friend.name).includes(q))
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

/**
 * Page Amis : amis Steam et PlayStation en sections (en jeu, en ligne, absents, hors ligne sur demande),
 * et à droite les membres du serveur Discord.
 */
export function SideFriends(props: SideFriendsProps): React.JSX.Element {
  const { result, accounts, games, demo, discordConfigured, loading, onRefresh, onOpenAccounts, onHideMember, onManageHidden, initialQuery } = props
  const [query, setQuery] = useState(initialQuery ?? '')
  const [filter, setFilter] = useState<Filter>('all')
  const [showOffline, setShowOffline] = useState(readShowOffline)

  const library = useMemo(() => libraryIndex(games), [games])
  const entries = useMemo(() => result.friends.map((f) => classify(f, library)), [result.friends, library])
  const pulsing = useInGamePulse(entries)

  const { pals, allMembers } = useMemo(
    () => ({
      pals: entries.filter((e) => e.friend.platform !== 'discord').sort(byStatus),
      allMembers: entries.filter((e) => e.friend.platform === 'discord').sort(byStatus)
    }),
    [entries]
  )
  const match = useMemo(() => matcher(query), [query])
  const found = pals.filter(match)
  const members = allMembers.filter(match)

  // Filtre de plateforme : seulement quand les deux ont des amis (sinon il ne filtrerait rien).
  const platforms = PALS.filter((p) => pals.some((e) => e.friend.platform === p))
  const active: Filter = filter !== 'all' && platforms.length > 1 && platforms.includes(filter) ? filter : 'all'
  const shown = active === 'all' ? found : found.filter((e) => e.friend.platform === active)
  const inGame = shown.filter((e) => e.status === 'in-game')
  const online = shown.filter((e) => e.status === 'online')
  const away = shown.filter((e) => e.status === 'away')
  const offline = shown.filter((e) => e.status === 'offline')

  // Membres masqués présents sur le serveur (bots connus, « Masquer ») : rappelés dans la note du panneau Discord.
  const masked = maskedLabel((result.hidden ?? []).filter((h) => h.online))

  // Après « Masquer », la ligne disparaît avec son bouton : le focus passe à l'œil du membre suivant (sinon du précédent,
  // sinon au lien « Membres masqués ») une fois la liste relue. On attend que le membre masqué ait quitté la liste, et on
  // oublie la demande si « Masquer » a échoué : sinon un rafraîchissement plus tard volerait le focus.
  const focusAfterHide = useRef<{ hidden: string; next: string } | null>(null)
  const hide = (e: Entry): void => {
    const i = members.findIndex((m) => m.friend.id === e.friend.id)
    const next = members[i + 1] ?? members[i - 1]
    const pending = {
      hidden: e.friend.id,
      next: next ? next.friend.id : 'note'
    }
    focusAfterHide.current = pending
    void onHideMember(e.friend).then((ok) => {
      if (!ok && focusAfterHide.current === pending) focusAfterHide.current = null
    })
  }
  useEffect(() => {
    const pending = focusAfterHide.current
    if (!pending || allMembers.some((m) => m.friend.id === pending.hidden)) return
    focusAfterHide.current = null
    const focused = document.activeElement
    if (focused && focused !== document.body) return
    const id = pending.next
    const target =
      id === 'note' ? document.querySelector<HTMLElement>('.sf-masked-btn') : document.querySelector<HTMLElement>(`[data-member="${CSS.escape(id)}"] .sf-hide`)
    target?.focus({ preventScroll: true })
  }, [allMembers])

  const hasData = result.friends.length > 0 || Object.values(result.errors).some(Boolean)
  const settled = useSettled(loading, hasData)
  const firstLoad = !hasData && !settled
  // Un compte Discord seul n'apporte personne (il faut un serveur) : on propose les sources d'amis.
  const noAccount = !firstLoad && !hasData && !accounts.some((a) => a.platform !== 'discord') && !demo && !discordConfigured
  // Serveur Discord sans compte Steam ni PlayStation : le panneau Discord, et une invitation à relier un compte.
  const noPalSource = !demo && pals.length === 0 && !accounts.some((a) => a.platform !== 'discord')
  const errors = ERROR_ORDER.filter((p) => result.errors[p])
  const showPanel =
    !firstLoad && !noAccount && (allMembers.length > 0 || !!result.errors.discord || !!masked || discordConfigured || !!result.queried?.includes('discord'))

  const toggleOffline = (): void => {
    setShowOffline(!showOffline)
    writeShowOffline(!showOffline)
  }

  let main: React.ReactNode
  if (firstLoad) {
    main = <Skeleton />
  } else if (noAccount) {
    main = (
      <Empty text="Connecte Steam, PlayStation ou un serveur Discord pour voir qui est en ligne.">
        <ConnectButton onClick={onOpenAccounts} />
      </Empty>
    )
  } else {
    const nobody = inGame.length + online.length + away.length === 0
    main = (
      <>
        {errors.map((p) => (
          <ErrorNote key={p} platform={p} message={result.errors[p] ?? ''} onFix={onOpenAccounts} />
        ))}
        {noPalSource ? (
          errors.length === 0 && (
            <Empty text="Connecte Steam ou PlayStation pour voir tes amis ici.">
              <ConnectButton onClick={onOpenAccounts} />
            </Empty>
          )
        ) : query.trim() && shown.length === 0 && pals.length > 0 ? (
          <Empty text={`Aucun ami ${active === 'all' ? '' : `${PLATFORM_NAME[active]} `}ne correspond à « ${query.trim()} ».`}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuery('')}>
              <Icon name="x" size={14} />
              Effacer la recherche
            </button>
          </Empty>
        ) : (
          nobody &&
          errors.length === 0 && (
            <p className="fp-caption">
              {offline.length ? 'Tous tes amis sont hors ligne.' : shown.length ? 'Aucun ami en ligne.' : "Personne à afficher pour l'instant."}
            </p>
          )
        )}
        {inGame.length > 0 && (
          <Section kind="in-game" label="En jeu" count={inGame.length}>
            <ul className="fp-grid fp-grid-play">
              {inGame.map((e) => (
                <PlayCard key={e.friend.id} entry={e} pulse={pulsing.has(e.friend.id)} />
              ))}
            </ul>
          </Section>
        )}
        {online.length > 0 && (
          <Section kind="online" label="En ligne" count={online.length}>
            <PalGrid entries={online} />
          </Section>
        )}
        {away.length > 0 && (
          <Section kind="away" label="Absents" count={away.length}>
            <PalGrid entries={away} />
          </Section>
        )}
        {offline.length > 0 && (
          <>
            <button type="button" className="fp-offline-btn" aria-expanded={showOffline} aria-controls="fp-offline" onClick={toggleOffline}>
              <span className="fp-offline-ring" aria-hidden="true" />
              {showOffline
                ? 'Masquer les amis hors ligne'
                : offline.length === 1
                  ? "Afficher l'ami hors ligne"
                  : `Afficher les ${offline.length} amis hors ligne`}
            </button>
            <div id="fp-offline" hidden={!showOffline}>
              <Section kind="offline" label="Hors ligne" count={offline.length}>
                <PalGrid entries={offline} />
              </Section>
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <div className="fp" aria-busy={loading}>
      <div className="fp-bar">
        {(query || pals.length + allMembers.length > 0) && (
          <label className="fp-search">
            <Icon name="search" size={17} className="fp-search-icon" />
            <span className="sr-only">Chercher un ami</span>
            <input
              type="search"
              className="fp-search-input"
              placeholder="Chercher un ami"
              value={query}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault()
                  setQuery('')
                }
              }}
            />
            {query && (
              <button type="button" className="fp-search-clear" aria-label="Effacer la recherche" title="Effacer la recherche" onClick={() => setQuery('')}>
                <Icon name="x" size={13} />
              </button>
            )}
          </label>
        )}
        {platforms.length > 1 && (
          <div className="fp-pills" role="group" aria-label="Plateforme">
            {(['all', ...platforms] as Filter[]).map((p) => {
              const n = p === 'all' ? found.length : found.filter((e) => e.friend.platform === p).length
              return (
                <button key={p} type="button" className="fp-pill" aria-pressed={active === p} onClick={() => setFilter(p)}>
                  {p === 'all' ? 'Tous' : PLATFORM_NAME[p]} · <span className="num">{n}</span>
                </button>
              )
            })}
          </div>
        )}
        {/* Sans aucune source d'amis, ni recherche ni rien à actualiser */}
        {!noAccount && (
          <button
            type="button"
            className="icon-btn fp-refresh"
            aria-label="Actualiser les amis"
            title="Actualiser les amis"
            aria-busy={loading}
            onClick={() => {
              if (!loading) onRefresh()
            }}
          >
            <Icon name="refresh" size={16} className={loading ? 'spin' : undefined} />
          </button>
        )}
      </div>

      <div className="fp-layout">
        <div className="fp-main">{main}</div>
        {showPanel && (
          <MembersPanel
            server={result.discordServer}
            total={allMembers.length}
            members={members}
            searching={!!query.trim()}
            error={result.errors.discord}
            masked={masked}
            pulsing={pulsing}
            onHide={hide}
            onFix={onOpenAccounts}
            onManageHidden={onManageHidden}
          />
        )}
      </div>
    </div>
  )
}

type SectionKind = 'in-game' | 'online' | 'away' | 'offline'

function Section({ kind, label, count, children }: { kind: SectionKind; label: string; count: number; children: React.ReactNode }): React.JSX.Element {
  const id = `fp-sec-${kind}`
  return (
    <section className="fp-section" aria-labelledby={id}>
      <h2 id={id} className="fp-h2">
        <span className={`fp-mark fp-mk-${kind}`} aria-hidden="true" />
        {label} <span className="fp-h2-count num">{count}</span>
      </h2>
      {children}
    </section>
  )
}

/** Carte « En jeu » : l'image du jeu s'il est dans la bibliothèque, sinon un fond neutre. */
function PlayCard({ entry, pulse }: { entry: Entry; pulse: boolean }): React.JSX.Element {
  const { friend, game, lib } = entry
  const art = lib?.heroUrl || lib?.coverUrl
  const [broken, setBroken] = useState<string | null>(null)
  const meta = palMeta(entry)
  return (
    <li className="fp-play">
      <div className="fp-play-art">
        {art && broken !== art && (
          <img className={lib?.heroUrl ? '' : 'is-cover'} src={art} alt="" loading="lazy" draggable={false} onError={() => setBroken(art)} />
        )}
      </div>
      <div className="fp-play-body">
        <span className={`fp-av fx-loop ${pulse ? 'is-pulsing' : ''}`}>
          <Avatar name={friend.name} url={friend.avatarUrl} size={52} status="in-game" />
        </span>
        <span className="fp-text">
          <span className="fp-name" title={friend.name}>
            {friend.name}
          </span>
          <span className="fp-game" title={game}>
            {game}
          </span>
          <span className="fp-meta" title={meta}>
            {meta}
          </span>
        </span>
      </div>
    </li>
  )
}

function PalGrid({ entries }: { entries: Entry[] }): React.JSX.Element {
  return (
    <ul className="fp-grid">
      {entries.map((e) => {
        const meta = palMeta(e)
        return (
          <li key={e.friend.id} className={`fp-pal st-${e.status}`}>
            <Avatar name={e.friend.name} url={e.friend.avatarUrl} size={40} status={e.status} />
            <span className="fp-text">
              <span className="fp-name" title={e.friend.name}>
                {e.friend.name}
              </span>
              <span className="fp-meta" title={meta}>
                {meta}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

interface PanelProps {
  server?: string
  /** Membres affichés sur le serveur, avant la recherche. */
  total: number
  members: Entry[]
  searching: boolean
  error?: string
  masked: string
  pulsing: ReadonlySet<string>
  onHide: (e: Entry) => void
  onFix: () => void
  onManageHidden: () => void
}

/** Panneau Discord : les membres du serveur (widget public), qu'on peut masquer. */
function MembersPanel({ server, total, members, searching, error, masked, pulsing, onHide, onFix, onManageHidden }: PanelProps): React.JSX.Element {
  return (
    <aside className="fp-discord" aria-labelledby="fp-discord-title">
      <div className="fp-discord-head">
        <span className="fp-server-icon" aria-hidden="true">
          {server ? server.trim().charAt(0).toUpperCase() : <Icon name="users" size={20} />}
        </span>
        <span className="fp-text">
          <span id="fp-discord-title" className="fp-server-name" title={server}>
            {server || 'Serveur Discord'}
          </span>
          <span className="fp-meta">
            Membres du serveur · Discord
            {total > 0 && <span className="fp-nowrap"> · {total} en ligne</span>}
          </span>
        </span>
      </div>
      {error && <ErrorNote platform="discord" message={error} onFix={onFix} />}
      {members.length > 0 ? (
        <ul className="fp-members">
          {members.map((e) => {
            const meta = memberMeta(e)
            return (
              <li key={e.friend.id} className={`fp-member st-${e.status}`} data-member={e.friend.id}>
                <span className={`fp-av ${e.status === 'in-game' ? 'fx-loop' : ''} ${pulsing.has(e.friend.id) ? 'is-pulsing' : ''}`}>
                  <Avatar name={e.friend.name} url={e.friend.avatarUrl} size={36} status={e.status} />
                </span>
                <span className="fp-text">
                  <span className="fp-name" title={e.friend.name}>
                    {e.friend.name}
                  </span>
                  <span className="fp-meta" title={meta}>
                    {meta}
                  </span>
                </span>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm sf-hide"
                  aria-label={`Masquer ${e.friend.name}`}
                  title="Masquer de la liste"
                  onClick={() => onHide(e)}
                >
                  <Icon name="eye-off" size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        !error && (
          <p className="fp-caption fp-members-empty">
            {searching && total > 0 ? 'Aucun membre ne correspond.' : "Personne en ligne sur le serveur pour l'instant."}
          </p>
        )
      )}
      <p className="fp-discord-note">
        {masked ? `${masked.charAt(0).toUpperCase()}${masked.slice(1)}.` : 'Les bots sont masqués.'} Un membre que tu masques se retrouve dans Paramètres ›
        Comptes ›{' '}
        <button type="button" className="sf-masked-btn" onClick={onManageHidden} aria-label="Membres masqués : ouvrir Paramètres › Comptes">
          Membres masqués
        </button>
        .
      </p>
    </aside>
  )
}

function ErrorNote({ platform, message, onFix }: { platform: FriendPlatform; message: string; onFix: () => void }): React.JSX.Element {
  return (
    <div className="fp-error" role="alert">
      <Icon name="alert-triangle" size={15} className="fp-error-icon" />
      <span className="fp-error-text">
        <strong>{PLATFORM_NAME[platform]}</strong> {message}
      </span>
      <button type="button" className="link-btn" aria-label={`Corriger : ${PLATFORM_NAME[platform]}`} onClick={onFix}>
        Corriger
      </button>
    </div>
  )
}

function Empty({ text, children }: { text: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="fp-empty">
      <p>{text}</p>
      {children}
    </div>
  )
}

function ConnectButton({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <button type="button" className="btn btn-secondary btn-sm" onClick={onClick}>
      <Icon name="link" size={14} />
      Connecter un compte
    </button>
  )
}

function Skeleton(): React.JSX.Element {
  return (
    <div className="fp-skeleton">
      <span className="sr-only">Chargement…</span>
      <span className="skel fp-skel-title" aria-hidden="true" />
      <div className="fp-grid fp-grid-play" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="skel fp-skel-play" />
        ))}
      </div>
      <span className="skel fp-skel-title" aria-hidden="true" />
      <div className="fp-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="skel fp-skel-pal" />
        ))}
      </div>
    </div>
  )
}
