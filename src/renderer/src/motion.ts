// Mouvement : réglage « Effets visuels », lissage du pointeur, fond aux couleurs du jeu, transitions de vue.
// API figée par docs/design/motion-premium.md §3 : ne pas la changer sans prévenir les autres lots.
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

const REDUCED = '(prefers-reduced-motion: reduce)'

/** « Réduire les animations » ou réglage d'accessibilité de Windows. */
export function motionReduced(): boolean {
  return document.documentElement.classList.contains('reduce-motion') || matchMedia(REDUCED).matches
}

/** Effets riches permis (<html data-fx="on">, posé par App.tsx). À lire au moment de l'événement, jamais au montage. */
export function fxOn(): boolean {
  return document.documentElement.dataset.fx === 'on'
}

/** Suit le réglage d'accessibilité de Windows. */
export function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => matchMedia(REDUCED).matches)
  useEffect(() => {
    const mq = matchMedia(REDUCED)
    const onChange = (): void => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Fenêtre inactive (masquée ou sans focus) : `<html data-window='idle'>`, base.css met alors les boucles .fx-loop en pause. Sur tous les écrans. */
export function useWindowActivity(): void {
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
}

// ---------- lissage ----------

export interface Follower {
  set(x: number, y: number): void
  release(): void
  cancel(): void
}

/** Suit une cible avec un lissage exponentiel (indépendant des Hz de l'écran). Une seule boucle rAF, arrêtée une fois posée. */
export function follow(
  apply: (x: number, y: number) => void,
  { rate = 0.18, restX = 0, restY = 0, epsilon = 0.001 }: { rate?: number; restX?: number; restY?: number; epsilon?: number } = {}
): Follower {
  let x = restX
  let y = restY
  let tx = restX
  let ty = restY
  let raf = 0
  let last = 0
  const tick = (now: number): void => {
    const dt = last ? Math.min(64, now - last) : 16.7
    last = now
    const k = 1 - Math.pow(1 - rate, dt / 16.7)
    x += (tx - x) * k
    y += (ty - y) * k
    const settled = Math.abs(tx - x) < epsilon && Math.abs(ty - y) < epsilon
    if (settled) {
      x = tx
      y = ty
    }
    apply(x, y)
    if (settled) {
      raf = 0
      last = 0
    } else raf = requestAnimationFrame(tick)
  }
  const kick = (): void => {
    if (!raf) raf = requestAnimationFrame(tick)
  }
  return {
    set(nx, ny) {
      tx = nx
      ty = ny
      kick()
    },
    release() {
      tx = restX
      ty = restY
      kick()
    },
    cancel() {
      cancelAnimationFrame(raf)
      raf = 0
      last = 0
    }
  }
}

// ---------- fond aux couleurs du jeu (Ambient.tsx l'affiche) ----------

export interface ArtState {
  /** Image de fond de la page (jeu à la une). */
  base: string | null
  /** Jeu survolé ou focalisé au clavier. */
  focus: string | null
}
const art: ArtState = { base: null, focus: null }
const artListeners = new Set<(s: ArtState) => void>()
const emitArt = (): void => artListeners.forEach((l) => l({ ...art }))

export function setArtFocus(url: string | null | undefined): void {
  const next = url || null
  if (next === art.focus) return
  art.focus = next
  emitArt()
}

export function setArtBase(url: string | null | undefined): void {
  const next = url || null
  if (next === art.base) return
  art.base = next
  emitArt()
}

export function subscribeArt(listener: (s: ArtState) => void): () => void {
  artListeners.add(listener)
  listener({ ...art })
  return () => {
    artListeners.delete(listener)
  }
}

// ---------- source du morphing jaquette → fiche ----------

export type MorphKind = 'cover' | 'art'
export interface MorphSource {
  el: HTMLElement
  gameId: string
  kind: MorphKind
  at: number
}
let morph: MorphSource | null = null
let opened: MorphSource | null = null

const onScreen = (el: HTMLElement): boolean => {
  if (!el.isConnected) return false
  const r = el.getBoundingClientRect()
  return r.width > 24 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
}

/** À appeler juste avant onOpen(game) : l'élément (jaquette 2:3 ou visuel paysage) qui deviendra l'en-tête de la fiche. */
export function setMorphSource(el: HTMLElement | null, gameId: string, kind: MorphKind): void {
  morph = el ? { el, gameId, kind, at: performance.now() } : null
}

/** App.tsx : source valable pour ce jeu (posée il y a moins d'1 s, encore à l'écran), sinon null. */
export function takeMorphSource(gameId: string): MorphSource | null {
  const m = morph
  morph = null
  if (!m || m.gameId !== gameId || performance.now() - m.at > 1000 || !onScreen(m.el)) return null
  opened = m
  return m
}

/** App.tsx, à la fermeture : l'élément d'origine s'il est toujours visible. */
export function closeTarget(gameId: string): MorphSource | null {
  const m = opened
  opened = null
  return m && m.gameId === gameId && onScreen(m.el) ? m : null
}

// ---------- transitions de vue ----------

export type VtKind = 'open' | 'close' | 'reorder'
const MAX_NAMED = 48
const MORPH_NAME: Record<MorphKind, string> = { cover: 'px-cover', art: 'px-art' }
let running = false

/** Jaquettes entièrement visibles sous la barre d'outils collante (48 au plus). */
function visibleCards(): HTMLElement[] {
  const content = document.querySelector('.content')
  const grid = document.querySelector('.lib-grid')
  if (!content || !grid) return []
  const view = content.getBoundingClientRect()
  const top = Math.max(view.top, document.querySelector('.lib-toolbar')?.getBoundingClientRect().bottom ?? view.top)
  const out: HTMLElement[] = []
  for (const el of grid.querySelectorAll<HTMLElement>(':scope > .lib-card')) {
    const r = el.getBoundingClientRect()
    if (r.top > view.bottom || out.length >= MAX_NAMED) break
    if (r.top >= top && r.bottom <= view.bottom && r.left >= view.left && r.right <= view.right) out.push(el)
  }
  return out
}

function nameCards(els: Iterable<HTMLElement>, on: boolean): void {
  for (const el of els) {
    el.style.viewTransitionName = on ? 'match-element' : ''
    el.style.viewTransitionClass = on ? 'px-card' : ''
  }
}

/**
 * Applique `update` (des setState) dans une transition de vue.
 * Sans support, animations réduites, transition en cours, rien à animer : `update` tout de suite.
 */
export function withViewTransition(update: () => void, { kind, source = null }: { kind: VtKind; source?: MorphSource | null }): void {
  const root = document.documentElement
  const skip =
    typeof document.startViewTransition !== 'function' ||
    motionReduced() ||
    running ||
    document.hidden ||
    (kind !== 'reorder' && !source) ||
    (kind === 'open' && !!document.querySelector('.sheet-root'))
  if (skip) return update()

  const cards = new Set<HTMLElement>()
  if (kind === 'reorder') {
    visibleCards().forEach((el) => cards.add(el))
    if (!cards.size) return update()
    nameCards(cards, true)
  } else if (kind === 'open' && source) {
    source.el.style.viewTransitionName = MORPH_NAME[source.kind]
  }

  const classes = ['vt-active', `vt-${kind}`, ...(source ? [`vt-from-${source.kind}`] : [])]
  root.classList.add(...classes)
  running = true
  const t = document.startViewTransition({
    types: [kind],
    update: () => {
      if (kind === 'reorder') {
        nameCards(cards, false)
        flushSync(update)
        const after = visibleCards()
        after.forEach((el) => cards.add(el))
        nameCards(after, true)
      } else if (kind === 'open') {
        if (source) source.el.style.viewTransitionName = ''
        flushSync(update)
      } else {
        flushSync(update)
        root.classList.add('vt-close-new')
        if (source) source.el.style.viewTransitionName = MORPH_NAME[source.kind]
      }
    }
  })
  t.ready.catch(() => {})
  t.finished
    .catch(() => {})
    .finally(() => {
      root.classList.remove(...classes, 'vt-close-new')
      nameCards(cards, false)
      if (source) source.el.style.viewTransitionName = ''
      running = false
    })
}
