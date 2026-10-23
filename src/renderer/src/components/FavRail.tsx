import { useMemo, useRef, useState } from 'react'
import { cleanName, plural } from '@shared/text'
import type { Game } from '@shared/types'
import type { FavRailProps, LaunchFn, View } from '../contracts'
import { railHint } from '../launch/copy'
import { usePlayState } from '../launch/usePlayState'
import { BrandMark } from './ui/Brand'
import { Cover } from './ui/Cover'
import { Icon, type IconName } from './ui/Icon'
import './chrome.css'

export type { FavRailProps }

// Sur macOS, les feux de fenêtre occupent le coin haut gauche.
const IS_MAC = window.launcher?.platform === 'darwin'
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

const NAV: { view: View; icon: IconName; label: string }[] = [
  { view: 'home', icon: 'home', label: 'Accueil' },
  { view: 'library', icon: 'grid', label: 'Bibliothèque' },
  { view: 'friends', icon: 'users', label: 'Amis' },
  { view: 'stats', icon: 'chart', label: 'Stats de jeu' },
  { view: 'trophies', icon: 'trophy', label: 'Trophées' },
  // Seulement avec les actus des jeux (Paramètres › Bibliothèque).
  { view: 'news', icon: 'news', label: 'Actus des jeux' },
  { view: 'profile', icon: 'user', label: 'Profil' }
]

/** Infobulle à droite du rail : un jeu favori (avec le rappel des clics) ou une page (avec son compteur). */
type Tip = { top: number } & ({ kind: 'game'; game: Game } | { kind: 'page'; label: string; hint?: string })

/**
 * Rail de gauche (design Braise) : le logo, les pages, puis les jeux favoris (un clic lance le jeu,
 * un clic droit ouvre sa fiche) et les paramètres en bas.
 */
export function FavRail(props: FavRailProps): React.JSX.Element {
  const { games, onLaunch, onOpen, onEditFavorites, view, onView, gamesCount, news, newsCount, friendsInGame } = props
  const favs = useMemo(() => games.filter((g) => g.favorite).sort((a, b) => collator.compare(cleanName(a.name), cleanName(b.name))), [games])
  const [tip, setTip] = useState<Tip | null>(null)
  const list = useRef<HTMLDivElement>(null)

  const place = (el: HTMLElement): number => {
    const r = el.getBoundingClientRect()
    return r.top + r.height / 2
  }
  const showGame = (game: Game, el: HTMLElement): void => setTip({ kind: 'game', game, top: place(el) })
  const showPage = (label: string, hint: string | undefined, el: HTMLElement): void => setTip({ kind: 'page', label, hint, top: place(el) })
  const hide = (): void => setTip(null)

  // L'infobulle suit la position du bouton : on la retire dès que la liste défile.
  const tipGame = tip?.kind === 'game' ? favs.find((g) => g.id === tip.game.id) : undefined

  /** Compteur d'une page : pastille sur l'icône et texte de l'infobulle. */
  const badge = (v: View): { count: number; hint: string; info?: boolean; live?: boolean } | null => {
    if (v === 'library' && gamesCount > 0) return { count: gamesCount, hint: plural(gamesCount, 'jeu', 'jeux') }
    if (v === 'news' && newsCount > 0) return { count: newsCount, hint: plural(newsCount, 'nouveau patch', 'nouveaux patchs'), info: true }
    if (v === 'friends' && friendsInGame > 0) return { count: friendsInGame, hint: `${friendsInGame} en jeu`, live: true }
    return null
  }

  const navButton = (v: View, icon: IconName, label: string): React.JSX.Element => {
    const b = badge(v)
    const hint = b?.hint
    return (
      <button
        key={v}
        className="rail-nav-btn"
        aria-label={b ? `${label}, ${hint}` : label}
        aria-current={view === v ? 'page' : undefined}
        onClick={() => {
          hide()
          onView(v)
        }}
        onPointerEnter={(e) => showPage(label, hint, e.currentTarget)}
        onPointerLeave={hide}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && showPage(label, hint, e.currentTarget)}
        onBlur={hide}
      >
        <Icon name={icon} size={22} />
        {b && v !== 'library' && <span className={`rail-badge num ${b.live ? 'is-live' : ''} ${b.info ? 'is-info' : ''}`}>{b.count > 99 ? '99+' : b.count}</span>}
      </button>
    )
  }

  return (
    <nav className="favrail" aria-label="Navigation">
      <div className="favrail-logo">{!IS_MAC && <BrandMark height={40} />}</div>

      <div className="rail-nav" role="group" aria-label="Pages">
        {NAV.filter((n) => n.view !== 'news' || news).map((n) => navButton(n.view, n.icon, n.label))}
      </div>

      <div className="rail-sep" aria-hidden="true" />
      <p className="rail-label" aria-hidden="true">
        Favoris
      </p>

      <div ref={list} className="favrail-list" role="group" aria-label="Jeux favoris" onScroll={hide}>
        {favs.map((g) => (
          <RailItem
            key={g.id}
            game={g}
            described={tip?.kind === 'game' && tip.game.id === g.id}
            onLaunch={onLaunch}
            onOpen={(game) => {
              hide()
              onOpen(game)
            }}
            onShow={showGame}
            onHide={hide}
          />
        ))}
        <button className="favrail-item favrail-add" aria-label="Choisir mes favoris" title="Choisir mes favoris" onClick={onEditFavorites}>
          <Icon name="plus" size={18} />
        </button>
      </div>

      <div className="rail-foot">{navButton('settings', 'settings', 'Paramètres')}</div>

      {tip?.kind === 'game' && tipGame && <RailTip game={tipGame} top={tip.top} onLaunch={onLaunch} />}
      {tip?.kind === 'page' && (
        <div className="favrail-tip" role="tooltip" style={{ top: tip.top }}>
          <span className="favrail-tip-name">{tip.label}</span>
          {tip.hint && <span className="favrail-tip-hint">{tip.hint}</span>}
        </div>
      )}
    </nav>
  )
}

