import mark from '../../assets/px-mark.png'

/** Monogramme PX (dégradé violet → cyan, fond transparent). Largeur ≈ 2,1 × hauteur. */
export function BrandMark({ height = 24, className = '' }: { height?: number; className?: string }): React.JSX.Element {
  return <img className={`brand-mark ${className}`} src={mark} alt="Player X" style={{ height }} draggable={false} />
}

/** Mot « PLAYER X » en capitales géométriques larges, en attendant le logotype corrigé. */
export function BrandWordmark({ size = 15, className = '' }: { size?: number; className?: string }): React.JSX.Element {
  return (
    <span className={`brand-wordmark ${className}`} style={{ fontSize: size }}>
      PLAYER X
    </span>
  )
}

export const APP_NAME = 'Player X'
