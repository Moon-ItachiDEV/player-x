import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CS2_GAME_ID } from '@shared/cs2'
import { PLAYED_SOURCE } from '@shared/played'
import { formatPlayers, loadFr, serversLabel, serversOk, stateFr, waitLabel } from '@shared/servers'
import { updateSentence } from '@shared/steamUpdate'
import { cleanName, formatDate, formatPlaytime, norm, timeAgo } from '@shared/text'
import type { Cs2Servers, Friend, Game, NewsPost, SteamPlayers } from '@shared/types'
import { isBf6Game, useBf6Summary } from './stats/bf6'
import type { GameSheetProps, LaunchFn, View } from '../contracts'
import { sheetLine } from '../launch/copy'
import { isPending } from '../launch/phase'
import { PlayLabel } from '../launch/PlayLabel'
import { useWindowActive } from '../update/useCardPhase'
import { usePlayState, type PlayInfo } from '../launch/usePlayState'
import { updateAction, useSteamUpdate } from '../ready/store'
import { UpdateBadge, UpdateBar, useOpenSteamDownloads } from '../ready/UpdateBadge'
import { useCs2Servers, useSteamPlayers } from '../servers/useServers'
import { EventsBlock } from '../events/EventsBlock'
import { ShelfMenu } from '../shelves/ShelfMenu'
import { useShelves } from '../shelves/store'
import { useGameEvents } from '../events/useGameEvents'
import { AchievementsSection, AchievementsTab } from './achievements/SheetAchievements'
import { useAchievements, type AchievementsLoad } from './achievements/useAchievements'
import { Cs2Matches, Cs2Overview } from './cs2/Cs2Section'
import { useCs2 } from './cs2/useCs2'
import { NewsReader } from './news/NewsReader'
import { NewsSection } from './news/NewsSection'
import { useGameNews } from './news/useGameNews'
import { Avatar } from './ui/Avatar'
import { CountUp } from './ui/CountUp'
import { Cover } from './ui/Cover'
import { Icon } from './ui/Icon'
import { LiveBadge } from './ui/LiveBadge'
import { useEscape } from './ui/Overlay'
import { STORE_LONG, StoreTag } from './ui/StoreTag'
import { errorMessage, useToast } from './ui/Toasts'
import { openedByCard } from './library/GameCard'
import './gamesheet.css'
import './library/uninstalled.css'

/** Durée de l'animation de fermeture (doit suivre gamesheet.css). */
const CLOSE_MS = 180
/** Délai de double-clic de Windows : un clic sur le voile juste après l'ouverture vient d'un double-clic sur une jaquette. */
const DBL_CLICK_MS = 500
/** Hauteur de la barre collante du haut de la fiche (doit suivre gamesheet.css) : « Jouer » passe dedans sous cette ligne. */
const BAR_H = 64

/** Page d'où vient la fiche, pour le fil d'Ariane et « Retour ». */
const FROM_LABEL: Record<View, string> = {
  home: 'Accueil',
  library: 'Bibliothèque',
  friends: 'Amis',
  profile: 'Profil',
  stats: 'Stats de jeu',
  settings: 'Paramètres'
}

type Tab = 'overview' | 'matches' | 'ach' | 'news'
const TAB_LABEL: Record<Tab, string> = {
  overview: 'Aperçu',
  matches: 'Matchs',
  ach: 'Succès',
  news: 'Actus'
}

/** Fiche d'un jeu : une page par-dessus le contenu (le rail reste sous le voile). `game === null` : fermée. */
export function GameSheet(props: GameSheetProps): React.JSX.Element | null {
  const { game } = props
  // On garde le dernier jeu affiché le temps de l'animation de sortie.
  const [last, setLast] = useState<Game | null>(game)
  if (game && game !== last) setLast(game)
  useEffect(() => {
    if (game) return
    // Fermeture en transition de vue : la fiche est déjà masquée dans le nouvel état, on la retire tout de suite.
    const t = setTimeout(() => setLast(null), document.documentElement.classList.contains('vt-close') ? 0 : CLOSE_MS)
    return () => clearTimeout(t)
  }, [game])

  const shown = game ?? last
  if (!shown) return null
  return <Sheet {...props} game={shown} closing={!game} />
}

type SheetProps = Omit<GameSheetProps, 'game'> & {
  game: Game
  closing: boolean
}

