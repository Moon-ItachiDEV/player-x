import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cleanName, plural, timeAgo } from '@shared/text'
import type { NewsFeed } from '@shared/types'
import type { NewsPageProps } from '../../contracts'
import { motionReduced } from '../../motion'
import { useNow } from '../settings/parts'
import { TopTitle } from '../TopTabs'
import { Icon, type IconName } from '../ui/Icon'
import { filterFeed, listGroups } from './feedView'
import { GamesSkeleton, NewsGames } from './NewsGames'
import { HeroSkeleton, NewsFeature, NoPatchHero } from './NewsHero'
import { useNewsFeed } from './useNewsFeed'
import './news.css'
import './feed.css'

export type { NewsPageProps }

type NewsTab = 'patches' | 'all'

// Onglet et jeu choisis, propres à ce PC.
const STORAGE_KEY = 'pg.news'
const ALL = '*'

interface NewsPrefs {
  tab: NewsTab
  /** Jeu choisi (`*` : tous). */
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

/**
 * Page Actus des jeux, dans le style de l'Accueil : la plus récente annonce de la vue en plein cadre sous la barre du haut
 * (« À la une »), puis « Tes jeux » : chaque jeu une fois, ses dernières annonces dessous. Les annonces officielles
 * publiées sur Steam.
 */
export function NewsPage({ games, enabled, demo, onRead, onOpenSettings }: NewsPageProps): React.JSX.Element {
  const { state, refreshing, refresh, markAllSeen } = useNewsFeed(enabled, demo)
  const [prefs, setPrefs] = useState<NewsPrefs>(loadPrefs)
  const [marking, setMarking] = useState(false)
  const now = useNow()
  // Lecteurs d'écran : seulement la fin d'une action, jamais le « Relevé il y a N min » qui change chaque minute.
  // Deux fois le même message : une espace insécable en plus, pour qu'il soit lu de nouveau.
  const [status, setStatus] = useState('')
  const announce = useCallback((msg: string) => setStatus((prev) => (prev === msg ? `${msg} ` : msg)), [])
  const pageRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const refreshRef = useRef<HTMLButtonElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const focusAfterMark = useRef(false)
  /** Après un choix de jeu : « Tous tes jeux » prend le focus ; au retour, la jaquette du jeu quitté. */
  const focusAfterPick = useRef<string | null>(null)

  const update = (patch: Partial<NewsPrefs>): void =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })

  const feed = state.status === 'ready' ? state.feed : null
  const items = useMemo(() => feed?.items ?? [], [feed])
  const tab = prefs.tab
  // Un jeu choisi qui n'a plus d'annonce (désinstallé, mode démo basculé) : retour à « Tous ».
  const game = prefs.game !== ALL && items.some((i) => i.gameId === prefs.game) ? prefs.game : ALL
  const gameId = game === ALL ? null : game
  // Compteurs des segments : la vue (le jeu choisi s'il y en a un).
  const patchCount = useMemo(() => filterFeed(items, { patchesOnly: true, gameId }).length, [items, gameId])
  const allCount = useMemo(() => filterFeed(items, { patchesOnly: false, gameId }).length, [items, gameId])
  const shown = useMemo(() => filterFeed(items, { patchesOnly: tab === 'patches', gameId }), [items, tab, gameId])
  // La première annonce de la vue est à la une ; la liste montre les autres, rangées par jeu.
  const groups = useMemo(() => listGroups(shown), [shown])
  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games])
  const anyNew = items.some((i) => i.isNew)
  // Des annonces à montrer : écran du haut, barre « Tes jeux » (et sa sentinelle), liste. Sinon, un état centré.
  const listed = enabled && !!feed && feed.tracked > 0 && items.length > 0

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

  // Choix d'un jeu (ou retour à tous) : le bouton qui avait le focus disparaît, le focus va au bouton qui défait le choix.
  useLayoutEffect(() => {
    const target = focusAfterPick.current
    if (target === null) return
    focusAfterPick.current = null
    if (target === ALL) {
      backRef.current?.focus({ preventScroll: true })
      return
    }
    const page = pageRef.current
    // Le jeu quitté n'avait que l'annonce à la une : pas de tuile dans la liste, le focus va sur le bouton de l'écran.
    const cover = page?.querySelector<HTMLElement>(`[data-game="${CSS.escape(target)}"] .nf-game-cover`)
    ;(cover ?? page?.querySelector<HTMLElement>('.nf-read'))?.focus()
  }, [gameId])

  // Barre du haut transparente sur l'écran du haut au repos, comme l'Accueil ; dès que la page défile, elle reprend son
  // verre (le surtitre de l'écran passerait sinon sous les onglets).
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    const root = pageRef.current?.closest<HTMLElement>('.content')
    if (!root) return
    const onScroll = (): void => setMoved(root.scrollTop > 8)
    onScroll()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [])

  // Barre « Tes jeux » collée sous la barre du haut : le verre n'apparaît qu'une fois collée (comme la Bibliothèque).
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = sentinelRef.current
    const root = el?.closest<HTMLElement>('.content')
    if (!el || !root) {
      setStuck(false)
      return
    }
    // La page monte sous la barre du haut (.content sans padding-top ici) : la zone observée commence sous cette barre.
    const bar = root.closest('.shell')?.querySelector<HTMLElement>(':scope > .topbar')?.offsetHeight ?? 0
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0)), {
      root,
      rootMargin: `-${bar}px 0px 0px 0px`
    })
    io.observe(el)
    return () => io.disconnect()
  }, [listed])

  // Premier relevé terminé pendant que la page est ouverte.
  const wasPending = useRef(false)
  useEffect(() => {
    if (!feed) return
    if (wasPending.current && !feed.pending) announce(afterRefresh(feed))
    wasPending.current = feed.pending
  }, [feed, announce])

  const pickedItem = gameId ? items.find((i) => i.gameId === gameId) : undefined
  const pickedName = pickedItem ? cleanName(pickedItem.gameName) : ''

  // Un jeu choisi (sa jaquette, « Voir les N ») : la page remonte sur son écran.
  const pick = (id: string): void => {
    focusAfterPick.current = ALL
    update({ game: id })
    pageRef.current?.closest('.content')?.scrollTo({ top: 0, behavior: motionReduced() ? 'auto' : 'smooth' })
  }
  const backToAll = (): void => {
    focusAfterPick.current = gameId
    update({ game: ALL })
  }

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

  let content: React.ReactNode
  // L'écran du haut est affiché (annonce, « Aucun patch récent » d'un jeu, squelette) : la barre du haut se pose dessus.
  let hasHero = false
  // Onglet Patchs, tous les jeux, aucun patch : la barre « Tes jeux » et l'état vide, sans écran du haut.
  let bare = false
  if (!enabled) {
    content = (
      <div className="nf-state">
        <Empty
          icon="news"
          title="Les actus des jeux sont désactivées"
          text="Active-les dans Paramètres › Bibliothèque pour suivre les patchs de tes jeux."
          action={{ label: 'Ouvrir les paramètres', icon: 'settings', onClick: onOpenSettings }}
        />
      </div>
    )
  } else if (state.status === 'error') {
    content = (
      <div className="nf-state">
        <Empty icon="alert-circle" title="Actus indisponibles" text={state.message} action={{ label: 'Réessayer', icon: 'refresh', onClick: retry }} />
      </div>
    )
  } else if (!feed || (feed.pending && !items.length)) {
    hasHero = true
    content = <FeedSkeleton />
  } else if (feed.tracked === 0) {
    content = (
      <div className="nf-state">
        <Empty icon="news" title="Pas d'actus pour tes jeux" text="Aucun de tes jeux installés n'a de page Steam : Player X n'a pas d'annonces à te montrer." />
      </div>
    )
  } else if (feed.offline && !items.length) {
    content = (
      <div className="nf-state">
        <Empty
          icon="alert-circle"
          title="Steam ne répond pas"
          text="Les actus arriveront dès que la connexion revient."
          action={{ label: 'Réessayer', icon: 'refresh', onClick: retry, busy: refreshing }}
        />
      </div>
    )
  } else if (!items.length) {
    content = (
      <div className="nf-state">
        <Empty
          icon="news"
          title="Aucune annonce récente"
          text="Tes jeux n'ont rien publié sur Steam ces derniers temps."
          action={{ label: 'Actualiser', icon: 'refresh', onClick: retry, busy: refreshing }}
        />
      </div>
    )
  } else {
    const featured = shown[0]
    hasHero = !!featured || !!pickedItem
    bare = !hasHero
    content = (
      <>
        {featured ? (
          <NewsFeature item={featured} game={byId.get(featured.gameId) ?? { name: featured.gameName }} now={now} onRead={onRead} />
        ) : pickedItem ? (
          <NoPatchHero gameId={pickedItem.gameId} game={byId.get(pickedItem.gameId) ?? { name: pickedItem.gameName }} onAll={() => update({ tab: 'all' })} />
        ) : null}
        <div ref={sentinelRef} className="nf-sentinel" aria-hidden="true" />
        <header className={`nf-head ${stuck ? 'is-stuck' : ''}`}>
          <div className="nf-head-title">
            {pickedItem ? (
              <>
                <h2 id="nf-list-h" className="sr-only">
                  Actus de {pickedName}
                </h2>
                <button ref={backRef} className="nf-back" onClick={backToAll}>
                  <Icon name="chevron-left" size={18} />
                  Tous tes jeux
                </button>
              </>
            ) : (
              <h2 id="nf-list-h" className="nf-h2">
                Tes jeux
              </h2>
            )}
            {/* Hors ligne : l'avertissement prend la place du relevé (pas de ligne en plus, rien ne saute). */}
            <p className={`nf-summary num ${feed.offline ? 'is-offline' : ''}`}>
              {feed.offline ? (
                <>
                  <Icon name="alert-circle" size={15} />
                  <span>
                    Steam ne répond pas<span className="nf-summary-more"> : voici les actus du dernier relevé.</span>
                  </span>
                </>
              ) : (
                summary(feed, now)
              )}
            </p>
          </div>
          <div className="nf-tools">
            <div className="nf-seg" role="group" aria-label="Type d'actus">
              <button className="nf-seg-btn" aria-pressed={tab === 'patches'} onClick={() => tab !== 'patches' && update({ tab: 'patches' })}>
                Patchs<span className="nf-seg-count num">· {patchCount}</span>
              </button>
              <button className="nf-seg-btn" aria-pressed={tab === 'all'} onClick={() => tab !== 'all' && update({ tab: 'all' })}>
                Toutes les actus<span className="nf-seg-count num">· {allCount}</span>
              </button>
            </div>
            {anyNew && (
              // aria-disabled plutôt que disabled : un bouton désactivé perd le focus.
              <button className="nf-tool" aria-disabled={marking || undefined} onClick={markAll}>
                <Icon name="check" size={16} />
                Tout marquer comme lu
              </button>
            )}
            <button
              ref={refreshRef}
              className="nf-icon-btn"
              aria-label="Actualiser"
              title="Actualiser : redemander les dernières annonces à Steam"
              aria-busy={refreshing}
              aria-disabled={refreshing || undefined}
              onClick={() => !refreshing && retry()}
            >
              <Icon name="refresh" size={17} className={refreshing ? 'spin' : undefined} />
            </button>
          </div>
        </header>
        {bare ? (
          <Empty
            icon="download"
            title="Aucun patch récent"
            text="Tes jeux n'ont pas publié de notes de patch dans leurs dernières annonces."
            action={{ label: 'Voir toutes les actus', icon: 'list', onClick: () => update({ tab: 'all' }) }}
          />
        ) : (
          // Une seule annonce (déjà à la une) : pas de liste, la page s'arrête à la barre.
          groups.length > 0 && (
            <section className="nf-list" aria-labelledby="nf-list-h">
              <NewsGames groups={groups} games={byId} now={now} patchesOnly={tab === 'patches'} single={!!pickedItem} onRead={onRead} onPick={pick} />
            </section>
          )
        )}
      </>
    )
  }

  return (
    <div ref={pageRef} className={`nf-page ${bare ? 'is-bare' : ''}`} data-bar={hasHero && !moved ? 'clear' : undefined}>
      <h1 className="sr-only">Actus des jeux</h1>
      <TopTitle>Actus des jeux</TopTitle>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      {content}
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

/** Premier relevé : l'écran du haut, la barre « Tes jeux » et trois jeux, à leur place (rien ne saute quand les actus arrivent). */
function FeedSkeleton(): React.JSX.Element {
  return (
    <div className="nf-skel" aria-busy="true">
      <span className="sr-only">Player X demande les dernières annonces à Steam…</span>
      <HeroSkeleton />
      <div className="nf-head" aria-hidden="true">
        <div className="nf-head-title">
          <span className="skel nf-skel-h2" />
          <span className="skel nf-skel-summary" />
        </div>
        <div className="nf-tools">
          <span className="skel nf-skel-seg" />
          <span className="skel nf-skel-round" />
        </div>
      </div>
      <div className="nf-list" aria-hidden="true">
        <GamesSkeleton />
      </div>
    </div>
  )
}
