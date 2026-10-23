// Étape Counter-Strike 2 (seulement si CS2 est dans les jeux trouvés) : le match en direct et le bilan,
// et l'overlay bêta. Mêmes réglages, mêmes conditions et mêmes aperçus que dans Paramètres › Interface.
import type { RefObject } from 'react'
import type { Game, Settings } from '@shared/types'
import { openCs2Recap, sampleCs2Recap } from '../cs2/useCs2'
import { Cover } from '../ui/Cover'
import { Icon } from '../ui/Icon'
import { Switch } from '../ui/Overlay'
import { errorMessage, useToast } from '../ui/Toasts'

interface Cs2StepProps {
  game: Game
  settings: Settings
  onSaveSettings: (patch: Partial<Settings>) => Promise<Settings>
  headingRef: RefObject<HTMLHeadingElement | null>
  onBack: () => void
  onNext: () => void
}

export function Cs2Step({ game, settings, onSaveSettings, headingRef, onBack, onNext }: Cs2StepProps): React.JSX.Element {
  const notify = useToast()
  const save = (patch: Partial<Settings>): void => void onSaveSettings(patch).catch((e) => notify(errorMessage(e), { kind: 'error' }))
  // Même condition que Paramètres : canal Bêta, ou version de test (préversion, « 0.9.0-beta.3 »).
  // Proposé à tous depuis la 0.9.1 (même règle que Paramètres).
  const overlayOffered = true

  return (
    <section className="cs2s" aria-labelledby="setup-title">
      <div className="cs2s-card">
        <div className="cs2s-head">
          <span className="cs2s-cover" aria-hidden="true">
            <Cover game={game} />
          </span>
          <div className="cs2s-intro">
            <p className="cs2s-found">
              <Icon name="check" size={14} />
              Counter-Strike 2 est sur ton PC
            </p>
            <h1 id="setup-title" ref={headingRef} tabIndex={-1} className="cs2s-title">
              Ton match en direct
            </h1>
            <p className="cs2s-text">
              Pendant un match, la fiche de CS2 suit ton score en direct, et ton bilan s’affiche quand il se termine, envoyé par le jeu lui-même.
            </p>
          </div>
        </div>

        <ul className="cs2s-rows">
          <li className="cs2s-row">
            <span className="cs2s-row-text">
              <span className="cs2s-row-label">Match et bilan Counter-Strike 2</span>
              <span className="cs2s-row-value">{settings.cs2Live ? 'Activé' : 'Désactivé · rien n’est relié à CS2'}</span>
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openCs2Recap(sampleCs2Recap())}>
              Voir un exemple
            </button>
            <Switch checked={settings.cs2Live} onChange={(cs2Live) => save({ cs2Live })} label="Match Counter-Strike 2" />
          </li>
          {overlayOffered && (
            <li className="cs2s-row">
              <span className="cs2s-row-text">
                <span className="cs2s-row-label">Overlay CS2 (bêta)</span>
                <span className="cs2s-row-value">
                  {settings.cs2Overlay === 'off' ? 'Désactivé · rien par-dessus le jeu' : 'Activé · tes chiffres par-dessus CS2 pendant les matchs. Alt+X le masque'}
                </span>
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={settings.cs2Overlay === 'off'}
                onClick={() => window.launcher.cs2OverlayPreview().catch((e) => notify(errorMessage(e), { kind: 'error' }))}
              >
                Aperçu à l’écran
              </button>
              {/* Activé : le style Verre (B), celui gardé par défaut, comme dans Paramètres. */}
              <Switch checked={settings.cs2Overlay !== 'off'} onChange={(on) => save({ cs2Overlay: on ? 'b' : 'off' })} label="Overlay CS2" />
            </li>
          )}
        </ul>

        <p className="cs2s-note">Tu retrouves ces réglages dans Paramètres › Interface.</p>

        <div className="cs2s-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Retour
          </button>
          <button type="button" className="btn btn-primary btn-lg setup-cta cs2s-next" onClick={onNext}>
            Choisir mes favoris
            <Icon name="chevron-right" size={18} />
          </button>
        </div>
      </div>
    </section>
  )
}
