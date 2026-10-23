import mark from '../../assets/px-icon.png'

/** Icône de Player X : la manette en verre sur le dégradé braise (carrée, coins arrondis). */
export function BrandMark({ height = 24, className = '' }: { height?: number; className?: string }): React.JSX.Element {
  return <img className={`brand-mark ${className}`} src={mark} alt="Player X" style={{ height }} draggable={false} />
}

/** Mot « Player X » en Sora, à côté de l'icône. */
export function BrandWordmark({ size = 15, className = '' }: { size?: number; className?: string }): React.JSX.Element {
  return (
    <span className={`brand-wordmark ${className}`} style={{ fontSize: size }}>
      Player X
    </span>
  )
}

export const APP_NAME = 'Player X'
