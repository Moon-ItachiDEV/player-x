import type { SideFriendsProps } from '../../contracts'
import { SideFriends } from './SideFriends'
import './friends.css'

/** Page Amis (design Braise) : les amis Steam et PlayStation par présence, et les membres du serveur Discord à droite. */
export function FriendsPage(props: SideFriendsProps): React.JSX.Element {
  return (
    <div className="page friends-page">
      <SideFriends {...props} />
    </div>
  )
}
