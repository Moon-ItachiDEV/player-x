import { useState } from 'react'
import type { Game } from '@shared/types'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import './news.css'

interface Props {
  /** Pour l'image du jeu quand l'annonce n'en a pas. */
  game: Pick<Game, 'name' | 'coverUrl' | 'heroUrl'>
  /** Première image de l'annonce, s'il y en a une. */
  image?: string
  patch: boolean
  className?: string
}

/**
 * Vignette d'une annonce : son image, sinon (absente ou en échec) l'image du jeu (bannière, jaquette floutée ou dégradé
 * généré), avec la marque « patch » par-dessus pour que l'annonce se lise toujours comme un patch.
 */
export function NewsThumb({ game, image, patch, className = '' }: Props): React.JSX.Element {
  const [failed, setFailed] = useState<string | null>(null)
  const src = image && image !== failed ? image : undefined
  return (
    <span className={`news-thumb ${className}`} aria-hidden="true">
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(src)} />
      ) : (
        <>
          <Cover game={game} variant="landscape" showTitle={false} />
          {patch && (
            <span className="news-glyph">
              <Icon name="download" size={12} />
            </span>
          )}
        </>
      )}
    </span>
  )
}
