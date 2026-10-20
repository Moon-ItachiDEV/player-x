// Contenu d'un bouton Jouer (icône + libellé) selon l'état du lancement. Rien ne tourne pendant l'attente.
import { Icon } from '../components/ui/Icon'
import type { PlayInfo } from './usePlayState'

export function PlayIcon({ p, size = 16 }: { p: PlayInfo; size?: number }): React.JSX.Element {
  if (p.icon === 'spin') return <span className="spinner launch-spin" aria-hidden="true" />
  if (p.icon === 'clock') return <Icon name="clock" size={size} />
  if (p.icon === 'dot') return <i className="launch-live-dot" aria-hidden="true" />
  return <Icon name="play" size={size} />
}

export function PlayLabel({ p, size, label }: { p: PlayInfo; size?: number; label?: string }): React.JSX.Element {
  return (
    <>
      <PlayIcon p={p} size={size} />
      <span>{label ?? p.label}</span>
    </>
  )
}
