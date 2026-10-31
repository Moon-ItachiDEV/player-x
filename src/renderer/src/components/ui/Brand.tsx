import markLarge from '../../assets/px-icon.svg'
import markSmall from '../../assets/px-icon-petit.svg'
import markTiny from '../../assets/px-icon-16.svg'
import letters from '../../assets/px-logo-lettres.svg'

/**
 * Les trois dessins de la croix, du plus petit au plus grand : chacun est calé pour ses tailles (16 à 22 px sans flèches,
 * 24 à 40 px avec flèches en verre, au-delà la croix complète). `fill` = part du cadre occupée par la croix en largeur ;
 * `inLogo` = taille, gauche et haut de l'image dans le logo, en fractions de la hauteur du logo, pour que sa croix tombe
 * exactement à la place du X (relevés sur resources/brand/player-x-logo-petit.svg, 918 × 256).
 */
const MARKS = [
  { max: 22, src: markTiny, fill: 0.777, inLogo: [0.9262, 2.7274, -0.0178] },
  { max: 40, src: markSmall, fill: 0.797, inLogo: [0.9035, 2.7098, -0.0064] },
  { max: Infinity, src: markLarge, fill: 0.906, inLogo: [0.7944, 2.7643, 0.0496] }
] as const

/** Largeur du logo pour une hauteur de 1. */
const LOGO_RATIO = 918 / 256

const pick = (height: number): (typeof MARKS)[number] => MARKS.find((m) => height <= m.max) ?? MARKS[MARKS.length - 1]

/**
 * Icône de Player X : la croix directionnelle tournée de 45° (le X), en matière braise avec ses flèches en verre, sans
 * tuile. `alt=""` quand le nom est écrit juste à côté : il n'est pas lu deux fois.
 */
export function BrandMark({ height = 24, className = '', alt = 'Player X' }: { height?: number; className?: string; alt?: string }): React.JSX.Element {
  const m = pick(height)
  return <img className={`brand-mark ${className}`} src={m.src} data-fill={m.fill} alt={alt} style={{ height }} draggable={false} />
}

/**
 * Logo « Player X » : « Player » en Sora, et la croix de l'icône elle-même à la place du X. La croix est une `.brand-mark` :
 * dans la barre du haut, c'est là que se pose le logo de l'animation de mise à jour.
 */
export function BrandWordmark({ height = 23, className = '' }: { height?: number; className?: string }): React.JSX.Element {
  // Dans le logo, la croix reste pleine (sans flèches) jusqu'à 34 px : les flèches mouchetteraient le mot. Au-delà, la croix complète.
  const m = MARKS[0].inLogo[0] * height <= 34 ? MARKS[0] : MARKS[2]
  const [size, left, top] = m.inLogo
  return (
    <span className={`brand-wordmark ${className}`} role="img" aria-label="Player X" style={{ width: Math.round(height * LOGO_RATIO), height }}>
      <img className="brand-wordmark-letters" src={letters} alt="" draggable={false} />
      <img
        className="brand-mark brand-wordmark-x"
        src={m.src}
        data-fill={m.fill}
        alt=""
        draggable={false}
        style={{ height: size * height, left: left * height, top: top * height }}
      />
    </span>
  )
}

export const APP_NAME = 'Player X'