function Sheet({
  game,
  friends,
  closing,
  news,
  from,
  onClose,
  onLaunch,
  onRescan,
  onFavorite,
  onOpenFolder,
  onInstall,
  onOpenStats
}: SheetProps): React.JSX.Element {
  const panelRef = useRef<HTMLElement>(null)
  const posterRef = useRef<HTMLDivElement>(null)
  const playRef = useRef<HTMLButtonElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const p = usePlayState(game, onLaunch)
  const [stuck, setStuck] = useState(false)
  const [pop, setPop] = useState(0)
  const openedAt = useRef(0)
  // Ouverte par une transition de vue : pas d'entrée CSS en plus (la classe reste pour cette ouverture).
  const [morph] = useState(() => document.documentElement.classList.contains('vt-open'))

  // Actus : lues à l'ouverture (premier onglet de la fiche).
  const { state: newsState, reload: reloadNews } = useGameNews(game.id, news && !closing)
  // Succès Steam : lus à l'ouverture, pour les jeux Steam seulement. La liste complète est l'onglet « Succès ».
  const { state: achState, reload: reloadAch } = useAchievements(game.id, game.store === 'steam' && !closing)
  // Counter-Strike 2 : match en direct et bilans (onglet « Matchs »), lus seulement sur sa fiche.
  const isCs2 = game.id === CS2_GAME_ID && !game.notInstalled
  const { state: cs2, live } = useCs2(isCs2 && !closing)
  // Prêt à jouer : mise à jour Steam en attente ou en cours. Le bouton « Mettre à jour » ouvre les téléchargements de
  // Steam, sans lancer le jeu.
  const update = useSteamUpdate(game.notInstalled ? null : game)
  const act = p.state === 'idle' ? updateAction(update) : undefined
  const openDownloads = useOpenSteamDownloads()
  // Masqué (Ranger › Masquer) : la fiche le dit, et « Ranger » permet de le réafficher.
  const hidden = useShelves().hidden.includes(game.id)
  // Événements (saisons, bonus d'XP…) de la page Steam du jeu : en haut de l'onglet Actus.
  const eventsInfo = useGameEvents(game, news && !closing)
  // Serveurs : l'état de CS2 selon Valve ; pour tout jeu Steam, les joueurs en jeu sur Steam.
  const servers = useCs2Servers(isCs2 && !closing)
  const players = useSteamPlayers(closing ? null : game)

  // Onglets montrés : ceux qui ont quelque chose à dire pour ce jeu. « Actus » en premier, ouvert d'office (demande de
  // Breezydev, 0.9.6-beta.2 : la page Actus est retirée, les actus d'un jeu sont sur sa fiche) ; un jeu sans page Steam ou
  // sans aucune annonce s'ouvre sur l'aperçu.
  const newsShown = news && !(newsState.status === 'ready' && (!newsState.news.appId || !newsState.news.posts.length))
  const achShown = game.store === 'steam' && !(achState.status === 'ready' && (achState.data.state === 'not-steam' || achState.data.state === 'none'))
  const hasMatches = isCs2 && !!cs2?.enabled
  const tabs: Tab[] = [...(newsShown ? (['news'] as const) : []), 'overview', ...(hasMatches ? (['matches'] as const) : []), ...(achShown ? (['ach'] as const) : [])]
  const [tab, setTab] = useState<Tab>('news')
  const current = tabs.includes(tab) ? tab : 'overview'
  const focusTab = useRef(false)

  // Annonce ouverte dans le lecteur (identifiant), et d'où on vient pour y revenir.
  const [reading, setReading] = useState<string | null>(null)
  const readingRef = useRef(reading)
  readingRef.current = reading
  const readerBack = useRef<HTMLButtonElement>(null)
  const readerOpener = useRef<HTMLElement | null>(null)
  const listScroll = useRef(0)
  const seenFor = useRef<string | null>(null)
  const readSeen = useRef<string | null>(null)

  // Autre jeu, ou fiche rouverte pendant l'animation de fermeture : on repart du premier onglet, lecteur fermé.
  // Pendant le rendu (et pas dans un effet) : l'effet de focus de l'ouverture doit déjà voir le bon état.
  const [resetKey, setResetKey] = useState(`${game.id}|${closing}`)
  if (resetKey !== `${game.id}|${closing}`) {
    setResetKey(`${game.id}|${closing}`)
    if (!closing) {
      setReading(null)
      setTab('news')
    }
  }

  const markSeen = useCallback(() => {
    if (seenFor.current === game.id) return
    seenFor.current = game.id
    window.launcher.markNewsSeen(game.id).catch(() => {})
  }, [game.id])

  // Annonce lue : vue jusqu'à elle (les plus récentes gardent « Nouveau »).
  useEffect(() => {
    if (!reading || newsState.status !== 'ready') return
    const read = newsState.news.posts.find((p) => p.id === reading)
    const key = `${game.id}:${reading}`
    if (!read || readSeen.current === key) return
    readSeen.current = key
    window.launcher.markNewsSeen(game.id, read.date).catch(() => {})
  }, [reading, newsState, game.id])

  const openPost = (id: string, opener: HTMLElement): void => {
    readerOpener.current = opener
    listScroll.current = panelRef.current?.scrollTop ?? 0
    setReading(id)
  }
  const closeReader = (): void => setReading(null)

  /** Passe à un onglet depuis un lien de l'aperçu (« Tous les matchs », « Voir les succès ») : focus sur l'onglet. */
  const goTab = (t: Tab): void => {
    focusTab.current = true
    setTab(t)
  }
  useLayoutEffect(() => {
    if (!focusTab.current) return
    focusTab.current = false
    tabsRef.current?.scrollIntoView({ block: 'nearest' })
    document.getElementById(`sheet-tab-${current}`)?.focus({ preventScroll: true })
  }, [current])

  // Onglets : flèches gauche/droite, Début et Fin (activation directe).
  const onTabKey = (e: React.KeyboardEvent): void => {
    const i = tabs.indexOf(current)
    const next =
      e.key === 'ArrowRight'
        ? (i + 1) % tabs.length
        : e.key === 'ArrowLeft'
          ? (i - 1 + tabs.length) % tabs.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tabs.length - 1
              : -1
    if (next < 0) return
    e.preventDefault()
    goTab(tabs[next])
  }

  // Lecteur ouvert : en haut, focus sur « Retour ». Refermé : retour à la même hauteur, focus sur l'actu d'origine
  // (introuvable : haut de la fiche et focus sur la page).
  // On retient le jeu dont le lecteur était ouvert : sur un autre jeu, pas de retour à la hauteur de l'ancien.
  const wasReading = useRef<string | null>(null)
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    if (reading) {
      panel.scrollTop = 0
      if (panel.contains(document.activeElement)) readerBack.current?.focus({ preventScroll: true })
      else readerOpener.current = null
    } else if (wasReading.current === game.id) {
      const opener = readerOpener.current
      if (opener?.isConnected) {
        panel.scrollTop = listScroll.current
        opener.focus({ preventScroll: true })
      } else {
        panel.scrollTop = 0
        panel.focus({ preventScroll: true })
      }
    }
    wasReading.current = reading ? game.id : null
  }, [reading, game.id])

  // Échap : ferme le lecteur, sinon la fiche. Un menu (tri des succès) ou un bilan ouvert par-dessus se ferme d'abord, seul.
  useEscape(!closing, () => {
    if (document.querySelector('.menu, .dialog-scrim')) return
    if (readingRef.current) closeReader()
    else onClose()
  })

  useEffect(() => {
    if (!closing) openedAt.current = performance.now()
  }, [closing, game.id])

  // Double-clic lent sur une jaquette : le 2e clic tombe sur le voile. On lance le jeu au lieu de refermer.
  // Ouverte autrement (« Détails », vignette), un double-clic est seulement ignoré.
  const onScrimClick = (e: React.MouseEvent): void => {
    const justOpened = performance.now() - openedAt.current < DBL_CLICK_MS
    if (justOpened && e.detail === 2 && p.state === 'idle' && openedByCard(DBL_CLICK_MS)) p.activate(posterRef.current)
    if (justOpened || e.detail > 1) return
    onClose()
  }

  // Focus : on entre dans la fiche à l'ouverture (sur « Retour » si elle s'ouvre sur une annonce), on rend la main à
  // l'élément d'origine à la fermeture. Fermée par un clic ailleurs (une page de la barre du haut), le focus reste là où
  // on a cliqué : il ne repart pas, par exemple, dans la recherche qui avait ouvert la fiche.
  useEffect(() => {
    if (closing) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const target = readingRef.current ? readerBack.current : panelRef.current
    target?.focus({ preventScroll: true })
    return () => {
      const now = document.activeElement
      const elsewhere = now instanceof HTMLElement && now !== document.body && !now.closest('.sheet-root')
      if (!elsewhere && opener?.isConnected && !panelRef.current?.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [closing])

  // Nouveau jeu : retour en haut.
  useLayoutEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0
  }, [game.id])

  // « Jouer » passe sous la barre du haut : la barre prend un fond et sa propre copie du bouton.
  useEffect(() => {
    const root = panelRef.current
    const el = actionsRef.current
    if (!root || !el) return
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { root, rootMargin: `-${BAR_H}px 0px 0px 0px` })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const trapFocus = (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.key !== 'Tab' || !panelRef.current) return
    // Le contenu de la fiche reste monté (caché) pendant la lecture d'une actu : on ne garde que ce qui est visible.
    const items = [...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, [tabindex]:not([tabindex="-1"])')].filter(
      (el) => el.checkVisibility?.({ visibilityProperty: true }) ?? true
    )
    if (!items.length) return
    const first = items[0]
    const lastItem = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault()
      lastItem.focus()
    } else if (!e.shiftKey && active === lastItem) {
      e.preventDefault()
      first.focus()
    }
  }

  const title = cleanName(game.name)
  const titleId = `sheet-title-${game.id}`
  const fromLabel = FROM_LABEL[from ?? 'library']
  const playing = friends.filter((f) => f.status === 'in-game' && f.game && norm(f.game) === norm(game.name))
  // Discord : membres en ligne d'un serveur, jamais des amis.
  const pals = playing.filter((f) => f.platform !== 'discord')
  const members = playing.filter((f) => f.platform === 'discord')
  const toggleFavorite = (): void => {
    if (!game.favorite) setPop((n) => n + 1)
    onFavorite(game)
  }

  const achCard = game.store === 'steam' && <AchievementsSection state={achState} onOpenAll={() => goTab('ach')} onRetry={reloadAch} />

  return (
    <div className={`sheet-root ${morph ? 'is-morph' : ''} ${closing ? 'is-closing' : ''}`} inert={closing}>
      <div className="sheet-scrim" onClick={onScrimClick} aria-hidden="true" />
      <aside
        ref={panelRef}
        className={`sheet-panel ${reading ? 'is-reading' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        <header className={`sheet-bar ${stuck ? 'is-stuck' : ''}`}>
          <button className="sheet-back" onClick={onClose} aria-label={`Retour : ${fromLabel}`} title="Retour (Échap)">
            <Icon name="chevron-left" size={18} />
          </button>
          <p className="sheet-crumbs">
            <span className="sheet-crumbs-from">{fromLabel}</span>
            <span className="sheet-crumbs-sep" aria-hidden="true">
              /
            </span>
            <span className="sheet-crumbs-here">{title}</span>
          </p>
          <span className="sheet-bar-actions" inert={!stuck}>
            {game.notInstalled ? (
              <button className="btn btn-primary btn-sm" onClick={() => onInstall(game)} title="Installer avec Steam">
                <Icon name="download" size={16} />
                Installer
              </button>
            ) : (
              <button
                className={`btn btn-primary btn-play sheet-bar-play ${p.className}`}
                onClick={() => (act ? openDownloads() : p.activate(posterRef.current))}
                aria-disabled={p.inert || undefined}
                aria-busy={p.busy || undefined}
                aria-label={act ? `${act.label} : ${title}` : p.ariaLabel}
                title={act ? act.title : p.state === 'idle' ? undefined : p.title}
              >
                <PlayLabel p={p} size={16} label={act?.label} icon={act ? 'download' : undefined} />
              </button>
            )}
          </span>
        </header>

        <div className="sheet-page">
          <section className="sheet-hero" aria-labelledby={titleId}>
            <div className="sheet-art">
              <Cover key={game.id} game={game} variant="landscape" showTitle={false} />
              <div className="sheet-art-shade" />
            </div>
            <div className="sheet-hero-body">
              <div ref={posterRef} className="sheet-poster">
                <Cover key={`p-${game.id}`} game={game} variant="portrait" showTitle={false} />
              </div>
              <div className="sheet-heading">
                <span className="sheet-tags">
                  <StoreTag kind={game.store} long />
                  {game.running && <LiveBadge />}
                  {hidden && <span className="sheet-uninstalled">Masqué</span>}
                  {game.notInstalled ? (
                    <span className="sheet-uninstalled">Pas installé</span>
                  ) : update ? (
                    <UpdateBadge update={update} />
                  ) : (
                    <span className="sheet-installed">Installé</span>
                  )}
                </span>
                <SheetTitle id={titleId} title={title} logo={game.logoUrl} />
                <Facts game={game} ach={achState} />
                {!game.notInstalled && <LaunchLine game={game} p={p} playRef={playRef} onLaunch={onLaunch} onRescan={onRescan} />}
              </div>
              <div ref={actionsRef} className="sheet-actions">
                {game.notInstalled ? (
                  // Pas installé sur ce PC : Steam s'occupe du téléchargement ; ni favori ni dossier tant que le jeu n'est pas là.
                  <>
                    <button className="btn btn-primary btn-play sheet-play" onClick={() => onInstall(game)} title="Installer avec Steam" data-magnetic>
                      <Icon name="download" size={20} />
                      Installer
                    </button>
                    <ShelfMenu game={game} className="sheet-round" />
                  </>
                ) : (
                  <>
                    <button
                      ref={playRef}
                      className={`btn btn-primary btn-play sheet-play ${p.className}`}
                      onClick={() => (act ? openDownloads() : p.activate(posterRef.current))}
                      aria-disabled={p.inert || undefined}
                      aria-busy={p.busy || undefined}
                      aria-label={act ? `${act.label} : ${title}` : p.ariaLabel}
                      title={act ? act.title : p.state === 'idle' ? undefined : p.title}
                      data-magnetic={p.state === 'idle' ? '' : undefined}
                    >
                      <PlayLabel p={p} size={20} label={act?.label} icon={act ? 'download' : undefined} />
                    </button>
                    <button
                      className={`sheet-round ${game.favorite ? 'is-fav' : ''}`}
                      onClick={toggleFavorite}
                      aria-pressed={!!game.favorite}
                      aria-label={game.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      title={game.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    >
                      <span key={pop} className={pop ? 'sheet-star-pop' : undefined}>
                        <Icon name="star" size={20} filled={!!game.favorite} />
                      </span>
                    </button>
                    <button
                      className="sheet-round"
                      onClick={() => onOpenFolder(game)}
                      disabled={!game.installDir}
                      aria-label="Ouvrir le dossier d'installation"
                      title={game.installDir ? "Ouvrir le dossier d'installation" : "Dossier d'installation inconnu"}
                    >
                      <Icon name="folder" size={20} />
                    </button>
                    <ShelfMenu game={game} className="sheet-round" />
                  </>
                )}
              </div>
            </div>
          </section>

          {tabs.length > 1 && (
            <div ref={tabsRef} className="sheet-tabs" role="tablist" aria-label="Sections du jeu" onKeyDown={onTabKey}>
              {tabs.map((t) => (
                <button
                  key={t}
                  id={`sheet-tab-${t}`}
                  className="sheet-tab"
                  role="tab"
                  aria-selected={t === current}
                  aria-controls="sheet-tabpanel"
                  tabIndex={t === current ? 0 : -1}
                  onClick={() => setTab(t)}
                >
                  {TAB_LABEL[t]}
                </button>
              ))}
            </div>
          )}

          <div
            id="sheet-tabpanel"
            className="sheet-tabpanel"
            role={tabs.length > 1 ? 'tabpanel' : undefined}
            aria-labelledby={tabs.length > 1 ? `sheet-tab-${current}` : undefined}
          >
            {current === 'overview' && (
              <div className="sheet-cols">
                <div className="sheet-main">
                  {isBf6Game(game) && <Bf6Link onOpen={onOpenStats} />}
                  {isCs2 && cs2 && <Cs2Overview state={cs2} live={live} onRetry={onRescan} onOpenFolder={() => onOpenFolder(game)} onShowAll={() => goTab('matches')} />}
                  {!hasMatches && achCard}
                  <section className="sheet-card" aria-labelledby="sheet-install-h">
                    <h3 id="sheet-install-h" className="sheet-h">
                      Installation
                    </h3>
                    {update && (
                      <div className="sheet-update">
                        <p className="sheet-update-text">{updateSentence(update)}</p>
                        <UpdateBar update={update} className="is-inline" />
                        <button className="btn btn-secondary btn-sm" onClick={openDownloads}>
                          <Icon name="external-link" size={16} />
                          Voir dans Steam
                        </button>
                      </div>
                    )}
                    <InstallPath game={game} onOpenFolder={onOpenFolder} />
                  </section>
                </div>
                <div className="sheet-side">
                  {(servers || players) && <ServersCard servers={servers} players={players} />}
                  {hasMatches && achCard}
                  {/* Personne sur ce jeu : pas de carte (pas de ligne de remplissage). */}
                  {pals.length > 0 && <FriendsCard title="Amis sur ce jeu" list={pals} />}
                  {members.length > 0 && <FriendsCard title="Membres du serveur Discord" list={members} />}
                </div>
              </div>
            )}
            {current === 'matches' && cs2 && <Cs2Matches state={cs2} live={live} onRetry={onRescan} onOpenFolder={() => onOpenFolder(game)} />}
            {current === 'ach' && <AchievementsTab state={achState} onRetry={reloadAch} />}
            {current === 'news' && <EventsBlock info={eventsInfo} />}
            {current === 'news' && (
              <NewsSection
                game={game}
                state={newsState}
                seenAt={newsState.status === 'ready' ? newsState.news.seenAt : 0}
                onRead={(post: NewsPost, opener) => openPost(post.id, opener)}
                onRetry={reloadNews}
                onSeen={markSeen}
              />
            )}
          </div>
        </div>

        {reading && <NewsReader gameName={title} state={newsState} postId={reading} backRef={readerBack} onBack={closeReader} onClose={onClose} onRetry={reloadNews} />}
      </aside>
    </div>
  )
}

/** Logos qui n'ont pas chargé (absents du CDN de Steam, hors ligne) : pas de nouvel essai pendant la session. */
const brokenLogos = new Set<string>()

/**
 * Titre du bandeau : le logo du jeu quand Steam en a un, sinon (ou s'il ne charge pas) le nom en texte. Le logo garde
 * sa place pendant le chargement (hauteur fixe) et apparaît en fondu ; le titre reste le nom accessible.
 */
function SheetTitle({ id, title, logo }: { id: string; title: string; logo?: string }): React.JSX.Element {
  const [, setBroken] = useState(0)
  const [loaded, setLoaded] = useState<string | null>(null)
  if (logo && !brokenLogos.has(logo)) {
    return (
      <h2 id={id} className="sheet-title is-logo">
        <img
          key={logo}
          className={`sheet-logo ${loaded === logo ? 'is-loaded' : ''}`}
          src={logo}
          alt={title}
          draggable={false}
          onLoad={() => setLoaded(logo)}
          onError={() => {
            brokenLogos.add(logo)
            setBroken((n) => n + 1)
          }}
        />
      </h2>
    )
  }
  return (
    <h2 id={id} className="sheet-title">
      {title}
    </h2>
  )
}

/**
 * Chiffres du jeu sous le titre : temps de jeu, dernière partie, lancements depuis Player X, succès.
 * D'où vient chaque chiffre : en infobulle, et lu par les lecteurs d'écran.
 */
function Facts({ game, ach }: { game: Game; ach: AchievementsLoad }): React.JSX.Element {
  const playedSrc = game.running ? 'session' : game.lastPlayedSource
  const timeSrc = game.running ? 'partie en cours' : game.playtimeSource === 'steam' || game.notInstalled ? 'selon Steam' : 'mesuré par Player X'
  const achData = ach.status === 'ready' && ach.data.state === 'ready' && ach.data.total > 0 ? ach.data : null
  let last: React.JSX.Element
  if (game.running) {
    last = (
      <span className="sheet-fact is-live">
        <b>Partie en cours</b>
      </span>
    )
  } else if (game.lastPlayed) {
    const src = playedSrc ? PLAYED_SOURCE[playedSrc] : undefined
    last = (
      <span className="sheet-fact" title={[formatDate(game.lastPlayed), src].filter(Boolean).join(' · ')}>
        Dernière partie <b>{timeAgo(game.lastPlayed)}</b>
        {src && <span className="sr-only">, {src}</span>}
      </span>
    )
  } else if (game.notInstalled && !game.playtime) {
    last = (
      <span className="sheet-fact" title="selon Steam">
        <b>Jamais joué</b>
        <span className="sr-only">, selon Steam</span>
      </span>
    )
  } else {
    last = <span className="sheet-fact">{game.playtime ? 'Date de la dernière partie inconnue' : 'Aucune partie connue'}</span>
  }
  return (
    <p className="sheet-facts">
      <span className={`sheet-fact ${game.running ? 'is-live' : ''}`} title={timeSrc}>
        <b>{game.playtime ? <CountUp value={game.playtime} format={formatPlaytime} /> : '0 min'}</b> de jeu
        <span className="sr-only">, {timeSrc}</span>
      </span>
      {!game.running && last}
      {/* Aucun lancement depuis Player X : pas de « 0 » (le jeu a pu être joué ailleurs). */}
      {!game.notInstalled && (game.launches ?? 0) > 0 && (
        <span className="sheet-fact" title="depuis Player X">
          <b className="num">{game.launches}</b> lancement
          {game.launches! > 1 ? 's' : ''}
          <span className="sr-only"> depuis Player X</span>
        </span>
      )}
      {achData && (
        <span className="sheet-fact">
          <b className="num">
            {achData.unlocked} / {achData.total}
          </b>{' '}
          succès
        </span>
      )}
    </p>
  )
}

/** Raccourci vers la page Stats, sur la fiche de Battlefield 6 : ton K/D et tes victoires si ton compte est relié. */
function Bf6Link({ onOpen }: { onOpen: () => void }): React.JSX.Element {
  const summary = useBf6Summary()
  const sub =
    summary === undefined
      ? 'Chargement…'
      : summary === null
        ? 'Relie ton profil pour voir ton K/D, tes armes et tes cartes'
        : [summary.kd, summary.win, summary.name].filter(Boolean).join(' · ')
  return (
    <button className="sheet-link" onClick={onOpen}>
      <span className="sheet-link-icon">
        <Icon name="chart" size={20} />
      </span>
      <span className="sheet-link-text">
        <span className="sheet-link-title">{summary === null ? 'Stats Battlefield 6' : 'Tes stats Battlefield 6'}</span>
        <span className="sheet-link-sub">{sub}</span>
      </span>
      <Icon name="chevron-right" size={16} className="sheet-link-go" />
    </button>
  )
}

/**
 * Serveurs : pour Counter-Strike 2, ce que dit Valve (matchmaking, connexion, attente moyenne, datacenters européens) ;
 * pour tout jeu Steam, les joueurs en jeu sur Steam. Rien d'inventé : sans réponse, la carte n'est pas là.
 */
function ServersCard({ servers, players }: { servers: Cs2Servers | null; players: SteamPlayers | null }): React.JSX.Element {
  const at = servers?.at ?? players?.at ?? Date.now()
  const sample = !!(servers?.sample || players?.sample)
  return (
    <section className="sheet-card sheet-servers" aria-labelledby="sheet-servers-h">
      <h3 id="sheet-servers-h" className="sheet-h">
        {servers ? 'Serveurs' : 'En ce moment'}
      </h3>
      {servers && (
        <p className={`sheet-srv-state ${serversOk(servers) ? 'is-ok' : 'is-bad'}`}>
          <span className="srv-dot" aria-hidden="true" />
          {serversLabel(servers)}
        </p>
      )}
      <dl className="sheet-srv-rows">
        {servers && (
          <>
            <div>
              <dt>Connexion à Steam</dt>
              <dd>{stateFr(servers.logon)}</dd>
            </div>
            <div>
              <dt>Matchmaking</dt>
              <dd>{stateFr(servers.matchmaking)}</dd>
            </div>
            {servers.searchSeconds !== undefined && (
              <div>
                <dt>Attente moyenne</dt>
                <dd className="num">{waitLabel(servers.searchSeconds)}</dd>
              </div>
            )}
            {servers.searching !== undefined && (
              <div>
                <dt>En recherche d'une partie</dt>
                <dd className="num">{formatPlayers(servers.searching)}</dd>
              </div>
            )}
          </>
        )}
        {players && (
          <div>
            <dt>En jeu sur Steam</dt>
            <dd className="num">{formatPlayers(players.count)}</dd>
          </div>
        )}
      </dl>
      {servers && servers.europe.length > 0 && (
        <div className="sheet-srv-eu">
          <p className="sheet-srv-sub">Charge des serveurs en Europe</p>
          <ul className="sheet-srv-dcs">
            {servers.europe.map((d) => (
              <li key={d.name}>
                {d.name} <strong>{loadFr(d.load)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="caption">
        {servers ? 'Selon Valve' : 'Selon Steam'}, {timeAgo(at)}
        {sample ? ' · chiffres d’exemple (simulateur)' : ''}
      </p>
    </section>
  )
}

function FriendsCard({ title, list }: { title: string; list: Friend[] }): React.JSX.Element {
  return (
    <section className="sheet-card is-list" aria-label={title}>
      <h3 className="sheet-h">
        {title}
        <span className="sheet-h-count num">{list.length}</span>
      </h3>
      <ul className="sheet-friends">
        {list.map((f) => (
          <li key={f.id} className="sheet-friend">
            <Avatar name={f.name} url={f.avatarUrl} size={40} status="in-game" />
            <span className="sheet-friend-text">
              <span className="sheet-friend-name">{f.name}</span>
              <span className="sheet-friend-sub">{f.device ? `En jeu · ${f.device}` : 'En jeu maintenant'}</span>
            </span>
            <StoreTag kind={f.platform} size={20} className="sheet-friend-pf" />
          </li>
        ))}
      </ul>
    </section>
  )
}

function InstallPath({ game, onOpenFolder }: { game: Game; onOpenFolder: (g: Game) => void }): React.JSX.Element {
  const notify = useToast()
  const dir = game.installDir

  const id = <span className="sheet-id">ID : {game.id}</span>

  if (game.notInstalled) {
    return (
      <>
        <p className="sheet-unknown">Pas installé sur ce PC. « Installer » ouvre Steam, qui télécharge le jeu ; il rejoint ensuite ta bibliothèque Player X tout seul.</p>
        <div className="sheet-path-actions">{id}</div>
      </>
    )
  }

  if (!dir) {
    return (
      <>
        <p className="sheet-unknown">Dossier inconnu&nbsp;: c'est le lanceur {STORE_LONG[game.store]} qui gère l'installation.</p>
        <div className="sheet-path-actions">{id}</div>
      </>
    )
  }

  const copy = (): void => {
    navigator.clipboard
      .writeText(dir)
      .then(() => notify('Chemin copié', { kind: 'success' }))
      .catch((e) => notify(errorMessage(e), { kind: 'error' }))
  }

  return (
    <>
      <PathBox path={dir} />
      <div className="sheet-path-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => onOpenFolder(game)}>
          <Icon name="folder" size={16} />
          Ouvrir le dossier
        </button>
        <button className="btn btn-secondary btn-sm" onClick={copy}>
          <Icon name="copy" size={16} />
          Copier
        </button>
        {id}
      </div>
    </>
  )
}

/** Chemin sur une ligne, tronqué au milieu pour garder la fin visible. */
function PathBox({ path }: { path: string }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [text, setText] = useState(path)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ctx = document.createElement('canvas').getContext('2d')
    let alive = true
    const fit = (): void => {
      if (!alive) return
      const style = getComputedStyle(el)
      const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      if (!ctx || width <= 0) return setText(path)
      ctx.font = style.font
      setText(middleEllipsis(path, width, (s) => ctx.measureText(s).width))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    // Les polices peuvent arriver après le premier calcul.
    document.fonts?.ready.then(fit)
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [path])

  return (
    <div ref={ref} className="sheet-path" title={path}>
      {text}
    </div>
  )
}

function middleEllipsis(text: string, max: number, measure: (s: string) => number): string {
  if (measure(text) <= max) return text
  // Garde 40 % du début et 60 % de la fin (le nom du dossier du jeu).
  const cut = (n: number): string => {
    const head = Math.floor(n * 0.4)
    return `${text.slice(0, head)}…${text.slice(text.length - (n - head))}`
  }
  let lo = 0
  let hi = text.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(cut(mid)) <= max) lo = mid
    else hi = mid - 1
  }
  return cut(lo)
}

/**
 * Ligne sous le titre (spec launch-sequence.md §3.3) : où en est le lancement, compteur compris. Pas une région
 * annoncée (la carte du lancement s'en charge). Un échec reste affiché jusqu'à la fermeture de la fiche.
 */
interface LaunchLineProps {
  game: Game
  p: PlayInfo
  /** « Jouer » de la fiche : toujours monté et focalisable (aria-disabled), il reprend le focus du lien qui disparaît. */
  playRef: React.RefObject<HTMLButtonElement | null>
  onLaunch: LaunchFn
  onRescan?: () => void
}

function LaunchLine({ game, p, playRef, onLaunch, onRescan }: LaunchLineProps): React.JSX.Element | null {
  const active = useWindowActive()
  const [now, setNow] = useState(() => Date.now())
  // Ouverture de la fiche : un lancement terminé avant n'y est pas rappelé.
  const [openedAt] = useState(() => Date.now())
  const v = p.launch
  const s = v?.status
  const pending = !!s && isPending(s.phase)
  useEffect(() => {
    if (!pending || !active || !s) return
    const at = Date.now()
    const id = setTimeout(() => setNow(Date.now()), 1000 - ((at - s.clickAt) % 1000) + 8)
    return () => clearTimeout(id)
  }, [pending, active, s, now])
  // La partie simulée de la démo tient lieu de « Partie en cours » : dite même si elle a commencé avant l'ouverture.
  const demoRunning = !!s?.demo && s.phase === 'running'
  if (!v || !s || v.checking || (!pending && !demoRunning && v.changedAt < openedAt)) return null
  const line = sheetLine(s, {
    name: cleanName(game.name),
    now: active ? Date.now() : now
  })
  if (!line?.text) return null
  const act = line.action
  return (
    <p className={`sheet-launch-line ${line.tone === 'danger' ? 'is-danger' : ''}`}>
      {line.icon && <Icon name={line.icon} size={14} />}
      <span className="num">{line.text}</span>
      {act && (act.kind !== 'rescan' || onRescan) && (
        <button
          className="link-btn"
          onClick={() => {
            if (act.kind === 'rescan') return onRescan?.()
            // La ligne du nouveau lancement n'a pas de lien : le focus passe d'abord sur « Jouer » (il ne tombe pas sur
            // <body> dans la fiche modale), qui devient aussi le contrôle d'origine du lancement.
            playRef.current?.focus({ preventScroll: true })
            onLaunch(game, null, act.kind)
          }}
        >
          {act.label}
        </button>
      )}
    </p>
  )
}
