import { useEffect, useRef } from 'react'
import { capitalize, timeAgo } from '@shared/text'
import type { Game, NewsPost } from '@shared/types'
import { Icon } from '../ui/Icon'
import { NewsThumb } from './NewsThumb'
import type { NewsState } from './useGameNews'
import './news.css'

const LIST_MAX = 5
/** Une actu plus ancienne n'est plus marquée « Nouveau », même jamais vue. */
const NEW_MS = 7 * 24 * 3600_000

export const steamNewsUrl = (appId: string): string => `https://store.steampowered.com/news/app/${appId}`

export type GameArt = Pick<Game, 'name' | 'coverUrl' | 'heroUrl'>

interface SectionProps {
  /** Image du jeu, pour les annonces qui n'en ont pas. */
  game: GameArt
  state: NewsState
  /** Les actus plus récentes que cette date (et de moins de 7 jours) sont marquées « Nouveau ». */
  seenAt: number
  onRead: (post: NewsPost, opener: HTMLElement) => void
  onRetry: () => void
  /** La liste vient d'apparaître à l'écran : les actus sont vues. */
  onSeen: () => void
}

/** Onglet « Actus » de la fiche : les dernières annonces officielles du jeu sur Steam. */
export function NewsSection({ game, state, seenAt, onRead, onRetry, onSeen }: SectionProps): React.JSX.Element {
  const ref = useRef<HTMLElement>(null)
  const seenRef = useRef(onSeen)
  seenRef.current = onSeen
  const news = state.status === 'ready' ? state.news : null
  const hasPosts = !!news?.posts.length

  useEffect(() => {
    const el = ref.current
    if (!el || !hasPosts) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        seenRef.current()
      },
      { threshold: 0.3 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasPosts])

  const now = Date.now()
  return (
    <section ref={ref} className="sheet-card news" aria-labelledby="news-h" aria-busy={state.status === 'loading'}>
      {/* L'onglet dit déjà « Actus » : le titre reste pour les lecteurs d'écran seulement. */}
      <h3 id="news-h" className="sr-only">
        Actus
      </h3>
      {state.status === 'loading' && <NewsSkeleton />}
      {state.status === 'error' && (
        <div className="news-error">
          <p className="caption">{state.message}</p>
          <button className="btn btn-secondary btn-sm" onClick={onRetry}>
            <Icon name="refresh" size={14} />
            Réessayer
          </button>
        </div>
      )}
      {news && !news.appId && <p className="caption">Pas d'actus : ce jeu est introuvable sur Steam.</p>}
      {news?.appId && !hasPosts && <p className="caption">Aucune annonce officielle pour le moment.</p>}
      {news?.appId && hasPosts && (
        <>
          <ul className="news-list">
            {news.posts.slice(0, LIST_MAX).map((post) => (
              <li key={post.id}>
                <NewsItem post={post} game={game} isNew={post.date > seenAt && now - post.date < NEW_MS} onRead={onRead} />
              </li>
            ))}
          </ul>
          <button className="btn btn-ghost btn-sm news-all" onClick={() => void window.launcher.openExternal(steamNewsUrl(news.appId!))}>
            Toutes les actus sur Steam
            <Icon name="external-link" size={14} />
          </button>
        </>
      )}
    </section>
  )
}

function NewsItem({ post, game, isNew, onRead }: { post: NewsPost; game: GameArt; isNew: boolean; onRead: SectionProps['onRead'] }): React.JSX.Element {
  const when = capitalize(timeAgo(post.date))
  return (
    <button
      className={`news-item ${isNew ? 'is-new' : ''}`}
      onClick={(e) => onRead(post, e.currentTarget)}
      aria-label={`${post.patch ? 'Patch : ' : ''}${post.title}, ${when.toLowerCase()}${isNew ? ', nouveau' : ''}`}
    >
      <NewsThumb game={game} image={post.image} patch={post.patch} />
      <span className="news-item-text" aria-hidden="true">
        <span className="news-meta">
          {post.patch && <span className="news-tag">Patch</span>}
          <span className="num">{when}</span>
          {isNew && <span className="news-new">Nouveau</span>}
        </span>
        <span className="news-item-title">{post.title}</span>
        {post.excerpt && <span className="news-excerpt">{post.excerpt}</span>}
      </span>
    </button>
  )
}

function NewsSkeleton(): React.JSX.Element {
  return (
    <div className="news-list" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="news-item news-skel">
          <span className="skel news-thumb" />
          <span className="news-item-text">
            <span className="skel" style={{ width: '30%', height: 10 }} />
            <span className="skel" style={{ width: '85%', height: 14 }} />
            <span className="skel" style={{ width: '65%', height: 10 }} />
          </span>
        </div>
      ))}
    </div>
  )
}
