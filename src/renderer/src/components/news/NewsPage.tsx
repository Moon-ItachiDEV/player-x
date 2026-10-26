import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { capitalize, cleanName, plural, timeAgo } from '@shared/text'
import type { Game, NewsFeed, NewsFeedItem } from '@shared/types'
import type { NewsPageProps } from '../../contracts'
import { useNow } from '../settings/parts'
import { TopTitle } from '../TopTabs'
import { Icon, type IconName } from '../ui/Icon'
import { PickMenu } from '../ui/PickMenu'
import { feedGames, filterFeed } from './feedView'
import { NewsThumb } from './NewsThumb'
import { NewsUne, UNE_MAX } from './NewsUne'
import { useNewsFeed } from './useNewsFeed'
import './news.css'
import './feed.css'

export type { NewsPageProps }

type NewsTab = 'patches' | 'all'

// Onglet et jeu choisis, propres à ce PC.
const STORAGE_KEY = 'pg.news'
const ALL = '*'
/** Jeux proposés en puces (les autres passent par « Autres jeux »). */
const CHIP_GAMES = 2

interface NewsPrefs {
  tab: NewsTab
  /** Jeu du menu « Jeu » (`*` : tous). */
  game: string
}

function loadPrefs(): NewsPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<NewsPrefs>
    return { tab: raw.tab === 'all' ? 'all' : 'patches', game: typeof raw.game === 'string' && raw.game ? raw.game : ALL }
  } catch {
    return { tab: 'patches', game: ALL }
  }
}

function savePrefs(p: NewsPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* stockage indisponible : la préférence vaut pour la session */
  }
}

