// Ce que le clic sur Jouer montre (spec launch-sequence.md §3) : la mise à feu en Full (la jaquette quitte l'endroit
// cliqué, s'allume quand Windows transmet le lien, puis se range dans la carte, en moins d'une seconde), le glissé
// (effets coupés, ou mise à feu déjà vue) et l'allumage dans la fiche. Rien ne bloque un clic, rien ne prend le focus :
// quitter la fenêtre, cliquer, faire défiler ou Échap efface la scène en 160 ms.
import { flushSync } from 'react-dom'
import type { LaunchPhase } from '@shared/launch'
import type { Game } from '@shared/types'
import { KF } from '../update/keyframes'
import { Run } from '../update/run'
import { anim, createStore, fx, tier } from '../update/session'
import { flipFrom, ratioMismatch, usableSource, type Box } from './flip'
import { LKF } from './keyframes'
import type { LaunchView } from './store'

/** Comment la carte arrive : mise à feu, glissé, allumage dans la fiche, entrée simple de la carte, ou rien. */
export type Entrance = 'stage' | 'glide' | 'sheet' | 'auto' | 'none'

export interface StageView {
  key: number
  launchId: string
  mode: 'stage' | 'glide'
  game: Pick<Game, 'name' | 'coverUrl' | 'heroUrl'>
  name: string
  demo: boolean
  /** Image du bandeau déjà décodée (bannière, sinon jaquette), ou null : dégradé généré. */
  bandUrl: string | null
  /** Zone de contenu (la scène ne couvre ni le rail, ni le menu, ni la barre du haut). */
  content: Box
  /** Textes d'après l'envoi (« Envoyé à Steam ») : posés au moment de la mise à feu. */
  after: boolean
  /** Glissé : place de la vignette de la carte. */
  ghost?: Box
}

export const launchStage = createStore<StageView | null>(null)

export interface VisualCtx {
  launchId: string
  game: Game
  name: string
  from: HTMLElement | null
  entrance: Entrance
  demo: boolean
  /** Le lancement tel que l'interface le connaît maintenant. */
  get(): LaunchView | null
  subscribe(cb: () => void): () => void
}

let stageKey = 0
/** Course de la scène en cours (une seule à la fois). */
let current: { launchId: string; fade: () => void } | null = null

const cardEl = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`.launch-card[data-launch-id="${CSS.escape(id)}"]`)
const viewport = (): { width: number; height: number } => ({ width: innerWidth, height: innerHeight })
const box = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height })

/** Rectangle de l'élément cliqué, s'il peut servir de départ au vol. */
function sourceBox(from: HTMLElement | null): Box | null {
  if (!from?.isConnected) return null
  const r = box(from.getBoundingClientRect())
  return usableSource(r, viewport()) ? r : null
}

/** Phase du lancement une fois le lien transmis (ou refusé) par Windows ; null tant qu'il part. */
function handedPhase(v: LaunchView | null): LaunchPhase | null {
  if (!v || v.checking || v.status.rev < 0 || v.status.phase === 'sending') return null
  return v.status.phase
}

/** Une image déjà décodée par la page (rien ne se charge au moment du clic). */
function decoded(url: string | undefined): boolean {
  if (!url) return false
  for (const img of document.images) if (img.complete && img.naturalWidth > 0 && (img.currentSrc === url || img.src === url)) return true
  return false
}

function mountStage(view: StageView): HTMLElement | null {
  try {
    flushSync(() => launchStage.set(view))
  } catch {
    launchStage.set(view)
  }
  const el = document.querySelector<HTMLElement>('body > .launch-stage')
  return el && el.dataset.key === String(view.key) ? el : null
}

function unmountStage(key: number): void {
  const cur = launchStage.get()
  if (!cur || cur.key !== key) return
  try {
    flushSync(() => launchStage.set(null))
  } catch {
    launchStage.set(null)
  }
}

/** Le filet de la carte s'allume une fois quand le lien part après la scène (ou sans scène). */
function igniteCardWhenHanded(ctx: VisualCtx): void {
  const check = (): boolean => {
    const ph = handedPhase(ctx.get())
    if (!ph) return false
    if (ph !== 'failed' && ph !== 'already' && fx()) {
      const a = anim(cardEl(ctx.launchId)?.querySelector('.launch-ignite'), LKF.ignite.frames, LKF.ignite.opts)
      if (a) a.onfinish = () => a.cancel()
    }
    return true
  }
  if (check()) return
  const off = ctx.subscribe(() => {
    if (check()) stop()
  })
  const t = setTimeout(() => stop(), 10_000)
  const stop = (): void => {
    off()
    clearTimeout(t)
  }
}

