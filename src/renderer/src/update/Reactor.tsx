// Le cœur de la carte de mise à jour (52 × 52) : l'icône de Player X dans un anneau aux coins arrondis qui dit l'avancement
// (téléchargement, puis compte à rebours qui se vide), un halo, une onde de choc et une pastille d'état en bas à droite.
// Ce qui est visible dépend de [data-phase] sur .upd-card (update.css). Rien ne bouge ici : les transitions CSS suivent les
// vraies valeurs, les rares images clés partent de useCardPhase (.rx-ping, .rx-glow, .rx-sec). Le saut du redémarrage
// part de .rx (stage.ts) : l'icône devient le logo du retour.
import { useId, type Ref } from 'react'
import mark from '../assets/px-icon.png'
import { Icon } from '../components/ui/Icon'

/** Carré de 62 aux coins de 19, tracé depuis le milieu du haut, dans le sens horaire (pathLength 100). */
const RING_D = 'M32 1H44A19 19 0 0 1 63 20V44A19 19 0 0 1 44 63H20A19 19 0 0 1 1 44V20A19 19 0 0 1 20 1Z'

/** Ce qu'affiche la pastille d'état (fondu de 120 ms de l'un à l'autre). */
export type ReactorCenter = 'sec' | 'pause' | 'check' | 'alert' | 'shield' | 'refused' | 'none'

interface Props {
  ref?: Ref<HTMLSpanElement>
  /** Remplissage de l'anneau, 0 à 100. */
  value: number
  center: ReactorCenter
  /** Secondes du compte à rebours : le chiffre est remonté à chaque seconde (clé), pour son entrée. */
  seconds: number
}

export function Reactor({ ref, value, center, seconds }: Props): React.JSX.Element {
  const grad = `rx-grad-${useId().replace(/:/g, '')}`
  const v = Math.max(0, Math.min(100, value))
  return (
    <span className="rx" ref={ref} aria-hidden="true">
      <span className="rx-glow" />
      <svg className="rx-ring" viewBox="0 0 64 64" width="64" height="64">
        <defs>
          {/* Dégradé de la marque, comme l'icône : clair en haut à gauche, foncé en bas à droite. */}
          <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand-1)" />
            <stop offset=".5" stopColor="var(--brand-2)" />
            <stop offset="1" stopColor="var(--brand-3)" />
          </linearGradient>
        </defs>
        <path className="rx-ring-track" d={RING_D} pathLength={100} />
        <path
          className="rx-ring-val"
          d={RING_D}
          pathLength={100}
          stroke={`url(#${grad})`}
          strokeDasharray="100 100"
          strokeDashoffset={(100 - v).toFixed(2)}
        />
      </svg>
      <span className="rx-ping" />
      <img className="rx-logo" src={mark} alt="" draggable={false} />
      <span className="rx-center" data-c={center}>
        <span className="rx-c rx-c-sec num">
          <span className="rx-sec" key={seconds}>
            {seconds}
          </span>
        </span>
        <span className="rx-c rx-c-pause">
          <Icon name="pause" size={12} />
        </span>
        <span className="rx-c rx-c-check">
          <Icon name="check" size={12} />
        </span>
        <span className="rx-c rx-c-alert">
          <Icon name="alert-circle" size={12} />
        </span>
        <span className="rx-c rx-c-shield">
          <Icon name="shield" size={12} />
        </span>
        <span className="rx-c rx-c-refused">
          <Icon name="shield-x" size={12} />
        </span>
      </span>
    </span>
  )
}
