// Géométrie du vol de la jaquette (FLIP) : d'où elle part, et la transformation qui la pose sur sa source.
// Sans DOM (tests) : des rectangles en px de fenêtre.

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface Flip {
  dx: number
  dy: number
  /** Échelle uniforme (transform-origin 0 0). */
  s: number
}

/** Le moins large qu'une source peut être pour que le vol se lise. */
const MIN_WIDTH = 24
/** Hauteur / largeur acceptées : du carré du rail à la jaquette 2:3. Une vignette paysage ne vole pas. */
const RATIO_MIN = 0.9
const RATIO_MAX = 1.7
/** Au-delà de 15 % d'écart de proportions, la jaquette apparaît en fondu pendant son vol. */
const RATIO_TOLERANCE = 0.15

/** Source utilisable : visible dans la fenêtre, assez large, de proportions proches d'une jaquette. */
export function usableSource(r: Box | null | undefined, viewport: { width: number; height: number }): boolean {
  if (!r || r.width < MIN_WIDTH || r.height <= 0) return false
  if (r.left + r.width <= 0 || r.top + r.height <= 0 || r.left >= viewport.width || r.top >= viewport.height) return false
  const ratio = r.height / r.width
  return ratio >= RATIO_MIN && ratio <= RATIO_MAX
}

/** Transformation qui pose `dst` (sa place finale) sur `src` : même largeur, centrée verticalement sur la source. */
export function flipFrom(src: Box, dst: Box): Flip {
  const s = src.width / dst.width
  return { dx: src.left - dst.left, dy: src.top + (src.height - dst.height * s) / 2 - dst.top, s }
}

/** Les proportions diffèrent trop (le carré du rail vers une jaquette 2:3). */
export function ratioMismatch(src: Box, dst: Box): boolean {
  const a = src.height / src.width
  const b = dst.height / dst.width
  return Math.abs(a - b) / b > RATIO_TOLERANCE
}
