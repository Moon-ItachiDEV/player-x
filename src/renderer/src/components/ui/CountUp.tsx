import { useEffect, useRef, useState } from 'react'
import { fxOn } from '../../motion'

const DURATION = 900

/**
 * Nombre qui monte jusqu'à sa valeur à l'affichage (effets riches seulement), puis suit les changements sans animation.
 * `format` rend le texte : le nombre final reste lu tel quel par les lecteurs d'écran.
 */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }): React.JSX.Element {
  const [shown, setShown] = useState(() => (fxOn() ? 0 : value))
  const played = useRef(false)

  useEffect(() => {
    if (played.current || !fxOn() || value <= 0) {
      setShown(value)
      return
    }
    played.current = true
    let raf = 0
    const start = performance.now()
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / DURATION)
      // Sortie rapide, arrivée douce (pas de dépassement).
      setShown(value * (1 - Math.pow(1 - t, 4)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      setShown(value)
    }
  }, [value])

  return (
    <span aria-label={format(value)}>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  )
}
