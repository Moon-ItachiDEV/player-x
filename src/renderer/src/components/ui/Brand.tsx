import mark from '../../assets/px-icon.svg'
import markSmall from '../../assets/px-icon-petit.svg'
import logo from '../../assets/px-logo.svg'
import logoSmall from '../../assets/px-logo-petit.svg'

/** En dessous, l'icône prend sa version simplifiée, dessinée pour 24 à 32 px (sans reflets fins ni flèches). */
const MARK_SMALL_MAX = 40
/** En dessous, le logo prend sa version simplifiée (croix pleine, lettres un peu plus grasses), lisible à 23 px de haut. */
const LOGO_SMALL_MAX = 30

/**
 * Icône de Player X : la croix directionnelle tournée de 45° (le X), en matière braise avec ses flèches en verre, sur
 * une tuile claire. `alt=""` quand le logo est juste à côté : le nom n'est pas lu deux fois.
 */
export function BrandMark({ height = 24, className = '', alt = 'Player X' }: { height?: number; className?: string; alt?: string }): React.JSX.Element {
  return (
    <img
      className={`brand-mark ${className}`}
      src={height <= MARK_SMALL_MAX ? markSmall : mark}
      alt={alt}
      style={{ height }}
      draggable={false}
    />
  )
}

/** Logo « Player X » : « Player » en Sora et la croix de l'icône, en verre braise, à la place du X. */
export function BrandWordmark({ height = 23, className = '' }: { height?: number; className?: string }): React.JSX.Element {
  return (
    <img
      className={`brand-wordmark ${className}`}
      src={height <= LOGO_SMALL_MAX ? logoSmall : logo}
      alt="Player X"
      style={{ height }}
      draggable={false}
    />
  )
}

export const APP_NAME = 'Player X'
