import { useMemo, useRef, useState } from 'react'
import { cleanName } from '@shared/text'
import type { Game } from '@shared/types'
import type { FavRailProps, LaunchFn } from '../contracts'
import { railHint } from '../launch/copy'
import { usePlayState } from '../launch/usePlayState'
import { BrandMark } from './ui/Brand'
import { Cover } from './ui/Cover'
import { Icon } from './ui/Icon'
import './chrome.css'

export type { FavRailProps }

// Sur macOS, les feux de fenêtre occupent le coin haut gauche.
const IS_MAC = window.launcher?.platform === 'darwin'
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

interface Tip {
  game: Game
  top: number
}

/** Rail des jeux favoris : un clic lance le jeu, un clic droit ouvre sa fiche. Ordre alphabétique, stable. */
export function FavRail({ games, onLaunch, onOpen, onEditFavorites }: FavRailProps): React.JSX.Element {
  const favs = useMemo(() => games.filter((g) => g.favorite).sort((a, b) => collator.compare(cleanName(a.name), cleanName(b.name))), [games])
  const [tip, setTip] = useState<Tip | null>(null)
  const list = useRef<HTMLDivElement>(null)

  const show = (game: Game, el: HTMLElement): void => {
    const r = el.getBoundingClientRect()
    setTip({ game, top: r.top + r.height / 2 })
  }
  const hide = (): void => setTip(null)

  // L'infobulle suit la position du bouton : on la retire dès que la liste défile.
  const tipGame = tip ? favs.find((g) => g.id === tip.game.id) : undefined

  return (
    <nav className="favrail" aria-label="Jeux favoris">
      <div className="favrail-logo">{!IS_MAC && <BrandMark height={15} />}</div>
      <div ref={list} className="favrail-list" onScroll={hide}>
        {favs.map((g) => (
          <RailItem
            key={g.id}
            game={g}
            described={tip?.game.id === g.id}
            onLaunch={onLaunch}
            onOpen={(game) => {
              hide()
              onOpen(game)
            }}
            onShow={show}
            onHide={hide}
          />
        ))}
        <button className="favrail-item favrail-add" aria-label="Choisir mes favoris" title="Choisir mes favoris" onClick={onEditFavorites}>
          <Icon name="plus" size={18} />
        </button>
      </div>

      {tip && tipGame && <RailTip game={tipGame} top={tip.top} onLaunch={onLaunch} />}
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

/** Un favori : le lancement s'y lit sans texte (anneau jaune immobile en attente, anneau cyan en jeu). */
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
