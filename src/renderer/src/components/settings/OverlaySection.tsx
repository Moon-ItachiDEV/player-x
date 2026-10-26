// Paramètres › Overlay : les overlays rangés par type de jeu. Counter-Strike 2 (FPS, gratuit) en fiche complète (image du
// jeu avec l'overlay posé dessus, raccourci, ce qu'il montre, réglages) ; puis ceux en préparation : Fortnite (battle
// royale, annoncé en Premium, qui n'existe pas encore : rien à acheter, la popup compare seulement les formules),
// Teamfight Tactics (auto-battler) et League of Legends (MOBA).
import { useEffect, useRef, useState } from 'react'
import { CS2_GAME_ID } from '@shared/cs2'
import { DEFAULT_OVERLAY_HOTKEY, hotkeyFromPress, hotkeyLabel, hotkeyText } from '@shared/hotkey'
import { norm } from '@shared/text'
import type { Game, Settings } from '@shared/types'
import cs2Dust2 from '../../assets/cs2-dust2.webp'
import { OverlayStill } from '../../overlay/OverlayApp'
import { Icon } from '../ui/Icon'
import { Dialog, Segmented, Switch } from '../ui/Overlay'
import { errorMessage, useToast } from '../ui/Toasts'
import { SectionHead, SettingRow, SettingsCard } from './parts'
import './overlay-settings.css'

/** Overlay CS2 : Verre (B) par défaut, les deux autres gardés pour comparer. */
const OVERLAY_LABEL = { a: 'Façon Apple', b: 'Verre', c: 'Finition Player X' } as const

/** Ce que montre l'overlay CS2, moment par moment (voir overlay/OverlayApp.tsx). */

/** Les overlays à venir, rangés par type de jeu. Fortnite est annoncé en Premium (qui n'existe pas encore : rien à acheter). */
const SOON: { name: string; genre: string; premium?: boolean }[] = [
  { name: 'Fortnite', genre: 'Battle royale', premium: true },
  { name: 'Teamfight Tactics', genre: 'Auto-battler' },
  { name: 'League of Legends', genre: 'MOBA' }
]

interface Props {
  settings: Settings
  onSaveSettings: (patch: Partial<Settings>) => Promise<Settings>
  games: Game[]
}

