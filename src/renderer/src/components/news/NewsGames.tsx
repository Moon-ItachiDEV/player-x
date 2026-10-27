import { useEffect, useRef } from 'react'
import { capitalize, cleanName, timeAgo } from '@shared/text'
import type { Game, NewsFeedItem } from '@shared/types'
import { setArtFocus } from '../../motion'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { GAME_LINES, ofGame, shortTitle, type ListGroup } from './feedView'

interface Props {
  groups: ListGroup[]
  games: Map<string, Game>
  now: number
  /** Vue « Patchs » : tout est un patch, la mention « Patch » des lignes ne dit rien de plus. */
  patchesOnly: boolean
  /** Vue d'un jeu : sa tuile seule, toutes ses annonces, jaquette non cliquable. */
  single: boolean
  onRead: (gameId: string, postId: string) => void
  /** Choisir un jeu (sa jaquette, « Voir les N patchs ») : la page ne montre plus que lui. */
  onPick: (gameId: string) => void
}

/**
 * « Tes jeux » : chaque jeu une seule fois (sa jaquette, son nom), ses dernières annonces dessous, les plus récentes
 * d'abord. Les jeux sont rangés par leur plus récente annonce ; celle qui est à la une n'est pas reprise.
 */
export function NewsGames({ groups, games, now, patchesOnly, single, onRead, onPick }: Props): React.JSX.Element {
  return (
    <ul className={`nf-games ${single ? 'is-single' : ''}`}>
      {groups.map((g) => (
        <li key={g.gameId}>
          <GameTile group={g} game={games.get(g.gameId)} now={now} patchesOnly={patchesOnly} single={single} onRead={onRead} onPick={onPick} />
        </li>
      ))}
    </ul>
  )
}

interface TileProps {
  group: ListGroup
  game?: Game
  now: number
  patchesOnly: boolean
  single: boolean
  onRead: (gameId: string, postId: string) => void
  onPick: (gameId: string) => void
}

function GameTile({ group, game, now, patchesOnly, single, onRead, onPick }: TileProps): React.JSX.Element {
  const name = cleanName(group.gameName)
  // Vue d'un jeu : toutes ses annonces ; sinon les GAME_LINES plus récentes, puis « Voir les N » (la une comprise).
  const lines = single ? group.items : group.items.slice(0, GAME_LINES)
  const more = !single && group.items.length > GAME_LINES
  const kind = patchesOnly ? 'patchs' : 'actus'
  const headId = `nf-game-${group.gameId.replace(/[^\w-]/g, '_')}`
  // Sans titre sur la jaquette générée : le nom du jeu est écrit juste à côté.
  const art = <Cover key={group.gameId} game={game ?? { name: group.gameName }} variant="portrait" showTitle={false} />
  const light = useAmbient(game?.heroUrl || game?.coverUrl)
  return (
    <article
      className="nf-game"
      aria-labelledby={headId}
      data-game={group.gameId}
      onPointerEnter={(e) => e.pointerType === 'mouse' && light(true)}
      onPointerLeave={() => light(false)}
      onFocus={(e) => e.target.matches(':focus-visible') && light(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && light(false)}
    >
      {single ? (
        <span className="nf-game-cover" aria-hidden="true">
          {art}
        </span>
      ) : (
        <button className="nf-game-cover" aria-label={`Voir seulement ${name}`} title={`Voir seulement ${name}`} onClick={() => onPick(group.gameId)}>
          {art}
        </button>
      )}
      <div className="nf-game-body">
        <h3 id={headId} className="nf-game-name">
          {name}
        </h3>
        <ul className="nf-lines">
          {lines.map((item) => (
            <li key={item.id}>
              <Line item={item} name={name} now={now} showKind={!patchesOnly} onRead={onRead} />
            </li>
          ))}
        </ul>
        {more && (
          <button className="nf-more" aria-label={`Voir les ${group.total} ${kind} ${ofGame(name)}`} onClick={() => onPick(group.gameId)}>
            Voir les {group.total} {kind}
            <Icon name="chevron-right" size={15} />
          </button>
        )}
      </div>
    </article>
  )
}

/**
 * Jeu survolé (ou atteint au clavier) : le fond de la page prend ses couleurs, comme dans la Bibliothèque (Ambient.tsx,
 * seulement avec les effets visuels ; le délai d'Ambient évite les éclairs quand le pointeur traverse la liste).
 */
function useAmbient(art: string | undefined): (on: boolean) => void {
  const lit = useRef(false)
  useEffect(
    () => () => {
      // Retiré de la page (filtre, autre vue) alors qu'il colorait le fond : on rend celui de l'écran du haut.
      if (lit.current) setArtFocus(null)
    },
    []
  )
  return (on: boolean): void => {
    if (lit.current === on) return
    lit.current = on
    setArtFocus(on ? art : null)
  }
}

interface LineProps {
  item: NewsFeedItem
  /** Nom du jeu, déjà nettoyé. */
  name: string
  now: number
  /** « Patch » à côté de la date (vue « Toutes les actus »). */
  showKind: boolean
  onRead: (gameId: string, postId: string) => void
}

/** Une annonce : point « pas encore lue », titre sans le nom du jeu, « Patch », date. Ouvre l'annonce dans la fiche du jeu. */
function Line({ item, name, now, showKind, onRead }: LineProps): React.JSX.Element {
  const when = capitalize(timeAgo(item.date, Math.max(now, item.date)))
  return (
    <button
      className={`nf-item ${item.isNew ? 'is-new' : ''}`}
      aria-label={`${item.patch ? 'Patch' : 'Actu'} ${ofGame(name)} : ${item.title}, ${when.toLowerCase()}${item.isNew ? ', nouveau' : ''}`}
      title={item.title}
      onClick={() => onRead(item.gameId, item.id)}
    >
      <span className="nf-item-dot" aria-hidden="true" />
      <span className="nf-item-title" aria-hidden="true">
        {shortTitle(item.title, item.gameName)}
      </span>
      {showKind && item.patch && (
        <span className="nf-item-kind" aria-hidden="true">
          Patch
        </span>
      )}
      <span className="nf-item-when num" aria-hidden="true">
        {when}
      </span>
      <Icon name="chevron-right" size={16} className="nf-item-go" />
    </button>
  )
}

/** Premier relevé : trois jeux à leur place (jaquette, nom, 2, 1 et 2 lignes), comme la liste remplie. */
export function GamesSkeleton(): React.JSX.Element {
  return (
    <ul className="nf-games">
      {[2, 1, 2].map((count, i) => (
        <li key={i}>
          <div className="nf-game">
            <span className="skel nf-game-cover" />
            <div className="nf-game-body">
              <span className="skel nf-skel-name" />
              {Array.from({ length: count }, (_, j) => (
                <span key={j} className="skel nf-skel-line" style={{ width: j === 0 ? '78%' : '62%' }} />
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
