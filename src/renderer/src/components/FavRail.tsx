import { useMemo, useRef, useState } from 'react'
import { cleanName } from '@shared/text'
import type { Game } from '@shared/types'
import type { FavRailProps } from '../contracts'
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
export function FavRail({ games, launchingId, onLaunch, onOpen, onEditFavorites }: FavRailProps): React.JSX.Element {
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
        {favs.map((g) => {
          const name = cleanName(g.name)
          const launching = launchingId === g.id
          return (
            <button
              key={g.id}
              className={`favrail-item ${g.running ? 'is-live' : ''} ${launching ? 'is-launching' : ''}`}
              aria-label={`Jouer à ${name}${g.running ? ', en jeu' : ''}`}
              aria-describedby={tip?.game.id === g.id ? 'favrail-tip' : undefined}
              aria-busy={launching || undefined}
              onClick={() => !launching && onLaunch(g)}
              onContextMenu={(e) => {
                e.preventDefault()
                hide()
                onOpen(g)
              }}
              onPointerEnter={(e) => show(g, e.currentTarget)}
              onPointerLeave={hide}
              onFocus={(e) => e.currentTarget.matches(':focus-visible') && show(g, e.currentTarget)}
              onBlur={hide}
            >
              <span className="favrail-art">
                <Cover game={g} variant="letter" />
              </span>
              {launching && (
                <span className="favrail-busy" aria-hidden="true">
                  <span className="spinner" />
                </span>
              )}
              {g.running && <span className="favrail-dot fx-loop" aria-hidden="true" />}
            </button>
          )
        })}
        <button className="favrail-item favrail-add" aria-label="Choisir mes favoris" title="Choisir mes favoris" onClick={onEditFavorites}>
          <Icon name="plus" size={18} />
        </button>
      </div>

      {tip && tipGame && (
        <div id="favrail-tip" className="favrail-tip" role="tooltip" style={{ top: tip.top }}>
          <span className="favrail-tip-name">{cleanName(tipGame.name)}</span>
          <span className="favrail-tip-hint">{tipGame.running ? 'En jeu · ' : ''}Clic : jouer · clic droit : fiche</span>
        </div>
      )}
    </nav>
  )
}
