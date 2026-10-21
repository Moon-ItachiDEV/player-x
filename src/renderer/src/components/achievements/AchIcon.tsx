import { useState } from 'react'
import { hue } from '@shared/text'
import type { Achievement } from '@shared/types'
import { Icon } from '../ui/Icon'
import { isUnlocked } from './format'
import './achievements.css'

/** Icône d'un succès : celle de Steam (en gris tant qu'il n'est pas débloqué), sinon un emblème dessiné à partir du nom. */
export function AchIcon({ ach, size = 48 }: { ach: Achievement; size?: number }): React.JSX.Element {
  const done = isUnlocked(ach)
  const url = done ? ach.icon : (ach.iconGray ?? ach.icon)
  const [failed, setFailed] = useState<string | null>(null)
  const style = { width: size, height: size }
  if (url && failed !== url) {
    return (
      <span className={`ach-icon ${done ? '' : 'is-locked'}`} style={style} aria-hidden="true">
        <img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(url)} />
      </span>
    )
  }
  const h = hue(ach.name)
  return (
    <span
      className={`ach-icon ach-emblem ${done ? '' : 'is-locked'}`}
      style={{ ...style, '--ach-h': h } as React.CSSProperties}
      aria-hidden="true"
    >
      <Icon name={done ? 'trophy' : 'lock'} size={Math.round(size * 0.46)} />
    </span>
  )
}
