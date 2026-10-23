import type { SideFriendsProps } from '../../contracts'
import { SideFriends } from './SideFriends'
import './friends.css'

/** Page Amis (design Braise) : la liste des amis Steam et PlayStation et des membres du serveur Discord, en grand. */
export function FriendsPage(props: SideFriendsProps): React.JSX.Element {
  return (
    <div className="page friends-page">
      <div className="fp-card">
        <SideFriends {...props} />
      </div>
    </div>
  )
}