export function OverlaySection({ settings, onSaveSettings, games }: Props): React.JSX.Element {
  const notify = useToast()
  const [plans, setPlans] = useState(false)
  const cs2 = games.find((g) => g.id === CS2_GAME_ID)
  const fortnite = games.find((g) => norm(g.name) === 'fortnite')
  const style = settings.cs2Overlay === 'off' ? 'b' : settings.cs2Overlay
  const save = (patch: Partial<Settings>): void => void onSaveSettings(patch).catch((e) => notify(errorMessage(e), { kind: 'error' }))

  return (
    <>
      <SectionHead title="Overlay" />

      <SettingsCard
        title="Counter-Strike 2"
        meta={
          <span className="ovs-meta">
            <span className="ovs-genre">FPS</span>
            <span className="set-plan is-free">Gratuit</span>
          </span>
        }
      >
        <Scene game={cs2} art={cs2Dust2} label="Exemple de l'overlay CS2 sur une partie (Dust2)">
          <StillFrame style={style} />
          <span className="ovs-sample">Chiffres d'exemple · style {OVERLAY_LABEL[style]}</span>
        </Scene>
        <p className="ovs-keys">
          En jeu, <Keys accel={settings.overlayHotkey} /> masque ou réaffiche l'overlay
        </p>
        <SettingRow label="Overlay (bêta)">
          <div className="set-inline">
            <Switch
              checked={settings.cs2Overlay !== 'off'}
              // Activé : le style Verre (B), celui gardé par défaut.
              onChange={(on) => save({ cs2Overlay: on ? 'b' : 'off' })}
              label="Overlay CS2"
            />
            <button
              className="btn btn-secondary btn-sm"
              disabled={settings.cs2Overlay === 'off'}
              onClick={() => window.launcher.cs2OverlayPreview().catch((e) => notify(errorMessage(e), { kind: 'error' }))}
            >
              Aperçu à l’écran
            </button>
          </div>
        </SettingRow>
        {settings.cs2Overlay !== 'off' && (
          <HotkeyRow
            label="Raccourci : masquer ou afficher"
            value={settings.overlayHotkey}
            onSave={(overlayHotkey) => onSaveSettings({ overlayHotkey }).then(() => undefined)}
          />
        )}
        {settings.cs2Overlay !== 'off' && (
          <SettingRow label="Style de l’overlay">
            <Segmented
              className="set-seg"
              label="Style de l’overlay"
              value={settings.cs2Overlay}
              options={[
                { value: 'b', label: 'Verre' },
                { value: 'a', label: 'Apple' },
                { value: 'c', label: 'Player X' }
              ]}
              onChange={(cs2Overlay) => save({ cs2Overlay })}
            />
          </SettingRow>
        )}
      </SettingsCard>

      <SettingsCard title="En préparation">
        <ul className="ovs-soon">
          {SOON.map((g) => {
            const game = g.premium ? fortnite : undefined
            const body = (
              <>
                <Scene game={game} label="">
                  {!game?.heroUrl && !game?.coverUrl && <span className="ovs-soon-name">{g.name}</span>}
                  {g.premium && <Icon name="lock" size={18} className="ovs-soon-lock" />}
                </Scene>
                <span className="ovs-soon-row">
                  <span className="ovs-soon-title">
                    <b>{g.name}</b>
                    <span className="ovs-genre">{g.genre}</span>
                  </span>
                  {g.premium ? <span className="set-plan is-premium">Premium</span> : <span className="set-plan is-soon">Bientôt</span>}
                </span>
              </>
            )
            return (
              <li key={g.name} className="ovs-soon-item">
                {g.premium ? (
                  <button type="button" className="ovs-soon-btn" onClick={() => setPlans(true)} aria-label={`${g.name} : voir les formules Gratuit et Premium`}>
                    {body}
                  </button>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      </SettingsCard>

      <Dialog
        open={plans}
        title="Gratuit ou Premium"
        className="ovs-plans-dialog"
        onClose={() => setPlans(false)}
        actions={
          <button className="btn btn-primary" onClick={() => setPlans(false)}>
            Fermer
          </button>
        }
      >
        <div className="ovs-plans">
          <section className="ovs-plan">
            <h3>
              Gratuit <span className="set-plan is-free">Ta formule</span>
            </h3>
            <ul>
              <li>Ta bibliothèque Steam, Epic et EA</li>
              <li>Tes amis et les membres du serveur Discord</li>
              <li>Match CS2 en direct et bilan de fin de match</li>
              <li>Overlay Counter-Strike 2</li>
              <li>Stats et bilan Battlefield 6</li>
              <li>Succès Steam et actus de tes jeux</li>
            </ul>
          </section>
          <section className="ovs-plan is-premium">
            <h3>
              Premium <span className="set-plan is-soon">En préparation</span>
            </h3>
            <ul>
              <li>Tout ce qui est gratuit</li>
              <li>Overlay Fortnite : ta saison et ta session, entre les parties</li>
            </ul>
          </section>
        </div>
        <p className="ovs-plans-note">Premium n'est pas encore disponible : aucun paiement, rien à acheter pour l'instant.</p>
      </Dialog>
    </>
  )
}

/**
 * Image du jeu en 16:9 : une vraie capture en jeu si on en a une (`art`, livrée avec l'appli), sinon la bannière de la
 * bibliothèque, sinon un fond sombre.
 */
function Scene({ game, art, label, children }: { game?: Game; art?: string; label: string; children: React.ReactNode }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const url = art ?? game?.heroUrl ?? game?.coverUrl
  return (
    <div className="ovs-scene" role={label ? 'img' : undefined} aria-label={label || undefined}>
      {url && !failed && <img className="ovs-scene-art" src={url} alt="" onError={() => setFailed(true)} />}
      {children}
    </div>
  )
}

/** L'overlay (1920×1080) réduit à la largeur du cadre. */
function StillFrame({ style }: { style: 'a' | 'b' | 'c' }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setZoom(el.clientWidth / 1920))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="ovs-still" ref={ref}>
      {zoom > 0 && (
        <div style={{ zoom }}>
          <OverlayStill style={style} />
        </div>
      )}
    </div>
  )
}

/** « Alt + X » en touches de clavier. */
function Keys({ accel }: { accel: string }): React.JSX.Element {
  const keys = hotkeyLabel(accel)
  return (
    <>
      {keys.map((k, i) => (
        <span key={k} className="ovs-keys-part">
          {i > 0 && ' + '}
          <kbd>{k}</kbd>
        </span>
      ))}
    </>
  )
}

/**
 * Un raccourci réglable : « Changer », puis la combinaison au clavier (Échap annule). Vérifié avant d'être gardé :
 * règles de shared/hotkey.ts, puis libre auprès de Windows (cs2:overlay-hotkey-check).
 */
function HotkeyRow({ label, value, onSave }: { label: string; value: string; onSave: (accel: string) => Promise<void> }): React.JSX.Element {
  const [listening, setListening] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const apply = (accel: string): void => {
    setBusy(true)
    window.launcher
      .cs2OverlayHotkeyCheck(accel)
      .then(async (why) => {
        if (why) return setProblem(why)
        setProblem(null)
        await onSave(accel)
      })
      .catch((e) => setProblem(errorMessage(e)))
      .finally(() => setBusy(false))
  }

  useEffect(() => {
    if (!listening) return
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        setProblem(null)
        return setListening(false)
      }
      const r = hotkeyFromPress(e)
      if (!r) return
      if ('problem' in r) return setProblem(r.problem)
      setListening(false)
      apply(r.accel)
    }
    const stop = (): void => setListening(false)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', stop)
    }
    // apply ne dépend que de onSave : inutile de réabonner l'écoute à chaque rendu.
  }, [listening])

  return (
    <SettingRow
      label={label}
      value={
        problem ? (
          <span className="ovs-hotkey-problem" role="alert">
            {problem}
          </span>
        ) : listening ? (
          'Appuie sur ta combinaison · Échap pour annuler'
        ) : undefined
      }
    >
      <div className="set-inline">
        <span className="ovs-hotkey" aria-hidden="true">
          <Keys accel={value} />
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-pressed={listening}
          disabled={busy}
          onClick={() => {
            setProblem(null)
            setListening((l) => !l)
          }}
        >
          {listening ? 'Annuler' : 'Changer'}
        </button>
        {value !== DEFAULT_OVERLAY_HOTKEY && !listening && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => apply(DEFAULT_OVERLAY_HOTKEY)}>
            Remettre {hotkeyText(DEFAULT_OVERLAY_HOTKEY)}
          </button>
        )}
      </div>
    </SettingRow>
  )
}

