// Couronne de 48 traits (160 px) autour de la marque, au saut et au retour : 8 groupes de 6 qui s'allument l'un après l'autre.
// Mêmes traits que le réacteur de la carte, en plus grand : rayon 68 → 76, épaisseur 2, bouts ronds, dégradé de la marque.

const C = 80
const N = 48

// Dégradé de la marque échantillonné par trait : #e0207e (0) → #fb4f7a (.55) → #ff8a80 (1), comme l'icône.
const STOPS: [number, [number, number, number]][] = [
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

const polar = (r: number, deg: number): [string, string] => {
  const t = ((deg - 90) * Math.PI) / 180
  return [(C + r * Math.cos(t)).toFixed(2), (C + r * Math.sin(t)).toFixed(2)]
}

/** Un trait tous les 7,5°, dans le sens des aiguilles d'une montre depuis midi. */
const TICKS = Array.from({ length: N }, (_, i) => {
  const [x1, y1] = polar(68, i * 7.5)
  const [x2, y2] = polar(76, i * 7.5)
  return { x1, y1, x2, y2, color: gradientAt(i / (N - 1)) }
})
const GROUPS = Array.from({ length: 8 }, (_, g) => TICKS.slice(g * 6, g * 6 + 6))

export function TickRing({ className = '' }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 160 160" width="160" height="160" aria-hidden="true">
      {GROUPS.map((ticks, g) => (
        <g key={g}>
          {ticks.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.color} strokeWidth={2} strokeLinecap="round" />
          ))}
        </g>
      ))}
    </svg>
  )
}
