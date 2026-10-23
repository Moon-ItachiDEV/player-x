// Le réacteur de la carte de mise à jour (52 × 52) : 24 graduations pour le téléchargement, 10 cellules d'énergie pour le
// compte à rebours, arc intérieur de l'empreinte, bouclier, tampons (coche, croix), orbite de la signature, étincelle de tête,
// onde de choc et halo. Ce qui est visible dépend de [data-phase] et [data-step] sur .upd-card (update.css, opacité seulement).
// Rien ne bouge ici : les transitions CSS suivent les vraies valeurs, les rares images clés partent de useCardPhase.
import type { Ref } from 'react'
import { Icon } from '../components/ui/Icon'

const C = 26

/** Point à `r` du centre, angle en degrés dans le sens horaire depuis midi. */
function polar(r: number, deg: number): [number, number] {
  const t = ((deg - 90) * Math.PI) / 180
  return [C + r * Math.cos(t), C + r * Math.sin(t)]
}

function arcD(r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r, a0)
  const [x1, y1] = polar(r, a1)
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

/** 24 graduations : traits de r 20,5 à 24,5 tous les 15°. Pas de 5,9 px à r 22,5, soit 3,9 px d'écart pour un trait de 2 px. */
export const TICKS = Array.from({ length: 24 }, (_, i) => [polar(20.5, i * 15), polar(24.5, i * 15)] as const)
/** 10 cellules d'énergie : arcs de 28° séparés de 8°, r 22,5, trait de 4 (la même bande que les graduations). */
export const CELLS = Array.from({ length: 10 }, (_, j) => arcD(22.5, j * 36 + 4, j * 36 + 32))
export const ORBIT_D = arcD(17, 0, 70)
export const INNER_C = 2 * Math.PI * 17

// Dégradé de la marque échantillonné par graduation : #e0207e (0) → #fb4f7a (.55) → #ff8a80 (1), comme l'icône.
const STOPS: Array<[number, [number, number, number]]> = [
  [0, [224, 32, 126]],
  [0.55, [251, 79, 122]],
  [1, [255, 138, 128]]
]
function gradientAt(t: number): string {
  const k = STOPS.findIndex(([o]) => o >= t)
  if (k <= 0) return `rgb(${STOPS[0][1].join(' ')})`
  const [o0, c0] = STOPS[k - 1]
  const [o1, c1] = STOPS[k]
  const u = (t - o0) / (o1 - o0)
  return `rgb(${c0.map((v, i) => Math.round(v + (c1[i] - v) * u)).join(' ')})`
}
export const TICK_COLORS = TICKS.map((_, i) => gradientAt(i / 23))

/** Bouclier (r ≈ 11 autour de 26, 25) : contour pendant la vérification, rempli au verrouillage. */
const SHIELD_D = 'M26 13.5l9 3.4v7.1c0 5.9-3.9 10.3-9 12.4-5.1-2.1-9-6.5-9-12.4v-7.1z'

/** Ce qu'affiche le centre (fondu de 120 ms d'un contenu à l'autre). */
export type ReactorCenter = 'pct' | 'sec' | 'pause' | 'check' | 'alert' | 'none'

interface Props {
  ref?: Ref<HTMLSpanElement>
  /** Graduations allumées, 0 à 24. */
  lit: number
  /** Cellules d'énergie allumées, 0 à 10. */
  cellsOn: number
  /** Avancement de l'empreinte, 0 à 1 (redessiné, jamais animé). */
  hashP: number
  center: ReactorCenter
  percent: number
  /** Secondes du compte à rebours : le chiffre est remonté à chaque seconde (clé), pour son entrée. */
  seconds: number
}

export function Reactor({ ref, lit, cellsOn, hashP, center, percent, seconds }: Props): React.JSX.Element {
  return (
    <span className="rx" ref={ref} aria-hidden="true">
      <span className="rx-glow" />
      <svg className="rx-svg" viewBox="0 0 52 52" width="52" height="52">
        <g className="rx-ticks">
          {TICKS.map(([a, b], i) => (
            <line key={i} className="rx-tick-track" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
          ))}
          {TICKS.map(([a, b], i) => (
            <line key={i} className={`rx-tick-lit${i < lit ? ' on' : ''}`} stroke={TICK_COLORS[i]} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
          ))}
        </g>
        <g className="rx-cells">
          {CELLS.map((d, j) => (
            <path key={j} className="rx-cell-track" d={d} />
          ))}
          {CELLS.map((d, j) => (
            <path key={j} className={`rx-cell-lit${j < cellsOn ? ' on' : ''}`} d={d} style={{ '--j': j } as React.CSSProperties} />
          ))}
        </g>
        <g className="rx-inner" transform="rotate(-90 26 26)">
          <circle className="rx-inner-track" cx="26" cy="26" r="17" />
          <circle
            className="rx-inner-val"
            cx="26"
            cy="26"
            r="17"
            strokeDasharray={INNER_C.toFixed(2)}
            strokeDashoffset={(INNER_C * (1 - Math.max(0, Math.min(1, hashP)))).toFixed(2)}
          />
        </g>
      </svg>
      {/* Couche (opacité par phase, en CSS) + son propre <svg> extérieur (transformé par WAAPI, donc composité). */}
      <span className="rx-l rx-shield">
        <svg className="rx-shield-svg" viewBox="0 0 52 52" width="52" height="52">
          <path className="rx-shield-fill" d={SHIELD_D} />
          <path className="rx-shield-line" d={SHIELD_D} />
        </svg>
      </span>
      <span className="rx-l rx-mark">
        <svg className="rx-mark-svg" viewBox="0 0 52 52" width="52" height="52">
          <path className="rx-check" d="M21.8 25.2l3 3 5.6-6.2" />
          <path className="rx-cross" d="M22.5 21.5l7 7M29.5 21.5l-7 7" />
        </svg>
      </span>
      <span className="rx-orbit fx-loop">
        <svg viewBox="0 0 52 52" width="52" height="52">
          <path d={ORBIT_D} />
        </svg>
      </span>
      <span className="rx-head">
        <i />
      </span>
      <span className="rx-ping" />
      <span className="rx-center" data-c={center}>
        <span className="rx-c rx-c-pct num">
          {percent}
          <small>%</small>
        </span>
        <span className="rx-c rx-c-sec num">
          <span className="rx-sec" key={seconds}>
            {seconds}
          </span>
        </span>
        <span className="rx-c rx-c-pause">
          <Icon name="pause" size={16} />
        </span>
        <span className="rx-c rx-c-check">
          <Icon name="check" size={16} />
        </span>
        <span className="rx-c rx-c-alert">
          <Icon name="alert-circle" size={16} />
        </span>
      </span>
    </span>
  )
}
