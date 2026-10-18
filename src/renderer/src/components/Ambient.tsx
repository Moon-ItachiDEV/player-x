import { useEffect, useRef } from 'react'
import { follow, fxOn, subscribeArt, type Follower } from '../motion'
import './ambient.css'

/** Dessine l'image, déjà floutée et assombrie, dans une petite toile que le CSS agrandit. */
function paint(canvas: HTMLCanvasElement, img: HTMLImageElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height
  const s = Math.max((W + 12) / img.naturalWidth, (H + 12) / img.naturalHeight)
  const w = img.naturalWidth * s
  const h = img.naturalHeight * s
  ctx.clearRect(0, 0, W, H)
  ctx.filter = 'blur(3px) saturate(1.5) brightness(0.4)'
  ctx.drawImage(img, (W - w) / 2, (H - h) * 0.25, w, h) // même cadrage que le héros (50 % 25 %)
}

const clamp = (v: number, max: number): number => (v < -max ? -max : v > max ? max : v)

/**
 * Fond de page aux couleurs du jeu survolé, plus deux comportements globaux :
 * <html data-window> (pause des boucles quand la fenêtre n'a pas le focus) et les boutons magnétiques.
 */
export function Ambient(): React.JSX.Element {
  const a = useRef<HTMLCanvasElement>(null)
  const b = useRef<HTMLCanvasElement>(null)

  // Fond : deux toiles en fondu enchaîné, seule l'opacité s'anime.
  useEffect(() => {
    const ca = a.current
    const cb = b.current
    if (!ca || !cb) return
    const layers = [ca, cb]
    let front = 0
    let shown: string | null = null
    let fromFocus = false
    let token = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let target: string | null = null
    let targetIsFocus = false
    let lastFocus: string | null = null

    const show = async (url: string | null, viaFocus: boolean): Promise<void> => {
      const t = ++token
      if (!url || !fxOn()) {
        layers.forEach((l) => l.classList.remove('is-front'))
        shown = null
        fromFocus = false
        return
      }
      if (url === shown) {
        fromFocus = viaFocus
        return
      }
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      try {
        await img.decode()
      } catch {
        return // image illisible : on garde l'actuelle
      }
      if (t !== token) return
      const back = layers[1 - front]
      paint(back, img)
      back.classList.add('is-front')
      layers[front].classList.remove('is-front')
      front = 1 - front
      shown = url
      fromFocus = viaFocus
    }

    const unsubscribe = subscribeArt(({ base, focus }) => {
      clearTimeout(timer)
      target = focus ?? base
      targetIsFocus = !!focus
      // Survol : on attend que le pointeur se pose. Fin de survol : pas d'éclair entre deux cartes.
      const delay = focus ? 160 : lastFocus && fromFocus ? 400 : 0
      lastFocus = focus
      timer = setTimeout(() => void show(target, targetIsFocus), delay)
    })

    // « Effets visuels » ou animations réduites changés en cours de route.
    let fx = fxOn()
    const mo = new MutationObserver(() => {
      if (fxOn() === fx) return
      fx = fxOn()
      clearTimeout(timer)
      void show(target, targetIsFocus)
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-fx'] })

    return () => {
      unsubscribe()
      mo.disconnect()
      clearTimeout(timer)
      token++
    }
  }, [])

  // Fenêtre inactive (masquée ou sans focus) : base.css met les boucles .fx-loop en pause.
  useEffect(() => {
    const root = document.documentElement
    const set = (): void => {
      root.dataset.window = document.hasFocus() && document.visibilityState === 'visible' ? 'active' : 'idle'
    }
    set()
    window.addEventListener('focus', set)
    window.addEventListener('blur', set)
    document.addEventListener('visibilitychange', set)
    return () => {
      window.removeEventListener('focus', set)
      window.removeEventListener('blur', set)
      document.removeEventListener('visibilitychange', set)
    }
  }, [])

  // Boutons magnétiques [data-magnetic] : un seul écouteur délégué.
  useEffect(() => {
    const magnets = new WeakMap<HTMLElement, { f: Follower; pos: { x: number; y: number } }>()
    const attached = new WeakSet<HTMLElement>()

    const onOver = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse' || !fxOn() || !(e.target instanceof Element)) return
      const el = e.target.closest('[data-magnetic]')
      if (!(el instanceof HTMLButtonElement) || el.disabled || attached.has(el)) return
      attached.add(el)

      let m = magnets.get(el)
      if (!m) {
        const pos = { x: 0, y: 0 }
        const f = follow(
          (x, y) => {
            pos.x = x
            pos.y = y
            el.style.translate = x || y ? `${x.toFixed(2)}px ${y.toFixed(2)}px` : ''
          },
          { rate: 0.2, epsilon: 0.05 }
        )
        m = { f, pos }
        magnets.set(el, m)
      }
      const { f, pos } = m
      // Une seule lecture de la géométrie par entrée (décalage en cours retiré).
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2 - pos.x
      const cy = r.top + r.height / 2 - pos.y

      const leave = (): void => {
        f.release()
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerleave', leave)
        attached.delete(el)
      }
      const move = (ev: PointerEvent): void => {
        if (el.disabled || !fxOn()) return leave()
        f.set(clamp((ev.clientX - cx) * 0.22, 6), clamp((ev.clientY - cy) * 0.22, 4))
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerleave', leave)
    }

    document.addEventListener('pointerover', onOver)
    return () => document.removeEventListener('pointerover', onOver)
  }, [])

  return (
    <div className="backdrop" aria-hidden="true">
      <canvas ref={a} className="bd-layer" width={128} height={72} />
      <canvas ref={b} className="bd-layer" width={128} height={72} />
      <div className="bd-shade" />
    </div>
  )
}
