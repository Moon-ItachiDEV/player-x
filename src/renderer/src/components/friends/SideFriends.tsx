import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { norm, plural } from '@shared/text'
import type { DiscordChannel, FriendPlatform, FriendStatus, HiddenMember } from '@shared/types'
import type { SideFriendsProps } from '../../contracts'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { byStatus, classify, friendSinceLabel, lastSeenLabel, libraryIndex, pickDefault, steamProfileUrl, type Entry } from './friendView'
import { useOpenChannel } from './useOpenChannel'
import { voiceRooms } from './voice'
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
const ERROR_ORDER: FriendPlatform[] = ['steam', 'psn']

type Pal = 'steam' | 'psn'
type Filter = 'all' | Pal
const PALS: Pal[] = ['steam', 'psn']

// Même clé qu'avant la refonte : seul l'état « hors ligne déplié » sert encore.
const GROUPS_KEY = 'pg.side.groups'
/** En dessous de cette largeur de page, un seul volet : la fiche remplace la liste. */
const NARROW = 900

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

/** Largeur de la page sous le seuil des deux volets (suivie au redimensionnement). */
function useNarrow(ref: React.RefObject<HTMLElement | null>): boolean {
  const [narrow, setNarrow] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = (): void => setNarrow(el.clientWidth < NARROW)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return narrow
}

/** « 4 bots masqués », « 1 membre masqué », « 4 bots et 1 membre masqués » ; vide si personne. */
function maskedLabel(hidden: HiddenMember[]): string {
  const bots = hidden.filter((h) => h.reason === 'bot').length
  const users = hidden.length - bots
  const parts = [bots ? plural(bots, 'bot', 'bots') : '', users ? plural(users, 'membre', 'membres') : ''].filter(Boolean)
  return parts.length ? `${parts.join(' et ')} masqué${hidden.length > 1 ? 's' : ''}` : ''
}

/** Sous-ligne d'une rangée : « ▶ Valorant », « En ligne · PS5 », « En ligne · Spotify », « Hors ligne » ; en vocal, « micro coupé ». */
function rowSub({ friend, status, game, activity }: Entry): string {
  const voice = friend.voice?.deafened ? 'casque coupé' : friend.voice?.muted ? 'micro coupé' : ''
  if (status === 'in-game') return [game ?? '', voice].filter(Boolean).join(' · ')
  const parts = [STATUS_LABEL[status]]
  if (friend.device && status !== 'offline') parts.push(friend.device)
  if (activity) parts.push(activity)
  if (voice) parts.push(voice)
  return parts.join(' · ')
}

const optionSelector = (id: string): string => `[role='option'][data-id="${CSS.escape(id)}"]`

/**
 * Page Amis en deux volets : à gauche la liste (amis Steam et PlayStation par présence, puis les membres du serveur
 * Discord à part), à droite la fiche de la personne choisie. Fenêtre étroite : la fiche remplace la liste.
 */
