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