interface RailItemProps {
  game: Game
  described: boolean
  onLaunch: LaunchFn
  onOpen: (g: Game) => void
  onShow: (g: Game, el: HTMLElement) => void
  onHide: () => void
}

/** Un favori : le lancement s'y lit sans texte (anneau rose immobile en attente, anneau cyan en jeu). */
function RailItem({ game: g, described, onLaunch, onOpen, onShow, onHide }: RailItemProps): React.JSX.Element {
  const art = useRef<HTMLSpanElement>(null)
  const p = usePlayState(g, onLaunch)
  const name = cleanName(g.name)
  const live = p.state === 'running'
  const sending = p.state === 'sending' || p.state === 'checking'
  const pending = p.state === 'pending'
  const label = live ? `${name}, en jeu` : pending ? `${name}, en attente` : sending ? p.ariaLabel : `Jouer à ${name}`
  return (
    <button
      className={`favrail-item ${live ? 'is-live' : ''} ${pending ? 'is-pending' : ''} ${sending ? 'is-launching' : ''}`}
      aria-label={label}
      aria-describedby={described ? 'favrail-tip' : undefined}
      aria-disabled={p.inert || undefined}
      aria-busy={p.busy || undefined}
      onClick={() => p.activate(art.current)}
      onContextMenu={(e) => {
        e.preventDefault()
        onOpen(g)
      }}
      onPointerEnter={(e) => onShow(g, e.currentTarget)}
      onPointerLeave={onHide}
      onFocus={(e) => e.currentTarget.matches(':focus-visible') && onShow(g, e.currentTarget)}
      onBlur={onHide}
    >
      <span ref={art} className="favrail-art">
        <Cover game={g} variant="letter" />
      </span>
      {sending && (
        <span className="favrail-busy" aria-hidden="true">
          <span className="spinner launch-spin" />
        </span>
      )}
      {live && <span className="favrail-dot fx-loop" aria-hidden="true" />}
    </button>
  )
}

function RailTip({ game, top, onLaunch }: { game: Game; top: number; onLaunch: LaunchFn }): React.JSX.Element {
  const p = usePlayState(game, onLaunch)
  return (
    <div id="favrail-tip" className="favrail-tip" role="tooltip" style={{ top }}>
      <span className="favrail-tip-name">{cleanName(game.name)}</span>
      <span className="favrail-tip-hint">{railHint(p.state)}</span>
    </div>
  )
}
