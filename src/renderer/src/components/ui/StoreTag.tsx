import type { FriendPlatform, Store } from '@shared/types'

export type Kind = Store | FriendPlatform

const MONOGRAM: Record<Kind, string> = { steam: 'S', epic: 'E', ea: 'EA', discord: 'D', psn: 'PS' }

export const KIND_LABEL: Record<Kind, string> = {
  steam: 'Steam',
  epic: 'Epic',
  ea: 'EA',
  discord: 'Discord',
  psn: 'PlayStation'
}

/** Nom long d'un store (« Epic Games », « EA app »). */
export const STORE_LONG: Record<Store, string> = { steam: 'Steam', epic: 'Epic Games', ea: 'EA app' }

interface Props {
  kind: Kind
  /** Pastille avec le nom au lieu du monogramme. */
  long?: boolean
  /** Taille du carré (monogramme). */
  size?: number
  className?: string
}

/** Monogramme teinté d'un store ou d'une plateforme. Jamais de logo officiel. */
export function StoreTag({ kind, long, size, className = '' }: Props): React.JSX.Element {
  const style = size && !long ? { width: size, height: size, fontSize: Math.max(9.5, size * 0.36), borderRadius: Math.round(size / 4) } : undefined
  return (
    <span className={`store-tag tint-${kind} ${long ? 'long' : ''} ${className}`} style={style} title={KIND_LABEL[kind]}>
      {long ? KIND_LABEL[kind] : MONOGRAM[kind]}
    </span>
  )
}
