import { useState } from 'react'
import { formatDate } from '@shared/text'
import type { NewsBlock, NewsSpan } from '@shared/types'
import { Icon } from '../ui/Icon'
import type { NewsState } from './useGameNews'
import './news.css'

const open = (url: string): void => void window.launcher.openExternal(url)

interface ReaderProps {
  gameName: string
  state: NewsState
  postId: string
  backRef: React.RefObject<HTMLButtonElement | null>
  onBack: () => void
  onClose: () => void
  onRetry: () => void
}

/** Une annonce en entier, dans la fiche du jeu. Rendue en texte à partir des blocs lus par le processus principal. */
export function NewsReader({ gameName, state, postId, backRef, onBack, onClose, onRetry }: ReaderProps): React.JSX.Element {
  const post = state.status === 'ready' ? state.news.posts.find((p) => p.id === postId) : undefined
  return (
    <div className="news-reader">
      <div className="news-bar">
        <button ref={backRef} className="btn btn-ghost btn-sm news-back" onClick={onBack} title="Retour à la fiche (Échap)">
          <Icon name="chevron-left" size={16} />
          Retour
        </button>
        <span className="news-bar-game">{gameName}</span>
        {post && (
          <button className="icon-btn" onClick={() => open(post.url)} aria-label="Ouvrir sur Steam" title="Ouvrir sur Steam">
            <Icon name="external-link" size={18} />
          </button>
        )}
        <button className="icon-btn" onClick={onClose} aria-label="Fermer la fiche" title="Fermer la fiche">
          <Icon name="x" size={18} />
        </button>
      </div>

      {state.status === 'loading' && <ReaderSkeleton />}
      {state.status === 'error' && (
        <div className="news-article news-error">
          <p className="caption">{state.message}</p>
          <button className="btn btn-secondary btn-sm" onClick={onRetry}>
            <Icon name="refresh" size={14} />
            Réessayer
          </button>
        </div>
      )}
      {state.status === 'ready' && !post && (
        <div className="news-article">
          <p className="caption">Cette annonce n'est plus disponible sur Steam.</p>
        </div>
      )}
      {post && (
        <article className="news-article" aria-labelledby="news-article-title">
          <p className="news-article-meta">
            {post.patch && <span className="news-tag">Patch</span>}
            <span>{formatDate(post.date)}</span>
            {post.author && <span>· {post.author}</span>}
          </p>
          <h2 id="news-article-title" className="news-article-title">
            {post.title}
          </h2>
          <div className="news-body">
            {post.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
            {!post.blocks.length && <p className="caption">Cette annonce n'a pas de texte : ouvre-la sur Steam pour la voir en entier.</p>}
          </div>
          <footer className="news-article-foot">
            <button className="btn btn-secondary" onClick={() => open(post.url)}>
              Lire sur Steam
              <Icon name="external-link" size={16} />
            </button>
            <span className="caption">Annonce publiée par l'éditeur sur Steam, dans sa langue d'origine.</span>
          </footer>
        </article>
      )}
    </div>
  )
}

function Block({ block }: { block: NewsBlock }): React.JSX.Element | null {
  switch (block.type) {
    case 'heading': {
      const Tag = (['h3', 'h4', 'h5'] as const)[block.level - 1]
      return (
        <Tag className={`news-h news-h${block.level}`}>
          <Spans spans={block.spans} />
        </Tag>
      )
    }
    case 'paragraph':
      return (
        <p>
          <Spans spans={block.spans} />
        </p>
      )
    case 'quote':
      return (
        <blockquote>
          <Spans spans={block.spans} />
        </blockquote>
      )
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul'
      let n = 0
      return (
        <List className="news-list-block">
          {block.items.map((item, i) => (
            <li key={i} style={{ '--d': item.depth } as React.CSSProperties} data-n={block.ordered && item.depth === 0 ? `${++n}.` : undefined}>
              <Spans spans={item.spans} />
            </li>
          ))}
        </List>
      )
    }
    case 'image':
      return <NewsImage src={block.src} />
    case 'video':
      return (
        <button className="news-video" onClick={() => open(block.url)}>
          <span className="news-video-icon">
            <Icon name="play" size={14} />
          </span>
          Voir la vidéo sur YouTube
          <Icon name="external-link" size={14} className="news-video-go" />
        </button>
      )
    case 'rule':
      return <hr />
  }
}

function Spans({ spans }: { spans: NewsSpan[] }): React.JSX.Element {
  return (
    <>
      {spans.map((s, i) => {
        let node: React.ReactNode = s.text
        if (s.strike) node = <s>{node}</s>
        if (s.underline) node = <u>{node}</u>
        if (s.italic) node = <em>{node}</em>
        if (s.bold) node = <strong>{node}</strong>
        if (s.href) {
          const href = s.href
          node = (
            <a
              href={href}
              title={href}
              onClick={(e) => {
                e.preventDefault()
                open(href)
              }}
            >
              {node}
            </a>
          )
        }
        return <span key={i}>{node}</span>
      })}
    </>
  )
}

function NewsImage({ src }: { src: string }): React.JSX.Element | null {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return <img className="news-img" src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(true)} />
}

function ReaderSkeleton(): React.JSX.Element {
  return (
    <div className="news-article" aria-busy="true">
      <span className="sr-only">Chargement de l'annonce…</span>
      <span className="skel" style={{ display: 'block', width: '35%', height: 12 }} />
      <span className="skel" style={{ display: 'block', width: '80%', height: 26, marginTop: 14 }} />
      <span className="skel" style={{ display: 'block', width: '100%', height: 180, marginTop: 20, borderRadius: 8 }} />
      {[92, 100, 76, 88].map((w, i) => (
        <span key={i} className="skel" style={{ display: 'block', width: `${w}%`, height: 12, marginTop: 12 }} />
      ))}
    </div>
  )
}