export function SideFriends(props: SideFriendsProps): React.JSX.Element {
  const {
    result,
    accounts,
    games,
    demo,
    discordConfigured,
    loading,
    onRefresh,
    onOpenAccounts,
    onHideMember,
    onManageHidden,
    onOpenGame,
    initialQuery,
    initialFriendId
  } = props
  const [query, setQuery] = useState(initialQuery ?? '')
  const [filter, setFilter] = useState<Filter>('all')
  // Ami choisi dans la recherche globale : la section hors ligne s'ouvre, il peut y être.
  const [showOffline, setShowOffline] = useState(() => !!initialQuery || !!initialFriendId || readShowOffline())
  const [selectedId, setSelectedId] = useState<string | null>(initialFriendId ?? null)
  // Fenêtre étroite : la fiche est ouverte à la place de la liste.
  const [detailOpen, setDetailOpen] = useState(!!initialFriendId)
  const rootRef = useRef<HTMLDivElement>(null)
  const narrow = useNarrow(rootRef)

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
  // Membres du serveur : d'abord ceux de chaque salon vocal (dans l'ordre du serveur), puis les autres.
  const filteredMembers = allMembers.filter(match)
  const rooms = voiceRooms(result.discordChannels, filteredMembers, (e) => e.friend)
  const inVoice = new Set(rooms.flatMap((r) => r.people.map((e) => e.friend.id)))
  const notInVoice = filteredMembers.filter((e) => !inVoice.has(e.friend.id))
  const members = [...rooms.flatMap((r) => r.people), ...notInVoice]
  const openChannel = useOpenChannel()
  const channelOf = (e: Entry): DiscordChannel | undefined => result.discordChannels?.find((c) => c.id === e.friend.voice?.channelId)

  // Filtre de plateforme : seulement quand les deux ont des amis (sinon il ne filtrerait rien).
  const platforms = PALS.filter((p) => pals.some((e) => e.friend.platform === p))
  const active: Filter = filter !== 'all' && platforms.length > 1 && platforms.includes(filter) ? filter : 'all'
  const shown = active === 'all' ? found : found.filter((e) => e.friend.platform === active)
  const inGame = shown.filter((e) => e.status === 'in-game')
  const online = shown.filter((e) => e.status === 'online')
  const away = shown.filter((e) => e.status === 'away')
  const offline = shown.filter((e) => e.status === 'offline')

  // Comptes de l'en-tête : sur tous les amis (pas les membres du serveur), sans la recherche.
  const countOnline = pals.filter((e) => e.status !== 'offline').length
  const countInGame = pals.filter((e) => e.status === 'in-game').length

  // Membres masqués présents sur le serveur (bots connus, « Masquer ») : rappelés sous la liste du serveur.
  const masked = maskedLabel((result.hidden ?? []).filter((h) => h.online))

  const hasData = result.friends.length > 0 || Object.values(result.errors).some(Boolean)
  const settled = useSettled(loading, hasData)
  const firstLoad = !hasData && !settled
  // Un compte Discord seul n'apporte personne (il faut un serveur) : on propose les sources d'amis.
  const noAccount = !firstLoad && !hasData && !accounts.some((a) => a.platform !== 'discord') && !demo && !discordConfigured
  // Serveur Discord sans compte Steam ni PlayStation : les membres, et une invitation à relier un compte.
  const noPalSource = !demo && pals.length === 0 && !accounts.some((a) => a.platform !== 'discord')
  const errors = ERROR_ORDER.filter((p) => result.errors[p])
  const showMembers =
    !firstLoad && !noAccount && (allMembers.length > 0 || !!result.errors.discord || !!masked || discordConfigured || !!result.queried?.includes('discord'))

  // Rangées visibles, dans l'ordre de la liste : c'est aussi l'ordre des flèches haut / bas.
  const visiblePals = [...inGame, ...online, ...away, ...(showOffline ? offline : [])]
  const visibleMembers = showMembers ? members : []
  const visible = [...visiblePals, ...visibleMembers]
  const selected = visible.find((e) => e.friend.id === selectedId) ?? pickDefault(visiblePals) ?? pickDefault(visibleMembers)
  const showDetail = narrow && detailOpen && !!selected

  // Ami venu de la recherche globale : la liste défile jusqu'à lui (une fois, dès qu'il est affiché).
  const revealed = useRef(!initialFriendId)
  useEffect(() => {
    if (revealed.current || !selected || selected.friend.id !== initialFriendId) return
    revealed.current = true
    rootRef.current?.querySelector<HTMLElement>(optionSelector(selected.friend.id))?.scrollIntoView({ block: 'center' })
  })

  // Fenêtre étroite seulement : choisir quelqu'un ouvre sa fiche à la place de la liste.
  const choose = (e: Entry, open: boolean): void => {
    setSelectedId(e.friend.id)
    if (open && narrow) setDetailOpen(true)
  }

  // Retour à la liste (fenêtre étroite) : le focus revient sur la rangée choisie.
  const focusRow = useRef(false)
  useEffect(() => {
    if (!focusRow.current || showDetail || !selected) return
    focusRow.current = false
    rootRef.current?.querySelector<HTMLElement>(optionSelector(selected.friend.id))?.focus({ preventScroll: false })
  })
  const back = (): void => {
    focusRow.current = true
    setDetailOpen(false)
  }

  // Liste au clavier : flèches haut / bas, Début / Fin ; Entrée ou Espace ouvre la fiche en fenêtre étroite.
  const onListKey = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
    const target = ev.target as HTMLElement
    if (target.getAttribute('role') !== 'option') return
    const i = visible.findIndex((e) => e.friend.id === target.dataset.id)
    if (i < 0) return
    let next = -1
    if (ev.key === 'ArrowDown') next = Math.min(visible.length - 1, i + 1)
    else if (ev.key === 'ArrowUp') next = Math.max(0, i - 1)
    else if (ev.key === 'Home') next = 0
    else if (ev.key === 'End') next = visible.length - 1
    else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault()
      choose(visible[i], true)
      return
    } else return
    ev.preventDefault()
    const e = visible[next]
    setSelectedId(e.friend.id)
    rootRef.current?.querySelector<HTMLElement>(optionSelector(e.friend.id))?.focus()
  }

  // « Masquer » : la fiche passe au membre suivant (sinon au précédent) ; plus personne, le focus va à « Membres masqués ».
  const hide = (e: Entry): void => {
    const i = members.findIndex((m) => m.friend.id === e.friend.id)
    const next = members[i + 1] ?? members[i - 1]
    setSelectedId(next ? next.friend.id : null)
    void onHideMember(e.friend).then((ok) => {
      if (!ok) {
        setSelectedId(e.friend.id)
        return
      }
      if (!next) {
        setDetailOpen(false)
        requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>('.sf-masked-btn')?.focus())
      }
    })
  }

  const toggleOffline = (): void => {
    setShowOffline(!showOffline)
    writeShowOffline(!showOffline)
  }

  const refresh = !noAccount && (
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
      <Icon name="refresh" size={17} className={loading ? 'spin' : undefined} />
    </button>
  )

  const head = (
    <header className="fp-head">
      <div className="fp-head-text">
        <h1 className="fp-title">Tes amis</h1>
        {pals.length > 0 && (
          <p className="fp-counts">
            {countOnline > 0 ? (
              <span className="fp-count is-online">
                <span className="fp-dot" aria-hidden="true" />
                <span className="num">{countOnline}</span> en ligne
              </span>
            ) : (
              <span className="fp-count">Personne en ligne</span>
            )}
            {countInGame > 0 && (
              <>
                <span className="fp-sep" aria-hidden="true">
                  ·
                </span>
                <span className="fp-count is-live">
                  <Icon name="play" size={11} />
                  <span className="num">{countInGame}</span> en jeu
                </span>
              </>
            )}
          </p>
        )}
      </div>
      {refresh}
    </header>
  )

  if (firstLoad) {
    return (
      <div className="fp" ref={rootRef} aria-busy="true">
        <div className="fp-pane-list">
          {head}
          <Skeleton />
        </div>
        {!narrow && <div className="fp-pane-detail fp-detail" aria-hidden="true" />}
      </div>
    )
  }

  if (noAccount) {
    return (
      <div className="fp is-single" ref={rootRef}>
        {head}
        <div className="fp-empty-hero">
          <span className="fp-empty-icon" aria-hidden="true">
            <Icon name="users" size={26} />
          </span>
          <h2 className="fp-empty-title">Relie un compte pour voir tes amis</h2>
          <p className="fp-empty-text">Connecte Steam ou PlayStation pour voir qui est en ligne et à quoi tes amis jouent. Un serveur Discord ajoute ses membres.</p>
          <ConnectButton onClick={onOpenAccounts} primary />
        </div>
      </div>
    )
  }

  const nobody = inGame.length + online.length + away.length === 0
  const list = (
    <div className="fp-pane-list">
      {head}
      {(query || pals.length + allMembers.length > 0 || platforms.length > 1) && (
        <div className="fp-tools">
          <label className="fp-search">
            <Icon name="search" size={16} className="fp-search-icon" />
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
          {platforms.length > 1 && (
            <div className="fp-pills" role="group" aria-label="Plateforme">
              {(['all', ...platforms] as Filter[]).map((p) => {
                const n = p === 'all' ? found.length : found.filter((e) => e.friend.platform === p).length
                return (
                  <button key={p} type="button" className="fp-pill" aria-pressed={active === p} onClick={() => setFilter(p)}>
                    {p === 'all' ? 'Tous' : PLATFORM_NAME[p]} <span className="num fp-pill-n">{n}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="fp-groups" onKeyDown={onListKey}>
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
          <Group id="fp-g-in-game" label="En jeu" count={inGame.length}>
            <Rows id="fp-g-in-game" entries={inGame} selected={selected} pulsing={pulsing} onChoose={choose} />
          </Group>
        )}
        {online.length > 0 && (
          <Group id="fp-g-online" label="En ligne" count={online.length}>
            <Rows id="fp-g-online" entries={online} selected={selected} pulsing={pulsing} onChoose={choose} />
          </Group>
        )}
        {away.length > 0 && (
          <Group id="fp-g-away" label="Absents" count={away.length}>
            <Rows id="fp-g-away" entries={away} selected={selected} pulsing={pulsing} onChoose={choose} />
          </Group>
        )}
        {offline.length > 0 && (
          <Group
            id="fp-g-offline"
            label="Hors ligne"
            count={offline.length}
            toggle={{ open: showOffline, onToggle: toggleOffline, controls: 'fp-g-offline-list' }}
          >
            {showOffline && <Rows id="fp-g-offline" listId="fp-g-offline-list" entries={offline} selected={selected} pulsing={pulsing} onChoose={choose} />}
          </Group>
        )}

        {showMembers && (
          <section className="fp-group fp-members" aria-labelledby="fp-g-members">
            <h2 id="fp-g-members" className="fp-group-h">
              <span>Membres du serveur</span>
              <span className="fp-group-sep" aria-hidden="true">
                ·
              </span>
              <span className="fp-server" title={result.discordServer}>
                {result.discordServer || 'Discord'}
              </span>
            </h2>
            {result.errors.discord && <ErrorNote platform="discord" message={result.errors.discord} onFix={onOpenAccounts} />}
            {rooms.map((r) => {
              const id = `fp-g-voice-${r.channel.id}`
              return (
                <div key={r.channel.id} className="fp-room">
                  <div className="fp-room-head">
                    <span id={id} className="fp-room-name">
                      <Icon name="volume" size={14} />
                      <span className="fp-room-label" title={r.channel.name}>
                        {r.channel.name}
                      </span>
                      <span className="fp-group-sep" aria-hidden="true">
                        ·
                      </span>
                      <span className="num">{r.people.length}</span>
                      <span className="sr-only"> en vocal</span>
                    </span>
                    <button type="button" className="btn btn-ghost btn-sm fp-room-open" onClick={() => openChannel(r.channel)} aria-label={`Ouvrir le salon ${r.channel.name} dans Discord`}>
                      Ouvrir dans Discord
                      <Icon name="external-link" size={13} />
                    </button>
                  </div>
                  <Rows id={id} entries={r.people} selected={selected} pulsing={pulsing} onChoose={choose} />
                </div>
              )
            })}
            {rooms.length > 0 && notInVoice.length > 0 && (
              <p id="fp-g-members-rest" className="fp-room-rest">
                Pas en vocal
                <span className="fp-group-sep" aria-hidden="true">
                  ·
                </span>
                <span className="num">{notInVoice.length}</span>
              </p>
            )}
            {notInVoice.length > 0 ? (
              <Rows id={rooms.length ? 'fp-g-members-rest' : 'fp-g-members'} entries={notInVoice} selected={selected} pulsing={pulsing} onChoose={choose} />
            ) : members.length > 0 ? null : (
              !result.errors.discord && (
                <p className="fp-caption fp-members-empty">
                  {query.trim() && allMembers.length > 0 ? 'Aucun membre ne correspond.' : "Personne en ligne sur le serveur pour l'instant."}
                </p>
              )
            )}
            <p className="fp-discord-note">
              {masked ? `${masked.charAt(0).toUpperCase()}${masked.slice(1)}.` : 'Les bots sont masqués.'} Un membre que tu masques se retrouve dans
              Paramètres › Comptes ›{' '}
              <button type="button" className="sf-masked-btn" onClick={onManageHidden} aria-label="Membres masqués : ouvrir Paramètres › Comptes">
                Membres masqués
              </button>
              .
            </p>
          </section>
        )}
      </div>
    </div>
  )

  const detail = selected ? (
    <FriendDetail
      entry={selected}
      server={result.discordServer}
      channel={channelOf(selected)}
      onOpenChannel={openChannel}
      onOpenGame={onOpenGame}
      onHide={hide}
      onBack={narrow ? back : undefined}
    />
  ) : (
    <div className="fp-pane-detail fp-detail fp-detail-none">
      <p className="fp-caption">{visible.length === 0 && pals.length + allMembers.length > 0 ? 'Personne à montrer avec ce filtre.' : 'Personne à afficher pour l’instant.'}</p>
    </div>
  )

  return (
    <div className={`fp ${narrow ? 'is-single' : ''}`} ref={rootRef} aria-busy={loading}>
      {narrow ? (showDetail ? detail : list) : (
        <>
          {list}
          {detail}
        </>
      )}
    </div>
  )
}

function Group({
  id,
  label,
  count,
  toggle,
  children
}: {
  id: string
  label: string
  count: number
  toggle?: { open: boolean; onToggle: () => void; controls: string }
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="fp-group" aria-labelledby={id}>
      <h2 className="fp-group-h">
        {toggle ? (
          <button type="button" id={id} className="fp-group-toggle" aria-expanded={toggle.open} aria-controls={toggle.controls} onClick={toggle.onToggle}>
            {label}
            <span className="fp-group-sep" aria-hidden="true">
              ·
            </span>
            <span className="num">{count}</span>
            <Icon name="chevron-down" size={14} className="fp-chevron" />
          </button>
        ) : (
          <span id={id}>
            {label}
            <span className="fp-group-sep" aria-hidden="true">
              ·
            </span>
            <span className="num">{count}</span>
          </span>
        )}
      </h2>
      {children}
    </section>
  )
}

/** Rangées d'un groupe : une liste de choix (listbox), une seule rangée dans l'ordre de tabulation (la choisie). */
function Rows({
  id,
  listId,
  entries,
  selected,
  pulsing,
  onChoose
}: {
  id: string
  listId?: string
  entries: Entry[]
  selected: Entry | undefined
  pulsing: ReadonlySet<string>
  onChoose: (e: Entry, open: boolean) => void
}): React.JSX.Element {
  return (
    <ul id={listId} className="fp-rows" role="listbox" aria-labelledby={id}>
      {entries.map((e) => {
        const on = selected?.friend.id === e.friend.id
        const sub = rowSub(e)
        const pf = e.friend.platform === 'discord' ? '' : PLATFORM_NAME[e.friend.platform]
        return (
          <li
            key={e.friend.id}
            role="option"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            data-id={e.friend.id}
            className={`fp-row st-${e.status}`}
            onClick={() => onChoose(e, true)}
          >
            <Ring entry={e} size={44} pulse={pulsing.has(e.friend.id)} />
            <span className="fp-text">
              <span className="fp-name" title={e.friend.name}>
                {e.friend.name}
              </span>
              <span className="fp-sub" title={sub}>
                {e.status === 'in-game' && <Icon name="play" size={9} className="fp-sub-play" />}
                <span className="fp-sub-text">{sub}</span>
              </span>
            </span>
            {pf && <span className="fp-row-pf">{pf}</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** Avatar dans un anneau de la couleur de sa présence ; en jeu, un petit ▶ cyan. */
function Ring({ entry, size, pulse }: { entry: Entry; size: number; pulse?: boolean }): React.JSX.Element {
  return (
    <span className={`fp-ring st-${entry.status} ${pulse ? 'is-pulsing' : ''}`}>
      <Avatar key={entry.friend.id} name={entry.friend.name} url={entry.friend.avatarUrl} size={size} />
      {entry.status === 'in-game' && (
        <span className="fp-ring-play" aria-hidden="true">
          <Icon name="play" size={Math.round(size / 5)} />
        </span>
      )}
    </span>
  )
}

/** Fiche de la personne choisie : présence, jeu en cours, et seulement des actions qui font vraiment quelque chose. */
function FriendDetail({
  entry,
  server,
  channel,
  onOpenChannel,
  onOpenGame,
  onHide,
  onBack
}: {
  entry: Entry
  server?: string
  /** Salon vocal où se trouve le membre du serveur (widget Discord). */
  channel?: DiscordChannel
  onOpenChannel: (c: DiscordChannel) => void
  onOpenGame: SideFriendsProps['onOpenGame']
  onHide: (e: Entry) => void
  onBack?: () => void
}): React.JSX.Element {
  const { friend, status, game, lib, activity } = entry
  const member = friend.platform === 'discord'
  const profile = steamProfileUrl(friend)
  const backRef = useRef<HTMLButtonElement>(null)
  const single = !!onBack
  // Fiche ouverte à la place de la liste : le focus part sur « Retour ».
  useEffect(() => {
    if (single) backRef.current?.focus()
  }, [single])

  const kicker = `${STATUS_LABEL[status]} · ${member ? 'Discord' : PLATFORM_NAME[friend.platform]}`
  // Ligne sous le pseudo : ce qu'il fait, quand ça ajoute quelque chose au statut.
  const line =
    status === 'in-game'
      ? `Joue à ${game}${friend.device ? ` sur ${friend.device}` : ''}`
      : activity
        ? `Activité : ${activity}`
        : status !== 'offline' && friend.device
          ? `Sur ${friend.device}`
          : status === 'offline'
            ? lastSeenLabel(friend.lastSeen)
            : ''
  const meta = member ? `Membre du serveur ${server || 'Discord'}` : friendSinceLabel(friend.since)

  return (
    <section className={`fp-pane-detail fp-detail st-${status}`} aria-labelledby="fp-detail-name">
      {onBack && (
        <button ref={backRef} type="button" className="btn btn-ghost btn-sm fp-back" onClick={onBack}>
          <Icon name="chevron-left" size={16} />
          Retour
        </button>
      )}
      <div className="fp-detail-body">
        <span className="fp-hero">
          <Avatar key={friend.id} name={friend.name} url={friend.avatarUrl} size={140} />
          {status === 'in-game' && (
            <span className="fp-hero-play" aria-hidden="true">
              <Icon name="play" size={22} />
            </span>
          )}
        </span>
        <p className="fp-kicker">
          <StatusMark status={status} />
          {kicker}
        </p>
        <h2 id="fp-detail-name" className="fp-detail-name" title={friend.name}>
          {friend.name}
        </h2>
        {line && <p className="fp-detail-line">{line}</p>}
        {channel && (
          <p className="fp-detail-voice">
            <Icon name="volume" size={15} />
            En vocal dans « {channel.name} »{friend.voice?.deafened ? ' · casque coupé' : friend.voice?.muted ? ' · micro coupé' : ''}
          </p>
        )}
        {meta && <p className="fp-detail-meta">{meta}</p>}
        {friend.presenceUnknown && <p className="fp-detail-meta">PlayStation n’a pas donné sa présence cette fois-ci : le statut peut être en retard.</p>}

        {status === 'in-game' && game && <NowPlaying game={game} lib={lib} onOpenGame={onOpenGame} />}

        {(profile || member) && (
          <div className="fp-actions">
            {channel && (
              <button type="button" className="btn btn-secondary btn-lg fp-action" onClick={() => onOpenChannel(channel)}>
                <Icon name="volume" size={17} />
                Ouvrir le salon dans Discord
                <Icon name="external-link" size={15} className="fp-action-ext" />
              </button>
            )}
            {profile && (
              <button type="button" className="btn btn-secondary btn-lg fp-action" onClick={() => void window.launcher.openExternal(profile)}>
                <Icon name="user" size={17} />
                Voir le profil Steam
                <Icon name="external-link" size={15} className="fp-action-ext" />
              </button>
            )}
            {member && (
              <button type="button" className="btn btn-secondary btn-lg fp-action sf-hide" onClick={() => onHide(entry)}>
                <Icon name="eye-off" size={17} />
                Masquer de la liste
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function StatusMark({ status }: { status: FriendStatus }): React.JSX.Element {
  return status === 'in-game' ? <Icon name="play" size={10} className="fp-mark" /> : <span className={`fp-mark fp-mk-${status}`} aria-hidden="true" />
}

/** Carte « Joue à » : l'image du jeu et sa fiche s'il est dans la bibliothèque. */
function NowPlaying({ game, lib, onOpenGame }: { game: string; lib?: Entry['lib']; onOpenGame: SideFriendsProps['onOpenGame'] }): React.JSX.Element {
  const art = lib?.heroUrl || lib?.coverUrl
  const [broken, setBroken] = useState<string | null>(null)
  const hasArt = !!art && broken !== art
  return (
    <div className={`fp-now ${hasArt ? 'has-art' : ''}`}>
      {hasArt && (
        <img className={`fp-now-art ${lib?.heroUrl ? '' : 'is-cover'}`} src={art} alt="" loading="lazy" draggable={false} onError={() => setBroken(art)} />
      )}
      <div className="fp-now-text">
        <p className="fp-kicker">
          <Icon name="play" size={10} className="fp-mark" />
          Joue à
        </p>
        <p className="fp-now-game" title={game}>
          {game}
        </p>
        <p className="fp-now-note">{lib ? 'Installé sur ce PC' : 'Pas trouvé parmi tes jeux installés'}</p>
      </div>
      {lib && (
        <button type="button" className="btn btn-secondary btn-sm fp-now-open" onClick={() => onOpenGame(lib)}>
          Voir la fiche
        </button>
      )}
    </div>
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

function ConnectButton({ onClick, primary }: { onClick: () => void; primary?: boolean }): React.JSX.Element {
  return (
    <button type="button" className={`btn ${primary ? 'btn-primary' : 'btn-secondary btn-sm'}`} onClick={onClick}>
      <Icon name="link" size={14} />
      Connecter un compte
    </button>
  )
}

function Skeleton(): React.JSX.Element {
  return (
    <div className="fp-skeleton">
      <span className="sr-only">Chargement…</span>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="skel fp-skel-row" aria-hidden="true" />
      ))}
    </div>
  )
}
