// Paramètres › Overlay : un bloc par jeu qui a un overlay, façon fiche (image du jeu avec l'overlay posé dessus,
// raccourci, ce qu'il montre, réglages). CS2 est gratuit ; Fortnite est annoncé en Premium, qui n'existe pas encore :
// rien à acheter, la popup compare seulement les formules.
import { useEffect, useRef, useState } from 'react'
import { CS2_GAME_ID } from '@shared/cs2'
import { norm } from '@shared/text'
import type { Game, Settings } from '@shared/types'
import { OverlayStill } from '../../overlay/OverlayApp'
import { Icon } from '../ui/Icon'
import { Dialog, Segmented, Switch } from '../ui/Overlay'
import { errorMessage, useToast } from '../ui/Toasts'
import { SectionHead, SettingRow, SettingsCard } from './parts'
import './overlay-settings.css'

/** Overlay CS2 : Verre (B) par défaut, les deux autres gardés pour comparer. */
const OVERLAY_LABEL = { a: 'Façon Apple', b: 'Verre', c: 'Finition Player X' } as const

/** Ce que montre l'overlay CS2, moment par moment (voir overlay/OverlayApp.tsx). */
const CS2_FEATURES = [
  { title: "Temps d'achat", text: 'Score, ton argent, la frise des rounds, ton K/D/A, ton ADR et tes headshots, sous le radar.' },
  { title: 'Pendant le round', text: 'Une petite pastille au-dessus des munitions, rien de plus.' },
  { title: 'Mi-temps', text: 'Le score et ta première moitié de match, le temps de changer de camp.' },
  { title: 'Fin du match', text: 'Ton bilan pendant 20 secondes : victoire ou défaite, K/D, ADR, MVP, meilleur round.' }
]

/** Ce que l'overlay Fortnite montrera : les stats de fortnite-api.com, relues entre les parties (pas de données en direct). */
const FORTNITE_FEATURES = [
  { title: 'Ta saison', text: 'K/D, victoires, kills et tops 10 de la saison en cours.' },
  { title: 'Ta session', text: 'Parties, kills et victoires depuis que tu as lancé le jeu.' },
  { title: 'Au bon moment', text: 'Au lobby et en fin de partie, jamais en plein combat.' }
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
      <SectionHead title="Overlay">
        Tes chiffres par-dessus le jeu, pendant les matchs. Rien n'est injecté dans le jeu : c'est une fenêtre transparente de Player X, qui ne prend ni la
        souris ni le clavier.
      </SectionHead>

      <SettingsCard title="Counter-Strike 2" meta={<span className="set-plan is-free">Gratuit</span>}>
        <Scene game={cs2} label="Exemple de l'overlay CS2 sur le jeu">
          <StillFrame style={style} />
          <span className="ovs-sample">Chiffres d'exemple · style {OVERLAY_LABEL[style]}</span>
        </Scene>
        <p className="ovs-keys">
          En jeu, <kbd>Alt</kbd> + <kbd>X</kbd> masque ou réaffiche l'overlay
        </p>
        <Features items={CS2_FEATURES} />
        <SettingRow
          label="Overlay (bêta)"
          value={
            settings.cs2Overlay === 'off'
              ? 'Désactivé · rien par-dessus le jeu'
              : 'Activé · par-dessus CS2 en plein écran fenêtré, pendant les matchs'
          }
        >
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
          <SettingRow
            label="Style de l’overlay"
            value={
              settings.cs2Overlay === 'b'
                ? 'Verre, le style par défaut · les deux autres restent là pour comparer'
                : `${OVERLAY_LABEL[settings.cs2Overlay]}, à l’essai · Verre est le style par défaut`
            }
          >
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

      <SettingsCard title="Fortnite" meta={<span className="set-plan is-premium">Premium</span>} className="ovs-locked">
        <button type="button" className="ovs-scene-btn" onClick={() => setPlans(true)} aria-label="Fortnite : voir les formules Gratuit et Premium">
          <Scene game={fortnite} label="">
            <span className="ovs-lock">
              <Icon name="lock" size={22} />
              <b>Premium · en préparation</b>
              <span>Voir les formules</span>
            </span>
          </Scene>
        </button>
        <Features items={FORTNITE_FEATURES} />
        <p className="ovs-note">
          Fortnite n'envoie rien en direct pendant la partie : l'overlay lira tes stats entre deux parties. Pas encore disponible, rien à acheter pour
          l'instant.
        </p>
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

/** Image du jeu (bannière de la bibliothèque si elle existe, sinon un fond sombre), en 16:9. */
function Scene({ game, label, children }: { game?: Game; label: string; children: React.ReactNode }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const url = game?.heroUrl ?? game?.coverUrl
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

function Features({ items }: { items: { title: string; text: string }[] }): React.JSX.Element {
  return (
    <dl className="ovs-features">
      {items.map((f) => (
        <div key={f.title}>
          <dt>{f.title}</dt>
          <dd>{f.text}</dd>
        </div>
      ))}
    </dl>
  )
}
