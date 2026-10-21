import { capitalize, timeAgo } from '@shared/text'
import type { Game } from '@shared/types'
import './news.css'

/** Pastille « Nouveau patch » : un patch publié sur Steam cette semaine, pas encore vu dans la fiche du jeu. */
export function NewsBadge({ patch, className = '' }: { patch: NonNullable<Game['newPatch']>; className?: string }): React.JSX.Element {
  return (
    <span className={`news-badge ${className}`} title={`${patch.title} · ${capitalize(timeAgo(patch.at))}`}>
      <span className="news-badge-dot" aria-hidden="true" />
      Nouveau patch
    </span>
  )
}
