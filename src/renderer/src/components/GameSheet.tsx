import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { capitalize, cleanName, formatDate, formatPlaytime, norm, timeAgo } from '@shared/text'
import type { Friend, Game, NewsPost } from '@shared/types'
import { isBf6Game, useBf6Summary } from './stats/bf6'
import type { GameSheetProps, LaunchFn } from '../contracts'
import { sheetLine } from '../launch/copy'
import { isPending } from '../launch/phase'
import { PlayLabel } from '../launch/PlayLabel'
import { useWindowActive } from '../update/useCardPhase'
import { usePlayState, type PlayInfo } from '../launch/usePlayState'
import { ACH_VIEW, AchievementsSection, AchievementsView } from './achievements/SheetAchievements'
import { useAchievements } from './achievements/useAchievements'
import { NewsReader } from './news/NewsReader'
import { NewsBanner, NewsSection } from './news/NewsSection'
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

/** Tiroir de fiche de jeu, à droite. `game === null` : fermé. */
export function GameSheet(props: GameSheetProps): React.JSX.Element | null {
  const { game } = props
  // On garde le dernier jeu affiché le temps de l'animation de sortie.
  const [last, setLast] = useState<Game | null>(game)
  if (game && game !== last) setLast(game)
  useEffect(() => {
    if (game) return
    // Fermeture en transition de vue : le tiroir est déjà masqué dans le nouvel état, on le retire tout de suite.
    const t = setTimeout(() => setLast(null), document.documentElement.classList.contains('vt-close') ? 0 : CLOSE_MS)
    return () => clearTimeout(t)
  }, [game])

  const shown = game ?? last
  if (!shown) return null
  return <Sheet {...props} game={shown} closing={!game} />
}

type SheetProps = Omit<GameSheetProps, 'game'> & { game: Game; closing: boolean }