/** Allumage dans la fiche : une onde et un reflet sur sa jaquette, au moment où le lien part. */
export function igniteLocal(el: Element | null | undefined): void {
  if (!el || !fx()) return
  const shock = document.createElement('span')
  shock.className = 'launch-shock'
  const sheen = document.createElement('span')
  sheen.className = 'launch-sheen'
  for (const s of [shock, sheen]) s.setAttribute('aria-hidden', 'true')
  el.append(shock, sheen)
  anim(shock, LKF.shock.frames, LKF.shock.opts)
  anim(sheen, LKF.sheen.frames, LKF.sheen.opts)
  setTimeout(() => {
    shock.remove()
    sheen.remove()
  }, 520)
}

/** Point d'entrée (store.ts), juste après l'IPC et le rendu de la carte. */
export function playLaunchVisual(ctx: VisualCtx): void {
  // Une scène encore à l'écran laisse la place.
  current?.fade()
  if (ctx.entrance === 'stage') return playStage(ctx)
  if (ctx.entrance === 'glide') return playGlide(ctx)
  if (ctx.entrance === 'sheet') return playSheet(ctx)
}

// ---------- mise à feu (Full) ----------

/** Mise à feu au plus tôt à 280 ms, seulement si le lien part avant 560 ms ; départ au plus tard à 700 ms. */
const F_MIN = 280
const F_LATEST = 560
const D_MAX = 700
const IGNITE_TO_DEPART = 300
const FLIGHT_MS = 280
/** Quoi qu'il arrive, la scène est démontée à 1,6 s. */
const WATCHDOG_MS = 1600

function playStage(ctx: VisualCtx): void {
  const contentEl = document.querySelector('.shell > .content')
  if (!contentEl) return playGlide(ctx)
  const content = box(contentEl.getBoundingClientRect())
  const src = sourceBox(ctx.from)
  const g = ctx.game
  const bandUrl = decoded(g.heroUrl) ? g.heroUrl! : decoded(g.coverUrl) ? g.coverUrl! : null
  const key = ++stageKey
  const view: StageView = { key, launchId: ctx.launchId, mode: 'stage', game: g, name: ctx.name, demo: ctx.demo, bandUrl, content, after: false }
  const root = mountStage(view)
  if (!root) return playGlide(ctx)

  const run = new Run()
  const t0 = performance.now()
  const q = (s: string): HTMLElement | null => root.querySelector<HTMLElement>(s)
  const card = cardEl(ctx.launchId)
  const thumb = card?.querySelector<HTMLElement>('.launch-thumb') ?? null
  // La carte attend sous la scène : invisible, vignette cachée (la jaquette va s'y poser).
  if (card) card.style.opacity = '0'
  if (thumb) thumb.style.visibility = 'hidden'

  let ignitedAt: number | null = null
  let departed = false
  let over = false
  let lateIgnite = false

  const restoreCard = (): void => {
    if (card) {
      card.style.opacity = ''
      for (const a of card.getAnimations()) a.cancel()
    }
    if (thumb) thumb.style.visibility = ''
  }

  const finish = (): void => {
    if (over) return
    over = true
    run.dispose()
    restoreCard()
    unmountStage(key)
    if (current?.launchId === ctx.launchId) current = null
    if (lateIgnite) igniteCardWhenHanded(ctx)
  }

  /** Sortie douce (fenêtre quittée, clic, molette, Échap) : la carte se pose tout de suite, la scène s'efface. */
  const fade = (): void => {
    if (over) return
    over = true
    restoreCard()
    const a = run.settle('fade', root)
    run.dispose()
    const done = (): void => {
      unmountStage(key)
      if (current?.launchId === ctx.launchId) current = null
    }
    if (a) a.finished.then(done, done)
    else done()
    setTimeout(done, 220)
    if (ignitedAt === null) igniteCardWhenHanded(ctx)
  }
  current = { launchId: ctx.launchId, fade }

  // ----- prise -----
  const poster = q('.launch-poster')
  const pr = poster ? box(poster.getBoundingClientRect()) : null
  run.play(q('.launch-veil'), LKF.veilIn)
  if (poster && pr && src) {
    const f = flipFrom(src, pr)
    run.play(poster, LKF.posterFrom(f.dx, f.dy, f.s, ratioMismatch(src, pr)))
  } else run.play(poster, LKF.posterIn)
  run.play(q('.launch-band'), LKF.bandIn)
  ;['.launch-kicker', '.launch-title', '.launch-sub'].forEach((s, i) => run.play(q(s), LKF.textRise(i)))

  // ----- mise à feu, quand Windows a transmis le lien -----
  const ignite = (): void => {
    if (over) return
    run.play(q('.launch-shock'), LKF.shock)
    run.play(q('.launch-sheen'), LKF.sheen)
    launchStage.set((v) => (v && v.key === key ? { ...v, after: true } : v))
  }

  const depart = (): void => {
    if (over || departed) return
    departed = true
    run.play(q('.launch-text'), LKF.textOut)
    run.play(q('.launch-veil'), LKF.stageOut)
    run.play(q('.launch-band'), LKF.stageOut)
    const tr = thumb ? box(thumb.getBoundingClientRect()) : null
    if (poster && pr && tr && tr.width > 0) run.play(poster, LKF.posterTo(tr.left - pr.left, tr.top - pr.top, tr.width / pr.width))
    else run.play(poster, LKF.stageOut)
    if (card) {
      card.style.opacity = ''
      // Entre sous la jaquette qui se pose, puis revient à son état CSS (rien ne reste dans getAnimations()).
      const a = anim(card, LKF.cardLand.frames, { ...LKF.cardLand.opts })
      if (a) a.onfinish = () => a.cancel()
    }
    run.later(FLIGHT_MS, finish)
  }

  const onHanded = (): void => {
    if (over || departed || ignitedAt !== null) return
    const ph = handedPhase(ctx.get())
    if (!ph) return
    const t = performance.now() - t0
    if (t > F_LATEST) return
    if (ph === 'failed') {
      // Refusé : pas de mise à feu, la carte se pose en « Lancement impossible ».
      ignitedAt = -1
      run.later(F_LATEST - t, depart)
      return
    }
    const F = Math.max(F_MIN, t)
    ignitedAt = F
    run.later(F - t, ignite)
    run.later(Math.min(F + IGNITE_TO_DEPART, D_MAX) - t, depart)
  }

  run.on(ctx.subscribe(onHanded))
  onHanded()
  // Toujours rien à 560 ms : départ sans mise à feu, le filet de la carte s'allumera à l'arrivée du lien.
  run.later(F_LATEST, () => {
    if (ignitedAt !== null) return
    ignitedAt = -1
    lateIgnite = true
    depart()
  })
  run.later(WATCHDOG_MS, finish)

  // ----- sorties -----
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    fade()
  }
  const onLeave = (): void => fade()
  const onHidden = (): void => {
    if (document.hidden) fade()
  }
  addEventListener('keydown', onKey, true)
  addEventListener('pointerdown', onLeave, true)
  addEventListener('wheel', onLeave, { capture: true, passive: true })
  addEventListener('blur', onLeave)
  document.addEventListener('visibilitychange', onHidden)
  run.on(() => {
    removeEventListener('keydown', onKey, true)
    removeEventListener('pointerdown', onLeave, true)
    removeEventListener('wheel', onLeave, true)
    removeEventListener('blur', onLeave)
    document.removeEventListener('visibilitychange', onHidden)
  })
}

