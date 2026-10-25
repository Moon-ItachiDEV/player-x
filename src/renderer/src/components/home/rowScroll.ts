import { useEffect, useRef, useState, type RefObject } from 'react'
import { motionReduced } from '../../motion'

export interface RowScroll {
  track: RefObject<HTMLDivElement | null>
  /** Il reste des cartes avant / après la partie visible. */
  edges: { start: boolean; end: boolean }
  /** Défile d'une largeur de rangée. */
  scrollBy: (dir: 1 | -1) => void
}

/** Rangée de cartes défilante de l'accueil : bords atteints (boutons précédent / suivant) et défilement page par page. */
export function useRowScroll(count: number): RowScroll {
  const track = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  useEffect(() => {
    const el = track.current
    if (!el) return
    const update = (): void => {
      const max = el.scrollWidth - el.clientWidth
      const next = { start: el.scrollLeft > 4, end: max - el.scrollLeft > 4 }
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    el.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', update)
    }
  }, [count])

  const scrollBy = (dir: 1 | -1): void => {
    const el = track.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth, behavior: motionReduced() ? 'auto' : 'smooth' })
  }

  return { track, edges, scrollBy }
}

/**
 * Molette « un cran = un jeu » sur un élément (jeu à la une, rangée « Ta bibliothèque ») : la page ne défile pas,
 * `onStep` reçoit +1 / -1. Seuil de 40 px et 280 ms entre deux pas, pour qu'un pavé tactile ne saute pas 10 jeux.
 */
export function useWheelStep(ref: RefObject<HTMLElement | null>, onStep: (d: 1 | -1) => void): void {
  const stepRef = useRef(onStep)
  stepRef.current = onStep
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let acc = 0
    let last = 0
    const onWheel = (e: WheelEvent): void => {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      e.preventDefault()
      acc += e.deltaY
      const now = performance.now()
      if (Math.abs(acc) < 40 || now - last < 280) return
      last = now
      stepRef.current(acc > 0 ? 1 : -1)
      acc = 0
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref])
}
