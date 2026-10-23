// Bas de l'accueil : « Mises à jour de tes jeux » (derniers patchs publiés sur Steam) et « Tes succès » (relevé Steam).
// Chaque partie est masquée sans données : actus coupées ou sans patch récent, pas de relevé de succès.
import { useMemo } from 'react'
import { capitalize, cleanName, formatDate, timeAgo } from '@shared/text'
import type { AchievementGame, Game, NewsFeedItem } from '@shared/types'
import { homeFeed } from '../news/feedView'
import { useNewsFeed } from '../news/useNewsFeed'
import { Cover } from '../ui/Cover'

/** Cartes d'actus sur l'accueil ; « Toutes les actus » mène au reste. */
const NEWS_MAX = 3

/** Derniers patchs des jeux de la bibliothèque, ou rien (actus coupées, pas encore de relevé, aucun patch récent). */
export function useHomeNews(games: Game[], enabled: boolean, demo: boolean): NewsFeedItem[] {
  const { state } = useNewsFeed(enabled, demo)
  const ids = useMemo(() => new Set(games.map((g) => g.id)), [games])
  return useMemo(
    () =>
      enabled && state.status === 'ready'
        ? homeFeed(
            state.feed.items.filter((i) => ids.has(i.gameId)),
            Date.now()
          ).slice(0, NEWS_MAX)
        : [],
    [enabled, state, ids]
  )
}

interface NewsProps {
  items: NewsFeedItem[]
  games: Game[]
  onRead: (gameId: string, postId: string) => void
  onShowAll: () => void
}

export function HomeNews({ items, games, onRead, onShowAll }: NewsProps): React.JSX.Element {
  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games])
  return (
    <section className="hm-news" aria-labelledby="hm-news-title">
      <header className="hm-sec-head">
        <h2 id="hm-news-title" className="hm-h2">
          Mises à jour de tes jeux
        </h2>
        <button className="hm-link" onClick={onShowAll}>
          Toutes les actus
        </button>
      </header>
      <div className="hm-news-grid">
        {items.map((item) => {
          const game = byId.get(item.gameId)
          const name = cleanName(item.gameName)
          const when = capitalize(timeAgo(item.date))
          return (
            <button
              key={`${item.gameId}:${item.id}`}
              className="hm-news-card"
              aria-label={`Patch de ${name} : ${item.title}, ${when.toLowerCase()}${item.isNew ? ', nouveau' : ''}`}
              title={item.title}
              onClick={() => onRead(item.gameId, item.id)}
            >
              <span className="hm-news-art" aria-hidden="true">
                <Cover game={game ?? { name: item.gameName }} variant="landscape" showTitle={false} />
                {item.isNew && (
                  <span className="news-badge hm-news-new">
                    <span className="news-badge-dot" />
                    Nouveau
                  </span>
                )}
              </span>
              <span className="hm-news-body" aria-hidden="true">
                <span className="hm-news-game">{name}</span>
                <span className="hm-news-title">{item.title}</span>
                <span className="hm-news-when num" title={formatDate(item.date)}>
                  {when}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

const pct = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  maximumFractionDigits: 0
})

export function HomeAchievements({ rows, onShowTrophies }: { rows: AchievementGame[]; onShowTrophies: () => void }): React.JSX.Element {
  return (
    <section className="hm-ach" aria-labelledby="hm-ach-title">
      <header className="hm-sec-head">
        <h2 id="hm-ach-title" className="hm-h2">
          Tes succès
        </h2>
        <button className="hm-link" onClick={onShowTrophies}>
          Trophées
        </button>
      </header>
      <ul className="hm-panel hm-ach-list">
        {rows.map((a) => {
          const ratio = a.unlocked / a.total
          return (
            <li key={a.gameId} className="hm-ach-row" title={a.lastAt ? `Dernier succès débloqué le ${formatDate(a.lastAt)}` : undefined}>
              <span className="hm-ach-line">
                <span className="hm-ach-name">{cleanName(a.name)}</span>
                <span className="num">
                  {a.unlocked} / {a.total}
                </span>
              </span>
              <span
                className="hm-ach-bar"
                role="progressbar"
                aria-label={`Succès de ${cleanName(a.name)}`}
                aria-valuemin={0}
                aria-valuemax={a.total}
                aria-valuenow={a.unlocked}
                aria-valuetext={`${a.unlocked} sur ${a.total}, ${pct.format(ratio)}`}
              >
                <span className="hm-ach-fill" style={{ width: `${Math.max(2, ratio * 100)}%` }} />
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
