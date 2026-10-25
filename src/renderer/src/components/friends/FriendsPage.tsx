import type { SideFriendsProps } from '../../contracts'
import { SideFriends } from './SideFriends'
import './friends.css'

/** Page Amis (design Braise) : la liste à gauche (amis Steam et PlayStation, puis les membres du serveur Discord à part), la fiche à droite. */
export function FriendsPage(props: SideFriendsProps): React.JSX.Element {
  return (
    <div className="page friends-page">
      <SideFriends {...props} />
    </div>
  )
}
