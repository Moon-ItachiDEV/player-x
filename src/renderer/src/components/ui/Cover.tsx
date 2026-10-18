import { useState } from 'react'
import { hue, cleanName } from '@shared/text'
import type { Game } from '@shared/types'
import './cover.css'

export type CoverVariant = 'portrait' | 'landscape' | 'letter' | 'banner'

interface Props {
  game: Pick<Game, 'name' | 'coverUrl' | 'heroUrl'>
  /**
   * portrait : jaquette 2:3 (coverUrl) · landscape : 16:9 (heroUrl, sinon coverUrl floutée)
   * letter : petite vignette avec l'initiale · banner : dégradé seul (fond de bannière)
   */
  variant?: CoverVariant
  className?: string
  /** Affiche le titre sur la jaquette générée (par défaut oui pour portrait/landscape). */
  showTitle?: boolean
}

/** Dégradé généré, stable pour un nom donné. */
export function generatedBackground(name: string): string {
  const h = hue(name)
  return `radial-gradient(120% 70% at 100% 0%, hsl(${h} 60% 45% / .35), transparent 60%), linear-gradient(165deg, hsl(${h} 42% 26%) 0%, hsl(${(h + 35) % 360} 48% 11%) 100%)`
}

/**
 * Image de jeu avec repli : si l'URL manque ou échoue (hors ligne, 404), on affiche le dégradé généré.
 * Le conteneur prend la taille que lui donne le parent (largeur 100 %, ratio selon la variante).
 */
export function Cover({ game, variant = 'portrait', className = '', showTitle }: Props): React.JSX.Element {
  const primary = variant === 'landscape' ? game.heroUrl : variant === 'banner' ? undefined : game.coverUrl
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set())
  const fail = (u: string): void => setFailed((prev) => new Set(prev).add(u))
  const [loaded, setLoaded] = useState(false)
  const url = primary && !failed.has(primary) ? primary : undefined
  // En paysage sans bannière, la jaquette floutée fait un fond correct.
  const blurredCover = variant === 'landscape' && !url && game.coverUrl && !failed.has(game.coverUrl) ? game.coverUrl : undefined
  const title = showTitle ?? (variant === 'portrait' || variant === 'landscape')

  return (
    <div className={`cover cover-${variant} ${className}`} style={{ background: generatedBackground(game.name) }}>
      {url && (
        <img
          className={`cover-img ${loaded ? 'is-loaded' : ''}`}
          src={url}
          alt=""
          loading="lazy"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => fail(url)}
        />
      )}
      {blurredCover && (
        <img className="cover-img cover-blur is-loaded" src={blurredCover} alt="" loading="lazy" draggable={false} onError={() => fail(blurredCover)} />
      )}
      {!url && !blurredCover && variant === 'letter' && <span className="cover-glyph">{cleanName(game.name).charAt(0).toUpperCase()}</span>}
      {!url && !blurredCover && title && <span className="cover-title">{cleanName(game.name)}</span>}
    </div>
  )
}
