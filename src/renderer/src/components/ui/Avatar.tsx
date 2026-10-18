import { useState } from 'react'
import type { FriendStatus } from '@shared/types'
import './avatar.css'

interface Props {
  name: string
  url?: string
  size?: number
  /** Pastille de présence (forme + couleur). */
  status?: FriendStatus | 'guest' | 'connected'
  className?: string
}

/** Avatar rond avec repli sur l'initiale et pastille de présence découpée dans le fond. */
export function Avatar({ name, url, size = 32, status, className = '' }: Props): React.JSX.Element {
  const [broken, setBroken] = useState(false)
  const badge = Math.max(10, Math.round(size * 0.36))
  return (
    <span className={`avatar ${status ? `st-${status}` : ''} ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {url && !broken ? <img src={url} alt="" draggable={false} onError={() => setBroken(true)} /> : <span className="avatar-initial">{name.charAt(0).toUpperCase()}</span>}
      {status && <span className="avatar-badge" style={{ width: badge, height: badge }} aria-hidden="true" />}
    </span>
  )
}