// ---------- glissé (effets coupés, ou mise à feu déjà vue) ----------

const GLIDE_MS = 280

function playGlide(ctx: VisualCtx): void {
  const card = cardEl(ctx.launchId)
  if (!card) return igniteCardWhenHanded(ctx)
  const thumb = card.querySelector<HTMLElement>('.launch-thumb')
  // Place finale de la vignette, lue avant que la carte ne bouge.
  const tr = thumb ? box(thumb.getBoundingClientRect()) : null
  const t = tier()
  const enter = t === 'full' ? KF.cardIn : KF.cardInSober
  const a = anim(card, enter.frames, { ...enter.opts, level: 'sober' })
  if (a) a.onfinish = () => a.cancel()
  igniteCardWhenHanded(ctx)

  const src = sourceBox(ctx.from)
  if (!thumb || !tr || !src || tr.width <= 0) return
  const key = ++stageKey
  const ghost = mountStage({
    key,
    launchId: ctx.launchId,
    mode: 'glide',
    game: ctx.game,
    name: ctx.name,
    demo: ctx.demo,
    bandUrl: null,
    content: { left: 0, top: 0, width: innerWidth, height: innerHeight },
    after: false,
    ghost: tr
  })?.querySelector<HTMLElement>('.launch-ghost')
  if (!ghost) return unmountStage(key)
  thumb.style.visibility = 'hidden'
  const f = flipFrom(src, tr)
  const g = LKF.thumbGlide(f.dx, f.dy, f.s)
  const ga = anim(ghost, g.frames, { ...g.opts, level: 'sober' })
  let done = false
  const end = (): void => {
    if (done) return
    done = true
    thumb.style.visibility = ''
    unmountStage(key)
  }
  if (ga) ga.finished.then(end, end)
  else end()
  setTimeout(end, GLIDE_MS + 200)
}

// ---------- depuis la fiche ----------

function playSheet(ctx: VisualCtx): void {
  const poster = ctx.from?.closest('.sheet-root')?.querySelector('.sheet-poster')
  const check = (): boolean => {
    const ph = handedPhase(ctx.get())
    if (!ph) return false
    if (ph !== 'failed' && ph !== 'already') igniteLocal(poster)
    return true
  }
  if (check()) return
  const off = ctx.subscribe(() => {
    if (check()) stop()
  })
  const t = setTimeout(() => stop(), 10_000)
  const stop = (): void => {
    off()
    clearTimeout(t)
  }
}
