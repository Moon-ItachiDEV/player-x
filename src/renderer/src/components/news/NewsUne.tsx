import { useState } from 'react'
import { capitalize, cleanName, timeAgo } from '@shared/text'
import type { Game, NewsFeedItem } from '@shared/types'
import { NewsThumb } from './NewsThumb'
import { useGameNews } from './useGameNews'

/** Annonces montrées dans « À la une » : la première en grand, toutes dans la colonne de droite. */
export const UNE_MAX = 4

const keyOf = (i: NewsFeedItem): string => `${i.gameId}:${i.id}`

interface Props {
  /** Les plus récentes de la vue choisie (au plus UNE_MAX). */
  items: NewsFeedItem[]
  games: Map<string, Game>
  now: number
  onRead: (gameId: string, postId: string) => void
}

/**
 * « À la une » de la page Actus des jeux : une annonce en grand (son image et le début de son texte, lus comme dans la fiche
 * du jeu ; sinon l'image du jeu), et à droite les plus récentes pour choisir celle qu'on met en avant.
 */
export function NewsUne({ items, games, now, onRead }: Props): React.JSX.Element {
  const [pick, setPick] = useState<string | null>(null)
  // L'annonce choisie a quitté la vue (filtre, nouveau relevé) : retour à la plus récente.
  const featured = items.find((i) => keyOf(i) === pick) ?? items[0]
  // Texte et image de l'annonce : le relevé n'a que les titres, la fiche du jeu a le reste (même lecture, même cache).
  const { state } = useGameNews(featured.gameId, true)
  const post = state.status === 'ready' ? state.news.posts.find((p) => p.id === featured.id) : undefined
  const game = games.get(featured.gameId) ?? { name: featured.gameName }
  const name = cleanName(featured.gameName)
  const when = capitalize(timeAgo(featured.date, Math.max(now, featured.date)))
  const source = post?.author ? `${post.author} sur Steam` : 'Steam'

  return (
    <section className="nf-une" aria-label="À la une">
      {/* key : l'image d'un autre jeu ne reste pas affichée le temps que la nouvelle arrive. */}
      <NewsThumb key={keyOf(featured)} game={game} image={post?.image} patch={false} className="nf-une-art" />
      <span className="nf-une-shade" aria-hidden="true" />
      <div className="nf-une-main">
        <div className="nf-une-card">
          <p className="nf-kicker">
            {name}
            {featured.patch && ' · Patch'}
            {featured.isNew && <span className="nf-kicker-new"> · Nouveau</span>}
          </p>
          <h2 className="nf-une-title">{featured.title}</h2>
          {post?.excerpt ? (
            <p className="nf-une-text">{post.excerpt}</p>
          ) : (
            state.status === 'loading' && (
              <span className="nf-une-text" aria-hidden="true">
                <span className="skel nf-une-skel" />
                <span className="skel nf-une-skel" />
              </span>
            )
          )}
          <div className="nf-une-foot">
            <span className="nf-une-meta">
              <span className="num">{when}</span> · {source}
            </span>
            <button className="nf-une-go" aria-label={`Lire l'actu : ${featured.title}`} title="Lire l'actu" onClick={() => onRead(featured.gameId, featured.id)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {items.length > 1 && (
        <ul className="nf-side" aria-label="Choisir l'actu à la une">
          {items.map((item) => {
            const on = item === featured
            const itemName = cleanName(item.gameName)
            const itemWhen = capitalize(timeAgo(item.date, Math.max(now, item.date)))
            return (
              <li key={keyOf(item)}>
                <button
                  className="nf-side-row"
                  aria-pressed={on}
                  aria-label={`${item.patch ? 'Patch' : 'Actu'} de ${itemName} : ${item.title}, ${itemWhen.toLowerCase()}${item.isNew ? ', nouveau' : ''}`}
                  onClick={() => setPick(keyOf(item))}
                >
                  <NewsThumb game={games.get(item.gameId) ?? { name: item.gameName }} patch={item.patch} className="nf-side-thumb" />
                  <span className="nf-side-text" aria-hidden="true">
                    <span className="nf-side-title">{item.title}</span>
                    <span className="nf-side-meta">
                      {itemName} · <span className="num">{itemWhen}</span>
                    </span>
                  </span>
                  {item.isNew && <span className="nf-side-new" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
