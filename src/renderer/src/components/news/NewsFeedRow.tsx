import { useMemo } from 'react'
import { capitalize, cleanName, timeAgo } from '@shared/text'
import type { Game, NewsFeedItem } from '@shared/types'
import { useRowScroll } from '../home/rowScroll'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { homeFeed } from './feedView'
import { useNewsFeed } from './useNewsFeed'
import './news.css'
import './feed.css'

interface Props {
  games: Game[]
  /** Actus des jeux activées (Paramètres › Bibliothèque). */
  enabled: boolean
  demo: boolean
  onRead: (gameId: string, postId: string) => void
  onShowAll: () => void
}

/**
 * Accueil, sous « À reprendre » : les derniers patchs publiés sur Steam pour tes jeux. Rien tant que le relevé n'a pas de
 * patch récent (pas de squelette : le premier relevé peut prendre une minute).
 */
export function NewsFeedRow({ games, enabled, demo, onRead, onShowAll }: Props): React.JSX.Element | null {
  const { state } = useNewsFeed(enabled, demo)
  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games])
  const items = useMemo(
    () => (state.status === 'ready' ? homeFeed(state.feed.items.filter((i) => byId.has(i.gameId)), Date.now()) : []),
    [state, byId]
  )
  // Coupées : rien, même si le dernier relevé est encore en mémoire.
  if (!enabled || !items.length) return null
  return <FeedRow items={items} games={byId} onRead={onRead} onShowAll={onShowAll} />
}

interface RowProps {
  items: NewsFeedItem[]
  games: Map<string, Game>
  onRead: Props['onRead']
  onShowAll: () => void
}

function FeedRow({ items, games, onRead, onShowAll }: RowProps): React.JSX.Element {
  const { track, edges, scrollBy } = useRowScroll(items.length)
  return (
    <section className="hr nf-row" aria-labelledby="nf-row-title">
      <header className="hr-head">
        <div className="hr-titles">
          <h2 id="nf-row-title" className="h-section">
            Mises à jour de tes jeux
          </h2>
          <p className="hr-sub">Les derniers patchs publiés sur Steam</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onShowAll}>
          Tout voir
          <Icon name="chevron-right" size={14} />
        </button>
        {/* « À reprendre » a déjà ses « Précédent » / « Suivant » sur la page : noms distincts pour les lecteurs d'écran. */}
        <button className="btn btn-secondary btn-sm hr-nav" aria-label="Patchs précédents" title="Précédent" disabled={!edges.start} onClick={() => scrollBy(-1)}>
          <Icon name="chevron-left" size={16} />
        </button>
        <button className="btn btn-secondary btn-sm hr-nav" aria-label="Patchs suivants" title="Suivant" disabled={!edges.end} onClick={() => scrollBy(1)}>
          <Icon name="chevron-right" size={16} />
        </button>
      </header>
      <div ref={track} className="hr-track nf-track">
        {items.map((item) => (
          <FeedCard key={`${item.gameId}:${item.id}`} item={item} game={games.get(item.gameId)!} onRead={onRead} />
        ))}
      </div>
    </section>
  )
}

function FeedCard({ item, game, onRead }: { item: NewsFeedItem; game: Game; onRead: Props['onRead'] }): React.JSX.Element {
  const name = cleanName(item.gameName)
  const when = capitalize(timeAgo(item.date))
  return (
    <button
      className={`nf-card ${item.isNew ? 'is-new' : ''}`}
      aria-label={`Patch de ${name} : ${item.title}, ${when.toLowerCase()}${item.isNew ? ', nouveau' : ''}`}
      title={item.title}
      onClick={() => onRead(item.gameId, item.id)}
    >
      <span className="nf-art" aria-hidden="true">
        <Cover game={game} variant="landscape" showTitle={false} />
        <span className="news-tag nf-tag">Patch</span>
        {item.isNew && (
          <span className="news-badge nf-new">
            <span className="news-badge-dot" />
            Nouveau
          </span>
        )}
      </span>
      <span className="nf-body" aria-hidden="true">
        <span className="nf-game">{name}</span>
        <span className="nf-title">{item.title}</span>
        <span className="nf-when num">{when}</span>
      </span>
    </button>
  )
}
