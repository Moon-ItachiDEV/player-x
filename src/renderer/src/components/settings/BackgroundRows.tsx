// Paramètres › Interface : ce que fait la croix (ranger Player X près de l'horloge ou le quitter) et le démarrage avec Windows.
import { useEffect, useState } from 'react'
import type { Settings, StartupState } from '@shared/types'
import { Segmented, Switch } from '../ui/Overlay'
import { errorMessage, useToast } from '../ui/Toasts'
import { SettingRow } from './parts'

const api = window.launcher

const STARTUP_TEXT: Record<StartupState, string> = {
  on: 'Activé · Player X se lance caché près de l’horloge quand tu ouvres ta session',
  off: 'Désactivé',
  blocked: 'Bloqué par Windows · réactive Player X dans le Gestionnaire des tâches, onglet Applications de démarrage',
  unavailable: 'Disponible avec Player X installé sur Windows'
}

interface Props {
  settings: Settings
  onSaveSettings: (patch: Partial<Settings>) => Promise<Settings>
}

export function BackgroundRows({ settings, onSaveSettings }: Props): React.JSX.Element | null {
  const notify = useToast()
  const [startup, setStartup] = useState<StartupState | null>(null)

  // Relu à chaque changement : Windows peut l'avoir bloqué de son côté.
  useEffect(() => {
    let live = true
    api
      .getStartupState()
      .then((s) => live && setStartup(s))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [settings.startWithWindows])

  // Sur macOS, le Dock garde Player X ouvert : rien à régler.
  if (api.platform === 'darwin') return null

  const save = (patch: Partial<Settings>): void => {
    onSaveSettings(patch).catch((e) => notify(errorMessage(e), { kind: 'error' }))
  }

  return (
    <>
      <SettingRow
        label="Fermer la fenêtre"
        value={
          settings.closeToTray
            ? 'Range Player X près de l’horloge · le temps de jeu, les alertes d’amis et le bilan BF6 continuent'
            : 'Quitte Player X · plus de temps de jeu ni d’alertes jusqu’à sa réouverture'
        }
      >
        <Segmented
          className="set-seg"
          label="Fermer la fenêtre"
          value={settings.closeToTray ? 'tray' : 'quit'}
          options={[
            { value: 'tray', label: 'Ranger' },
            { value: 'quit', label: 'Quitter' }
          ]}
          onChange={(v) => save({ closeToTray: v === 'tray' })}
        />
      </SettingRow>
      <SettingRow label="Démarrer avec Windows" value={startup ? STARTUP_TEXT[startup] : ' '}>
        {startup !== 'unavailable' && (
          <Switch checked={settings.startWithWindows} onChange={(startWithWindows) => save({ startWithWindows })} label="Démarrer avec Windows" />
        )}
      </SettingRow>
    </>
  )
}
