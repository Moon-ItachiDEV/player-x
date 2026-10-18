import type { FriendPlatform, Store } from '@shared/types'

const LABELS: Record<Store | FriendPlatform, string> = {
  steam: 'Steam',
  epic: 'Epic',
  ea: 'EA',
  discord: 'Discord',
  psn: 'PSN'
}

export function Badge({ kind }: { kind: Store | FriendPlatform }): React.JSX.Element {
  return <span className={`badge badge-${kind}`}>{LABELS[kind]}</span>
}
