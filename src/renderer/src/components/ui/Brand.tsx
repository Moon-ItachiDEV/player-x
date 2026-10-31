import mark from '../../assets/px-icon.svg'
import markSmall from '../../assets/px-icon-petit.svg'
import markTiny from '../../assets/px-icon-16.svg'

/** En dessous, l'icône prend sa version simplifiée, dessinée pour 24 à 40 px (tuile, console, P et X, sans reflets fins). */
const MARK_SMALL_MAX = 40
/** En dessous, la version calée au pixel pour 16 à 22 px. */
const MARK_TINY_MAX = 22

/**
 * Icône de Player X : une console portable en verre blanc sur une tuile rose braise, ton sur ton, avec le P (son creux
 * est un triangle Play) et le X. `alt=""` quand le nom « Player X » est juste à côté : il n'est pas lu deux fois.
 */
export function BrandMark({ height = 24, className = '', alt = 'Player X' }: { height?: number; className?: string; alt?: string }): React.JSX.Element {
  const src = height <= MARK_TINY_MAX ? markTiny : height <= MARK_SMALL_MAX ? markSmall : mark
  return <img className={`brand-mark ${className}`} src={src} alt={alt} style={{ height }} draggable={false} />
}

/** Le nom « Player X » en Sora, à côté de l'icône. `height` est la hauteur de la ligne, comme pour l'ancien logo dessiné. */
export function BrandWordmark({ height = 23, className = '' }: { height?: number; className?: string }): React.JSX.Element {
  return (
    <span className={`brand-wordmark ${className}`} style={{ fontSize: Math.round(height * 0.82), lineHeight: `${height}px` }}>
      Player X
    </span>
  )
}

export const APP_NAME = 'Player X'
