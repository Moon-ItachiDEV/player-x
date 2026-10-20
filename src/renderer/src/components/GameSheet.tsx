import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { capitalize, cleanName, formatDate, formatPlaytime, norm, timeAgo } from '@shared/text'
import type { Friend, Game } from '@shared/types'
import { isBf6Game, useBf6Summary } from './stats/bf6'
import type { GameSheetProps } from '../contracts'
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

function Sheet({ game, friends, launching, closing, onClose, onLaunch, onFavorite, onOpenFolder, onOpenStats }: SheetProps): React.JSX.Element {
  const panelRef = useRef<HTMLElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  const [pop, setPop] = useState(0)
  const openedAt = useRef(0)
  // Ouverte par une transition de vue : pas de glissement CSS en plus (la classe reste pour cette ouverture).
  const [morph] = useState(() => document.documentElement.classList.contains('vt-open'))

  useEscape(!closing, onClose)

  useEffect(() => {
    if (!closing) openedAt.current = performance.now()
  }, [closing, game.id])

  // Double-clic lent sur une jaquette : le 2e clic tombe sur le voile. On lance le jeu au lieu de refermer.
  // Ouverte autrement (« Détails », vignette), un double-clic est seulement ignoré.
  const onScrimClick = (e: React.MouseEvent): void => {
    const justOpened = performance.now() - openedAt.current < DBL_CLICK_MS
    if (justOpened && e.detail === 2 && !launching && openedByCard(DBL_CLICK_MS)) onLaunch(game)
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
    const items = [...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, [tabindex]:not([tabindex="-1"])')]
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
      <aside ref={panelRef} className="sheet-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={trapFocus}>
        <header className="sheet-art">
          <Cover key={game.id} game={game} variant="landscape" showTitle={false} />
          <div className="sheet-art-shade" />
          <button className="icon-btn sheet-close" onClick={onClose} aria-label="Fermer" title="Fermer (Échap)">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="sheet-head">
          <div className="sheet-poster">
            <Cover key={`p-${game.id}`} game={game} variant="portrait" showTitle={false} />
          </div>
          <div className="sheet-heading">
            <span className="sheet-tags">
              <StoreTag kind={game.store} long />
              {game.running && <LiveBadge />}
            </span>
            <h2 id={titleId} className="sheet-title">
              {title}
            </h2>
          </div>
        </div>

        <div ref={sentinelRef} className="sheet-sentinel" />
        <div className={`sheet-actions ${stuck ? 'is-stuck' : ''}`}>
          <button
            className={`btn btn-primary btn-play sheet-play ${launching ? 'is-launching' : ''}`}
            onClick={() => onLaunch(game)}
            disabled={launching}
            data-magnetic
          >
            {launching ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Lancement…
              </>
            ) : (
              <>
                <Icon name="play" size={18} />
                Jouer
              </>
            )}
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
        </div>

        <div className="sheet-stats">
          {game.lastPlayed ? (
            <StatTile label="Dernier lancement" value={capitalize(timeAgo(game.lastPlayed))} caption={formatDate(game.lastPlayed)} />
          ) : (
            <StatTile label="Dernier lancement" value="Jamais" caption="depuis Player X" />
          )}
          <StatTile label="Lancements" value={String(game.launches ?? 0)} caption="depuis Player X" />
          <StatTile
            label="Temps de jeu"
            value={game.playtime ? formatPlaytime(game.playtime) : '0 min'}
            countTo={game.playtime}
            caption={game.running ? 'Partie en cours' : game.playtimeSource === 'steam' ? 'selon Steam' : 'mesuré par Player X'}
            live={game.running}
          />
        </div>

        {isBf6Game(game) && <Bf6Link onOpen={onOpenStats} />}

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

        <section className="sheet-section sheet-install">
          <h3 className="sheet-h">Installation</h3>
          <InstallPath game={game} onOpenFolder={onOpenFolder} />
        </section>
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
