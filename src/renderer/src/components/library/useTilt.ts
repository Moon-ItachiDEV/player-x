import { useEffect, useRef, type RefObject } from 'react'
import { follow, fxOn, setArtFocus } from '../../motion'

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Inclinaison + reflet de la jaquette survolée. Écrit --px/--py (0..1) sur `host`, jamais sur :root. */
export function useTilt(target: RefObject<HTMLElement | null>, host: RefObject<HTMLElement | null>, art: string | undefined): void {
  const artRef = useRef(art)
  artRef.current = art
  useEffect(() => {
    const el = target.current
    const card = host.current
    if (!el || !card) return
    let rect: DOMRect | null = null
    let tilting = false
    let hovered = false
    const f = follow(
      (x, y) => {
        card.style.setProperty('--px', x.toFixed(4))
        card.style.setProperty('--py', y.toFixed(4))
      },
      { rate: 0.16, restX: 0.5, restY: 0.5 }
    )
    const stale = (): void => {
      rect = null
    }
    const move = (e: PointerEvent): void => {
      if (!tilting) return
      rect ??= el.getBoundingClientRect()
      f.set(clamp01((e.clientX - rect.left) / rect.width), clamp01((e.clientY - rect.top) / rect.height))
    }
    const enter = (e: PointerEvent): void => {
      hovered = true
      setArtFocus(artRef.current)
      if (e.pointerType !== 'mouse' || !fxOn()) return
      tilting = true
      rect = el.getBoundingClientRect()
      card.dataset.tilt = ''
      window.addEventListener('scroll', stale, { capture: true, passive: true })
      move(e)
    }
    const leave = (): void => {
      if (hovered) setArtFocus(null)
      hovered = false
      if (!tilting) return
      tilting = false
      delete card.dataset.tilt
      window.removeEventListener('scroll', stale, true)
      f.release()
    }
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      leave()
      f.cancel()
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [target, host])
}
