// Contenu d'un bouton Jouer (icône + libellé) selon l'état du lancement. Rien ne tourne pendant l'attente.
import { Icon, type IconName } from '../components/ui/Icon'
import type { PlayInfo } from './usePlayState'

export function PlayIcon({ p, size = 16 }: { p: PlayInfo; size?: number }): React.JSX.Element {
  if (p.icon === 'spin') return <span className="spinner launch-spin" aria-hidden="true" />
  if (p.icon === 'clock') return <Icon name="clock" size={size} />
  if (p.icon === 'dot') return <i className="launch-live-dot" aria-hidden="true" />
  return <Icon name="play" size={size} />
}

/** `label` et `icon` : à la place de Jouer au repos (« Mettre à jour » quand Steam a une mise à jour pour ce jeu). */
export function PlayLabel({ p, size, label, icon }: { p: PlayInfo; size?: number; label?: string; icon?: IconName }): React.JSX.Element {
  return (
    <>
      {icon ? <Icon name={icon} size={size ?? 16} /> : <PlayIcon p={p} size={size} />}
      <span>{label ?? p.label}</span>
    </>
  )
}