function Sheet({ game, friends, closing, news, onClose, onLaunch, onRescan, onFavorite, onOpenFolder, onInstall, onOpenStats }: SheetProps): React.JSX.Element {
  const panelRef = useRef<HTMLElement>(null)
  const posterRef = useRef<HTMLDivElement>(null)
  const playRef = useRef<HTMLButtonElement>(null)
  const p = usePlayState(game, onLaunch)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  const [pop, setPop] = useState(0)
  const openedAt = useRef(0)
  // Ouverte par une transition de vue : pas de glissement CSS en plus (la classe reste pour cette ouverture).
  const [morph] = useState(() => document.documentElement.classList.contains('vt-open'))

  // Actus : lues à l'ouverture. Le patch signalé par le badge reste en haut tant que la fiche est ouverte,
  // même une fois marqué comme vu (le badge des cartes, lui, disparaît).
  const { state: newsState, reload: reloadNews } = useGameNews(game.id, news && !closing)
  const [opened, setOpened] = useState({ id: game.id, patch: game.newPatch })
  if (opened.id !== game.id) setOpened({ id: game.id, patch: game.newPatch })
  const patch = news ? opened.patch : undefined
  // Succès Steam : lus à l'ouverture, pour les jeux Steam seulement. La liste complète s'ouvre comme une annonce (ACH_VIEW).
  const { state: achState, reload: reloadAch } = useAchievements(game.id, game.store === 'steam' && !closing)
  // Annonce ouverte dans le lecteur (identifiant), et d'où on vient pour y revenir.
  const [reading, setReading] = useState<string | null>(null)
  const readerBack = useRef<HTMLButtonElement>(null)
  const readerOpener = useRef<HTMLElement | null>(null)
  const listScroll = useRef(0)
  const seenFor = useRef<string | null>(null)

  const markSeen = useCallback(() => {
    if (seenFor.current === game.id) return
    seenFor.current = game.id
    window.launcher.markNewsSeen(game.id).catch(() => {})
  }, [game.id])

  // Le bandeau du patch est en haut de la fiche : vu dès que les actus sont là.
  useEffect(() => {
    if (patch && newsState.status === 'ready') markSeen()
  }, [patch, newsState.status, markSeen])

  const openPost = (id: string, opener: HTMLElement): void => {
    readerOpener.current = opener
    listScroll.current = panelRef.current?.scrollTop ?? 0
    setReading(id)
  }
  const closeReader = (): void => setReading(null)

  // Lecteur ouvert : en haut, focus sur « Retour ». Refermé : retour à la même hauteur, focus sur l'actu d'origine.
  const wasReading = useRef(false)
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    if (reading) {
      panel.scrollTop = 0
      readerBack.current?.focus({ preventScroll: true })
    } else if (wasReading.current) {
      panel.scrollTop = listScroll.current
      const opener = readerOpener.current
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
    wasReading.current = !!reading
  }, [reading])

  // Autre jeu : on quitte le lecteur (sans revenir à la hauteur de l'ancien jeu).
  useEffect(() => {
    wasReading.current = false
    setReading(null)
  }, [game.id])

  useEscape(!closing && !reading, onClose)
  useEscape(!closing && !!reading, closeReader)

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

  // Focus : on entre dans le tiroir à l'ouverture, on rend la main à l'élément d'origine à la fermeture.
  useEffect(() => {
    if (closing) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      if (opener?.isConnected && !panelRef.current?.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [closing])

  // Nouveau jeu : retour en haut.
  useLayoutEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0
  }, [game.id])

  // Filet sous la rangée d'actions quand elle colle en haut.
  useEffect(() => {
    const root = panelRef.current
    const el = sentinelRef.current
    if (!root || !el) return
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { root })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const trapFocus = (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.key !== 'Tab' || !panelRef.current) return
    // Le contenu de la fiche reste monté (caché) pendant la lecture d'une actu : on ne garde que ce qui est visible.
    const items = [...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, [tabindex]:not([tabindex="-1"])')].filter(
      (el) => el.checkVisibility?.() ?? true
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
  const playing = friends.filter((f) => f.status === 'in-game' && f.game && norm(f.game) === norm(game.name))
  // Discord : membres en ligne d'un serveur, jamais des amis.
  const pals = playing.filter((f) => f.platform !== 'discord')
  const members = playing.filter((f) => f.platform === 'discord')
  const toggleFavorite = (): void => {
    if (!game.favorite) setPop((n) => n + 1)
    onFavorite(game)
  }

  return (
    <div className={`sheet-root ${morph ? 'is-morph' : ''} ${closing ? 'is-closing' : ''}`} inert={closing}>
      <div className="sheet-scrim" onClick={onScrimClick} aria-hidden="true" />
      <aside ref={panelRef} className={`sheet-panel ${reading ? (reading === ACH_VIEW ? 'is-ach' : 'is-reading') : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={trapFocus}>
        <header className="sheet-art">
          <Cover key={game.id} game={game} variant="landscape" showTitle={false} />
          <div className="sheet-art-shade" />
          <button className="icon-btn sheet-close" onClick={onClose} aria-label="Fermer" title="Fermer (Échap)">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="sheet-head">
          <div ref={posterRef} className="sheet-poster">
            <Cover key={`p-${game.id}`} game={game} variant="portrait" showTitle={false} />
          </div>
          <div className="sheet-heading">
            <span className="sheet-tags">
              <StoreTag kind={game.store} long />
              {game.running && <LiveBadge />}
              {game.notInstalled && <span className="sheet-uninstalled">Pas installé</span>}
            </span>
            <h2 id={titleId} className="sheet-title">
              {title}
            </h2>
          </div>
        </div>

        <div ref={sentinelRef} className="sheet-sentinel" />
        <div className={`sheet-actions ${stuck ? 'is-stuck' : ''}`}>
          {game.notInstalled ? (
            // Pas installé sur ce PC : Steam s'occupe du téléchargement ; ni favori ni dossier tant que le jeu n'est pas là.
            <button className="btn btn-primary btn-play sheet-play" onClick={() => onInstall(game)} title="Installer avec Steam" data-magnetic>
              <Icon name="download" size={18} />
              Installer
            </button>
          ) : (
            <>
              <button
                ref={playRef}
                className={`btn btn-primary btn-play sheet-play ${p.className}`}
                onClick={() => p.activate(posterRef.current)}
                aria-disabled={p.inert || undefined}
                aria-busy={p.busy || undefined}
                aria-label={p.ariaLabel}
                title={p.state === 'idle' ? undefined : p.title}
                data-magnetic={p.state === 'idle' ? '' : undefined}
              >
                <PlayLabel p={p} size={18} />
              </button>
              <button
                className={`btn btn-secondary sheet-square ${game.favorite ? 'is-fav' : ''}`}
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
                className="btn btn-secondary sheet-square"
                onClick={() => onOpenFolder(game)}
                disabled={!game.installDir}
                aria-label="Ouvrir le dossier d'installation"
                title={game.installDir ? "Ouvrir le dossier d'installation" : "Dossier d'installation inconnu"}
              >
                <Icon name="folder" size={20} />
              </button>
            </>
          )}
        </div>

        {!game.notInstalled && <LaunchLine game={game} p={p} playRef={playRef} onLaunch={onLaunch} onRescan={onRescan} />}

        <div className="sheet-stats">
          {game.lastPlayed ? (
            <StatTile label="Dernier lancement" value={capitalize(timeAgo(game.lastPlayed))} caption={formatDate(game.lastPlayed)} />
          ) : (
            <StatTile label="Dernier lancement" value="Jamais" caption={game.notInstalled ? 'selon Steam' : 'depuis Player X'} />
          )}
          {game.notInstalled ? (
            <StatTile label="Sur ce PC" value="Pas installé" caption="via Steam" />
          ) : (
            <StatTile label="Lancements" value={String(game.launches ?? 0)} caption="depuis Player X" />
          )}
          <StatTile
            label="Temps de jeu"
            value={game.playtime ? formatPlaytime(game.playtime) : '0 min'}
            countTo={game.playtime}
            caption={game.running ? 'Partie en cours' : game.playtimeSource === 'steam' || game.notInstalled ? 'selon Steam' : 'mesuré par Player X'}
            live={game.running}
          />
        </div>

        {isBf6Game(game) && <Bf6Link onOpen={onOpenStats} />}

        {patch && <NewsBanner patch={patch} onOpen={(opener) => openPost(patch.id, opener)} />}

        <section className="sheet-section">
          <h3 className="sheet-h">
            Amis sur ce jeu
            {pals.length > 0 && <span className="sheet-h-count num">{pals.length}</span>}
          </h3>
          {pals.length ? (
            <ul className="sheet-friends">
              {pals.map((f) => (
                <FriendRow key={f.id} friend={f} />
              ))}
            </ul>
          ) : (
            <p className="caption">Aucun ami n'y joue en ce moment.</p>
          )}
        </section>

        {members.length > 0 && (
          <section className="sheet-section">
            <h3 className="sheet-h">
              Membres du serveur Discord
              <span className="sheet-h-count num">{members.length}</span>
            </h3>
            <ul className="sheet-friends">
              {members.map((f) => (
                <FriendRow key={f.id} friend={f} />
              ))}
            </ul>
          </section>
        )}

        {game.store === 'steam' && <AchievementsSection state={achState} onOpenAll={(opener) => openPost(ACH_VIEW, opener)} onRetry={reloadAch} />}

        {news && (
          <NewsSection
            state={newsState}
            seenAt={newsState.status === 'ready' ? newsState.news.seenAt : 0}
            onRead={(post: NewsPost, opener) => openPost(post.id, opener)}
            onRetry={reloadNews}
            onSeen={markSeen}
          />
        )}

        <section className="sheet-section sheet-install">
          <h3 className="sheet-h">Installation</h3>
          <InstallPath game={game} onOpenFolder={onOpenFolder} />
        </section>
        {reading === ACH_VIEW && (
          <AchievementsView gameName={title} state={achState} backRef={readerBack} onBack={closeReader} onClose={onClose} onRetry={reloadAch} />
        )}
        {reading && reading !== ACH_VIEW && (
          <NewsReader
            gameName={title}
            state={newsState}
            postId={reading}
            backRef={readerBack}
            onBack={closeReader}
            onClose={onClose}
            onRetry={reloadNews}
          />
        )}
      </aside>
    </div>
  )
}

function StatTile(props: { label: string; value: string; caption?: string; countTo?: number; live?: boolean }): React.JSX.Element {
  const { label, value, caption, countTo, live } = props
  return (
    <div className="sheet-tile">
      <span className="sheet-tile-label">{label}</span>
      <span className="sheet-tile-value num" title={value}>
        {countTo ? <CountUp value={countTo} format={formatPlaytime} /> : value}
      </span>
      <span className={`sheet-tile-caption ${live ? 'is-live' : ''}`} title={caption}>
        {caption}
      </span>
    </div>
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

function FriendRow({ friend }: { friend: Friend }): React.JSX.Element {
  return (
    <li className="sheet-friend">
      <Avatar name={friend.name} url={friend.avatarUrl} size={32} status="in-game" />
      <span className="sheet-friend-text">
        <span className="sheet-friend-name">{friend.name}</span>
        <span className="sheet-friend-sub">{friend.device ? `En jeu · ${friend.device}` : 'En jeu'}</span>
      </span>
      <StoreTag kind={friend.platform} size={18} className="sheet-friend-pf" />
    </li>
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
 * Ligne sous « Jouer » (spec launch-sequence.md §3.3) : où en est le lancement, compteur compris. Pas une région
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
  const line = sheetLine(s, { name: cleanName(game.name), now: active ? Date.now() : now })
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