/** Page Actus des jeux : les annonces officielles publiées sur Steam pour tes jeux, les plus récentes d'abord. */
export function NewsPage({ games, enabled, demo, onRead, onOpenSettings }: NewsPageProps): React.JSX.Element {
  const { state, refreshing, refresh, markAllSeen } = useNewsFeed(enabled, demo)
  const [prefs, setPrefs] = useState<NewsPrefs>(loadPrefs)
  const [marking, setMarking] = useState(false)
  const now = useNow()
  // Lecteurs d'écran : seulement la fin d'une action, jamais le « Relevé il y a N min » qui change chaque minute.
  // Deux fois le même message : une espace insécable en plus, pour qu'il soit lu de nouveau.
  const [status, setStatus] = useState('')
  const announce = useCallback((msg: string) => setStatus((prev) => (prev === msg ? `${msg}\u00a0` : msg)), [])
  const refreshRef = useRef<HTMLButtonElement>(null)
  const focusAfterMark = useRef(false)

  const update = (patch: Partial<NewsPrefs>): void =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })

  const feed = state.status === 'ready' ? state.feed : null
  const items = useMemo(() => feed?.items ?? [], [feed])
  // Menu « Jeu » : compté dans l'onglet affiché (dans « Patchs », les patchs seulement).
  const tabItems = useMemo(() => filterFeed(items, { patchesOnly: prefs.tab === 'patches', gameId: null }), [items, prefs.tab])
  const gameList = useMemo(() => feedGames(items, tabItems), [items, tabItems])
  // Un jeu choisi qui n'a plus d'annonce (désinstallé, mode démo basculé) : retour à « Tous ».
  const game = prefs.game !== ALL && gameList.some((g) => g.id === prefs.game) ? prefs.game : ALL
  const gameId = game === ALL ? null : game
  // Patchs de la vue (jeu choisi ou tous), sur la puce « Patchs seulement ».
  const patchCount = useMemo(() => filterFeed(items, { patchesOnly: true, gameId }).length, [items, gameId])
  const shown = useMemo(() => filterFeed(items, { patchesOnly: prefs.tab === 'patches', gameId }), [items, prefs.tab, gameId])
  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games])
  const anyNew = items.some((i) => i.isNew)

  // « Tout marquer comme lu » avait le focus : il disparaît (plus rien de nouveau), le focus passe à « Actualiser »
  // plutôt que de retomber en haut de la fenêtre. Marquage raté (le bouton reste) : rien à déplacer.
  useLayoutEffect(() => {
    if (anyNew || !focusAfterMark.current) return
    focusAfterMark.current = false
    refreshRef.current?.focus()
  }, [anyNew])
  useEffect(() => {
    if (!marking && anyNew) focusAfterMark.current = false
  }, [marking, anyNew])

  // Premier relevé terminé pendant que la page est ouverte.
  const wasPending = useRef(false)
  useEffect(() => {
    if (!feed) return
    if (wasPending.current && !feed.pending) announce(afterRefresh(feed))
    wasPending.current = feed.pending
  }, [feed, announce])

  if (!enabled) {
    return (
      <div className="page nf-page">
        <h1 className="sr-only">Actus des jeux</h1>
        <TopTitle>Actus des jeux</TopTitle>
        <Empty
          icon="news"
          title="Les actus des jeux sont désactivées"
          text="Active-les dans Paramètres › Bibliothèque pour suivre les patchs de tes jeux."
          action={{ label: 'Ouvrir les paramètres', icon: 'settings', onClick: onOpenSettings }}
        />
      </div>
    )
  }

  const tab = prefs.tab
  // Puces des jeux : les derniers à avoir publié (ordre du relevé), plus celui qui est choisi ; les autres dans « Autres jeux ».
  const chipIds = [...new Set(items.map((i) => i.gameId))].filter((id) => gameList.some((g) => g.id === id)).slice(0, CHIP_GAMES)
  if (gameId && !chipIds.includes(gameId)) chipIds.push(gameId)
  const chipGames = chipIds.map((id) => gameList.find((g) => g.id === id)!)

  const retry = (): void => void refresh().then((f) => announce(f ? afterRefresh(f) : 'Actus indisponibles pour le moment.'))
  const markAll = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (marking) return
    focusAfterMark.current = document.activeElement === e.currentTarget
    setMarking(true)
    markAllSeen()
      .then(
        () => announce('Toutes les actus sont marquées comme lues.'),
        () => {}
      )
      .finally(() => setMarking(false))
  }
  let body: React.ReactNode
  if (state.status === 'error') {
    body = <Empty icon="alert-circle" title="Actus indisponibles" text={state.message} action={{ label: 'Réessayer', icon: 'refresh', onClick: retry }} />
  } else if (!feed || (feed.pending && !items.length)) {
    body = <FeedSkeleton />
  } else if (feed.tracked === 0) {
    body = <Empty icon="news" title="Pas d'actus pour tes jeux" text="Aucun de tes jeux installés n'a de page Steam : Player X n'a pas d'annonces à te montrer." />
  } else if (feed.offline && !items.length) {
    body = <Empty icon="alert-circle" title="Steam ne répond pas" text="Les actus arriveront dès que la connexion revient." action={{ label: 'Réessayer', icon: 'refresh', onClick: retry, busy: refreshing }} />
  } else if (!items.length) {
    body = (
      <Empty
        icon="news"
        title="Aucune annonce récente"
        text="Tes jeux n'ont rien publié sur Steam ces derniers temps."
        action={{ label: 'Actualiser', icon: 'refresh', onClick: retry, busy: refreshing }}
      />
    )
  } else if (!shown.length) {
    const picked = gameId ? gameList.find((g) => g.id === gameId) : undefined
    body = (
      <Empty
        icon="download"
        title="Aucun patch récent"
        text={
          picked
            ? `${cleanName(picked.name)} n'a pas publié de notes de patch dans ses dernières annonces.`
            : "Tes jeux n'ont pas publié de notes de patch dans leurs dernières annonces."
        }
        action={{ label: 'Voir toutes les actus', icon: 'list', onClick: () => update({ tab: 'all' }) }}
      />
    )
  } else {
    const rest = shown.slice(UNE_MAX)
    body = (
      <>
        {feed.offline && <p className="caption nf-offline">Steam ne répond pas : voici les actus du dernier relevé.</p>}
        <NewsUne items={shown.slice(0, UNE_MAX)} games={byId} now={now} onRead={onRead} />
        {rest.length > 0 && (
          <section className="nf-recent" aria-labelledby="nf-recent-h">
            <h2 id="nf-recent-h" className="nf-h2">
              Plus récentes
            </h2>
            <ul className="nf-grid">
              {rest.map((item) => (
                <li key={`${item.gameId}:${item.id}`}>
                  <FeedItem item={item} game={byId.get(item.gameId)} now={now} onRead={onRead} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    )
  }

  return (
    <div className="page nf-page">
      <h1 className="sr-only">Actus des jeux</h1>
      <TopTitle>Actus des jeux</TopTitle>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      {feed && feed.tracked > 0 && (
        <div className="nf-bar">
          <div className="nf-filters" role="group" aria-label="Filtrer les actus">
            {gameList.length > 1 && (
              <>
                <button className="nf-chip" aria-pressed={game === ALL} onClick={() => update({ game: ALL })}>
                  Tous tes jeux
                </button>
                {chipGames.map((g) => (
                  <button key={g.id} className="nf-chip" aria-pressed={game === g.id} onClick={() => update({ game: g.id })}>
                    {cleanName(g.name)}
                  </button>
                ))}
                {gameList.length > chipGames.length && (
                  <PickMenu<string>
                    label="Jeu"
                    display="Autres jeux"
                    className="nf-chip nf-more"
                    value={game}
                    options={[
                      { value: ALL, label: 'Tous tes jeux', hint: tabItems.length },
                      ...gameList.map((g) => ({ value: g.id, label: cleanName(g.name), hint: g.count }))
                    ]}
                    onPick={(v) => update({ game: v })}
                  />
                )}
              </>
            )}
            {/* Sans aucune annonce, rien à filtrer : l'état vide dit pourquoi. */}
            {items.length > 0 && (
              <button className="nf-chip" aria-pressed={tab === 'patches'} onClick={() => update({ tab: tab === 'patches' ? 'all' : 'patches' })}>
                Patchs seulement
                <span className="nf-chip-count num">{patchCount}</span>
              </button>
            )}
          </div>
          <div className="nf-tools">
            <p className="nf-summary">{summary(feed, now)}</p>
            {anyNew && (
              // aria-disabled plutôt que disabled : un bouton désactivé perd le focus.
              <button className="btn btn-ghost btn-sm" aria-disabled={marking || undefined} onClick={markAll}>
                <Icon name="check" size={15} />
                Tout marquer comme lu
              </button>
            )}
            {/* Sans aucune annonce, l'état vide porte déjà « Réessayer » ou « Actualiser » : pas de second bouton. */}
            {items.length > 0 && (
              <button
                ref={refreshRef}
                className="btn btn-secondary btn-sm"
                title="Redemander les dernières annonces à Steam"
                aria-busy={refreshing}
                aria-disabled={refreshing || undefined}
                onClick={() => !refreshing && retry()}
              >
                <Icon name="refresh" size={15} className={refreshing ? 'spin' : undefined} />
                Actualiser
              </button>
            )}
          </div>
        </div>
      )}
      <div className="nf-panel">{body}</div>
    </div>
  )
}

/** Fin d'un relevé, pour les lecteurs d'écran : « Actus relevées : 2 annonces non lues », ou Steam qui ne répond pas. */
function afterRefresh(feed: NewsFeed): string {
  if (feed.offline) return feed.items.length ? 'Steam ne répond pas : voici les actus du dernier relevé.' : 'Steam ne répond pas : les actus arriveront dès que la connexion revient.'
  const unread = feed.items.filter((i) => i.isNew).length
  return unread ? `Actus relevées : ${plural(unread, 'annonce non lue', 'annonces non lues')}.` : 'Actus relevées : rien de nouveau.'
}

/** « Relevé il y a 2 h · 12 jeux suivis », ou « Premier relevé en cours… ». */
function summary(feed: NewsFeed, now: number): string {
  if (feed.pending) return 'Premier relevé en cours…'
  const tracked = plural(feed.tracked, 'jeu suivi', 'jeux suivis')
  return feed.checkedAt ? `Relevé ${timeAgo(feed.checkedAt, Math.max(now, feed.checkedAt))} · ${tracked}` : tracked
}

interface ItemProps {
  item: NewsFeedItem
  /** Le jeu de la bibliothèque (image) ; absent s'il vient d'en sortir. */
  game?: Game
  now: number
  onRead: (gameId: string, postId: string) => void
}

function FeedItem({ item, game, now, onRead }: ItemProps): React.JSX.Element {
  const name = cleanName(item.gameName)
  const when = capitalize(timeAgo(item.date, Math.max(now, item.date)))
  return (
    <button
      className={`nf-item ${item.isNew ? 'is-new' : ''}`}
      aria-label={`${item.patch ? 'Patch' : 'Actu'} de ${name} : ${item.title}, ${when.toLowerCase()}${item.isNew ? ', nouveau' : ''}`}
      title={item.title}
      onClick={() => onRead(item.gameId, item.id)}
    >
      <span className="nf-item-art" aria-hidden="true">
        <NewsThumb game={game ?? { name: item.gameName }} patch={item.patch} className="nf-item-thumb" />
        {item.isNew && (
          <span className="news-badge nf-item-new">
            <span className="news-badge-dot" />
            Nouveau
          </span>
        )}
      </span>
      <span className="nf-item-text" aria-hidden="true">
        <span className="nf-kicker">
          {name}
          {item.patch && ' · Patch'}
        </span>
        <span className="nf-item-title">{item.title}</span>
        <span className="nf-item-when num">{when}</span>
      </span>
    </button>
  )
}

interface EmptyProps {
  icon: IconName
  title: string
  text: string
  action?: { label: string; icon: IconName; onClick: () => void; busy?: boolean }
}

function Empty({ icon, title, text, action }: EmptyProps): React.JSX.Element {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <h3>{title}</h3>
      <p className="caption">{text}</p>
      {action && (
        <div className="empty-actions">
          <button className="btn btn-secondary btn-sm" aria-busy={action.busy || undefined} onClick={() => !action.busy && action.onClick()}>
            <Icon name={action.icon} size={15} className={action.busy ? 'spin' : undefined} />
            {action.label}
          </button>
        </div>
      )}
    </div>
  )
}

function FeedSkeleton(): React.JSX.Element {
  return (
    <div className="nf-skel" aria-busy="true">
      <span className="sr-only">Player X demande les dernières annonces à Steam…</span>
      <span className="skel nf-skel-une" aria-hidden="true" />
      <span className="nf-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="nf-skel-card">
            <span className="skel nf-skel-art" />
            <span className="skel" style={{ width: '40%', height: 10 }} />
            <span className="skel" style={{ width: `${70 + (i % 3) * 8}%`, height: 14 }} />
          </span>
        ))}
      </span>
    </div>
  )
}
