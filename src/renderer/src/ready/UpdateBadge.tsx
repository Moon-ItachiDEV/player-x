// Prêt à jouer : la pastille d'état d'un jeu Steam (« Mise à jour · 3,1 Go », « Téléchargement · 62 % ») et la fine
// barre de progression posée au bas d'une jaquette. Rien quand le jeu est prêt.
import { updateLabel, updatePercent, updateSentence } from '@shared/steamUpdate'
import type { SteamUpdate } from '@shared/types'
import { useToast, errorMessage } from '../components/ui/Toasts'
import { Icon } from '../components/ui/Icon'
import './ready.css'

/** Pastille, même famille que « En jeu » et « Nouveau patch » (lib-badge). */
export function UpdateBadge({ update, className = '' }: { update: SteamUpdate; className?: string }): React.JSX.Element {
  return (
    <span className={`lib-badge lib-badge-update ${update.kind === 'paused' ? 'is-paused' : ''} ${className}`} title={updateSentence(update)}>
      <Icon name={update.kind === 'paused' ? 'pause' : 'download'} size={12} />
      {updateLabel(update)}
    </span>
  )
}

/** Barre de progression au bas d'une jaquette : seulement quand Steam télécharge, installe ou a mis en pause, taille connue. */
export function UpdateBar({ update, className = '' }: { update: SteamUpdate; className?: string }): React.JSX.Element | null {
  const pct = updatePercent(update)
  if (pct === null || update.kind === 'queued') return null
  return (
    <span className={`dl-bar ${update.kind === 'paused' ? 'is-paused' : ''} ${className}`} aria-hidden="true">
      <span className="dl-bar-fill" style={{ width: `${Math.max(2, pct)}%` }} />
    </span>
  )
}

/** « Voir dans Steam » : la page Téléchargements de Steam (rien en mode démo, une carte le dit). */
export function useOpenSteamDownloads(): () => void {
  const notify = useToast()
  return () => {
    window.launcher
      .openSteamDownloads()
      .then((r) => {
        if (r === 'demo') notify('Mode démo : Steam ouvrirait ses téléchargements', { kind: 'info' })
      })
      .catch((e) => notify(errorMessage(e), { kind: 'error' }))
  }
}
