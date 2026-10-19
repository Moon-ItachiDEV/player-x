// Scène plein écran des mises à jour : le saut (redémarrage → fermeture) et le retour (premier lancement après la mise à jour).
// CONTRAT partagé par la carte (UpdateNotice), Quoi de neuf, À propos et l'aperçu. Spec Séquence Réacteur §7 (saut) et §8 (retour).
// Règle du saut : l'IPC part d'abord, l'animation ensuite. Quoi qu'il arrive à l'animation, main a l'ordre, et l'interface n'est jamais bloquée.
import { flushSync } from 'react-dom'
import type { InstallResult } from '@shared/types'
import type { Notify } from '../components/ui/Toasts'
import { duration } from './format'
import { KF, type KeyframeSet } from './keyframes'
import {
  anim,
  createStore,
  initialTier,
  isIdle,
  lastUpdate,
  PREVIOUS_VERSION,
  thisBootUpdate,
  tier,
  UPDATED_THIS_LAUNCH,
  VERSION,
  type AnimOpts,
  type Tier
} from './session'
import { runStreaks, stopAllStreaks, type StreakRun } from './streaks'

export type StageMode = 'idle' | 'warp' | 'reveal'
export type StagePhase = 'hold' | 'run' | 'exit'

export interface StageState {
  mode: StageMode
  phase: StagePhase
  tier: Tier
  /** Centre d'aspiration (réacteur ou bouton), en px de fenêtre. */
  origin: { x: number; y: number } | null
  version: string
  preview: boolean
}

export const STAGE_IDLE: StageState = { mode: 'idle', phase: 'run', tier: 'full', origin: null, version: '', preview: false }

const LOADED_AT = performance.now()
/** `${version}|${installedAt}` du dernier retour joué : un rechargement ou un plantage ne le rejoue jamais. */
const REVEALED_KEY = 'pg.update.revealed'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* stockage indisponible : le retour pourrait rejouer au prochain lancement */
  }
}

/** Palier lu avant le premier effet d'App : c'est lui qui règle le retour (data-tier de la scène). */
const startTier = initialTier()

/** Ce lancement suit une mise à jour et le retour (allumage) doit jouer dès le premier rendu. */
export const REVEAL_AT_BOOT = UPDATED_THIS_LAUNCH && startTier !== 'reduced' && !read(REVEALED_KEY)?.startsWith(`${VERSION}|`)
// Le vrai logo du rail reste caché : la marque de la scène s'y posera.
if (REVEAL_AT_BOOT) document.documentElement.classList.add('px-revealing')

const revealState = (t: Tier, preview: boolean, phase: StagePhase): StageState => ({
  mode: 'reveal',
  phase,
  tier: t,
  origin: null,
  version: VERSION,
  preview
})

/** Premier rendu d'un retour : voile opaque et marque en M, immobiles (l'image finale du saut, sans le texte). */
export const stage = createStore<StageState>(REVEAL_AT_BOOT ? revealState(startTier, false, 'hold') : STAGE_IDLE)

/** true une fois le retour fini, ou s'il n'y en a pas : Quoi de neuf attend ce signal. */
export const revealDone = createStore<boolean>(!REVEAL_AT_BOOT)

/** Version dont le redémarrage a échoué : la carte ne relance plus le compte à rebours pour elle. */
export const restartBlocked = createStore<string | null>(null)

export interface RestartRequest {
  version: string
  /** Rectangle du réacteur ou du bouton : l'interface est aspirée vers son centre. */
  origin: DOMRect | null
  /** Élément qui reprend le focus si le redémarrage échoue. */
  trigger: HTMLElement | null
  /** Aperçu : rien n'est installé, la fenêtre ne se ferme pas. */
  preview?: boolean
}

// ---------- ce qu'affiche la scène (UpdateStage.tsx) ----------

export interface RevealChip {
  key: 'signed' | 'download' | 'back'
  label: string
  /** Début de l'empreinte, en chasse fixe. */
  mono?: string
  title?: string
}

export interface RevealInfo {
  kicker: string
  /** Version d'avant, ou null (aucune flèche). */
  from: string | null
  to: string
  /** Seulement des valeurs mesurées : une puce inconnue n'est pas affichée. */
  chips: RevealChip[]
  skipHint: boolean
}

/** Contenu du retour, figé au début de la chronologie (rien n'apparaît en cours de route). */
export const revealInfo = createStore<RevealInfo | null>(null)

/** Région polie de la scène : redémarrage, retour, début et fin de l'aperçu (§13.9). */
export const stageAnnounce = createStore<string>('')

export function announceStage(text: string): void {
  // Même phrase deux fois de suite : une espace insécable la fait relire.
  stageAnnounce.set((p) => (p === text ? `${text} ` : text))
}

/** Toast d'abandon : la scène est dans ToastProvider, UpdateStage branche son notify ici. */
let notify: Notify | null = null
export function bindStageNotify(n: Notify): () => void {
  notify = n
  return () => {
    if (notify === n) notify = null
  }
}

// ---------- montage de la scène ----------

const stageEl = (): HTMLElement | null => document.querySelector<HTMLElement>('body > .stage')

const waiters = new Set<{ want: StageState; done: (el: HTMLElement | null) => void }>()

/** UpdateStage, après chaque rendu de la scène (useLayoutEffect, avant l'affichage). */
export function stageCommitted(): void {
  const cur = stage.get()
  const el = stageEl()
  for (const w of [...waiters]) {
    if (cur !== w.want) w.done(null)
    else if (el && el.dataset.mode === cur.mode) w.done(el)
  }
}

/**
 * Pose l'état de la scène et attend son rendu. flushSync suffit d'habitude ; appelé depuis un effet React,
 * le rendu arrive au useLayoutEffect suivant. null si un autre état est passé entre-temps.
 */
function show(next: StageState, before?: () => void): Promise<HTMLElement | null> {
  try {
    flushSync(() => {
      before?.()
      stage.set(next)
    })
  } catch {
    before?.()
    stage.set(next)
  }
  const el = stageEl()
  if (stage.get() !== next) return Promise.resolve(null)
  if (el && el.dataset.mode === next.mode && el.dataset.phase === next.phase) return Promise.resolve(el)
  return new Promise((resolve) => {
    const w = {
      want: next,
      done: (e: HTMLElement | null): void => {
        waiters.delete(w)
        clearTimeout(t)
        resolve(e)
      }
    }
    const t = setTimeout(() => w.done(stage.get() === next ? stageEl() : null), 400)
    waiters.add(w)
  })
}

/** Animations de la scène (WAAPI et fondus CSS du saut sobre). */
const stageAnimations = (): Animation[] => stageEl()?.getAnimations({ subtree: true }) ?? []

function setShellInert(on: boolean): void {
  const shell = document.querySelector('.shell')
  if (on) {
    // Le focus part sur body : rien dans l'interface figée ne le garde.
    const a = document.activeElement
    if (a instanceof HTMLElement && a !== document.body) a.blur()
    shell?.setAttribute('inert', '')
  } else shell?.removeAttribute('inert')
}

/** M : centre de la marque, (50 %, 50 % − 40 px). Le même au saut et au retour. */
const markPoint = (): { x: number; y: number } => ({ x: innerWidth / 2, y: innerHeight / 2 - 40 })

function centerOf(r: DOMRect | null): { x: number; y: number } | null {
  if (!r || r.width + r.height <= 0) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** Sortie qui part de l'état actuel (une entrée encore en cours ne saute pas) : sans la première image clé. */
const fromNow = (k: KeyframeSet): KeyframeSet => ({ frames: k.frames.slice(-1), opts: k.opts })

const twoFrames = (): Promise<void> =>
  new Promise((resolve) => {
    // Fenêtre masquée : pas d'images, on n'attend pas.
    const t = setTimeout(resolve, 100)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(t)
        resolve()
      })
    )
  })

/** Minuteries, animations, écouteurs et traînées d'une course de la scène : tout se range d'un coup. */
class Run {
  anims: Animation[] = []
  streaks: StreakRun | null = null
  private timers: ReturnType<typeof setTimeout>[] = []
  private offs: (() => void)[] = []

  play(el: Element | null | undefined, k: KeyframeSet, o: AnimOpts = {}): Animation | null {
    const a = anim(el, k.frames, { ...k.opts, ...o })
    if (a) this.anims.push(a)
    return a
  }

  later(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, Math.max(0, ms)))
  }

  on(off: () => void): void {
    this.offs.push(off)
  }

  settle(how: 'finish' | 'cancel'): void {
    this.streaks?.stop()
    for (const a of this.anims) {
      try {
        if (how === 'finish') a.finish()
        else a.cancel()
      } catch {
        /* pseudo-élément déjà disparu */
      }
    }
  }

  dispose(): void {
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
    for (const off of this.offs.splice(0)) off()
    this.streaks?.stop()
  }
}

// ---------- saut (§7) ----------

const DELAY: Record<Tier | 'hidden', number> = { full: 1200, sober: 450, reduced: 150, hidden: 0 }
/** Toujours pas fermé à delay + 10 s : on rend la main. */
const WATCHDOG_MS = 10_000
/** L'image finale est posée 120 ms avant la fermeture prévue. */
const SAFETY_MS = 120

type AbortReason = 'refused' | 'ipc' | 'ready' | 'watchdog'

interface Warp {
  start(): void
  armSafety(quitAt: number): void
  finalFrame(): void
  abort(reason: AbortReason): void
  /** Range tout sans toast ni blocage (fin d'aperçu, scène remise à zéro). */
  dispose(): void
}

let warp: Warp | null = null

/** Pilote de l'aperçu (preview.ts) : lui seul permet un saut d'aperçu, et il est prévenu de son début et de sa fin. */
export interface PreviewDriver {
  warpStarted(): void
  /** Moment où la vraie fenêtre se fermerait : l'aperçu enchaîne sur le retour. */
  warpEnded(): void
}
let previewDriver: PreviewDriver | null = null
export function setPreviewDriver(d: PreviewDriver | null): void {
  previewDriver = d
}

function createWarp(o: RestartRequest, t: Tier | 'hidden', delayMs: number): Warp {
  const run = new Run()
  const root = document.documentElement
  const preview = !!o.preview
  const C = centerOf(o.origin) ?? { x: innerWidth / 2, y: innerHeight / 2 }
  const base: StageState = { mode: 'warp', phase: 'run', tier: t === 'hidden' ? 'full' : t, origin: C, version: o.version, preview }
  let over = false
  /** L'image finale est posée : une transition de vue prête trop tard ne relance plus la chronologie. */
  let final = false
  let accepted = false
  let installing = false
  let transition: ViewTransition | null = null

  const self: Warp = {
    start() {
      // Refusé avant même de commencer (réponse immédiate) : rien à montrer.
      if (over) return
      if (!preview) announceStage(`Redémarrage de Player X pour installer la ${o.version}.`)
      if (t === 'full') return startFull()
      // Sobre : fondus CSS dès le montage (stage.css). Réduit : l'image finale tout de suite.
      void show(base)
      setShellInert(true)
    },

    armSafety(quitAt) {
      accepted = true
      if (over) return
      if (t !== 'hidden') run.later(quitAt - SAFETY_MS - Date.now(), () => self.finalFrame())
      if (preview) run.later(quitAt - Date.now(), endPreview)
    },

    finalFrame() {
      if (over) return
      final = true
      run.settle('finish')
      for (const a of stageAnimations()) {
        try {
          a.finish()
        } catch {
          /* rien à finir */
        }
      }
      try {
        transition?.skipTransition()
      } catch {
        /* déjà finie */
      }
      const cur = stage.get()
      if (cur.mode !== 'warp' || cur.phase !== 'run') {
        void show(base)
        setShellInert(true)
      }
    },

    abort() {
      if (over) return
      over = true
      if (warp === self) warp = null
      run.dispose()
      const el = stage.get().mode === 'warp' ? stageEl() : null
      // Annuler les entrées ramène marque et texte à leur état CSS (visibles) : on les cache d'abord, seul le voile s'efface.
      el?.querySelector<HTMLElement>('.stage-fx')?.style.setProperty('visibility', 'hidden')
      run.settle('cancel')
      for (const a of stageAnimations()) a.cancel()
      try {
        transition?.skipTransition()
      } catch {
        /* déjà finie */
      }
      root.classList.remove('vt-warp', 'px-revealing')
      setShellInert(false)
      restartBlocked.set(o.version)
      stageAnnounce.set('')
      if (!preview) notify?.(`Le redémarrage n'a pas marché. Réessaie, ou ferme Player X pour installer la ${o.version}.`, { kind: 'error', id: 'update' })
      // Le focus revient au bouton qui a lancé le redémarrage (sinon « Redémarrer » de la carte), dès qu'il est utilisable.
      const refocus = (): void => {
        const a = document.activeElement
        if (a && a !== document.body) return
        const target = o.trigger?.isConnected ? o.trigger : document.querySelector<HTMLElement>('.upd-dock .upd-go')
        target?.focus()
      }
      refocus()
      let closed = false
      const close = (): void => {
        if (closed) return
        closed = true
        if (!warp && stage.get().mode === 'warp') stage.set(STAGE_IDLE)
        // Un nouveau saut a repris le même élément entre-temps : ni fondu (fill both, opacité 0) ni contenu caché.
        else {
          fade?.cancel()
          el?.querySelector<HTMLElement>('.stage-fx')?.style.removeProperty('visibility')
        }
        requestAnimationFrame(refocus)
      }
      const fade = el ? anim(el, KF.fadeOut(220).frames, { ...KF.fadeOut(220).opts, level: 'sober', whenIdle: true }) : null
      if (!fade) return close()
      fade.finished.then(close, close)
      setTimeout(close, 400)
    },

    dispose() {
      over = true
      if (warp === self) warp = null
      run.dispose()
      run.settle('cancel')
      try {
        transition?.skipTransition()
      } catch {
        /* déjà finie */
      }
      root.classList.remove('vt-warp')
    }
  }

  if (!preview) {
    run.later(delayMs + WATCHDOG_MS, () => self.abort('watchdog'))
    try {
      run.on(
        window.launcher.onUpdateState((s) => {
          if (s.state === 'installing') installing = true
          // quitAndInstall a échoué, ou le filet de 8 s de main a sauté : la mise à jour redevient « prête ».
          else if (s.state === 'ready' && (installing || accepted)) self.abort('ready')
        })
      )
    } catch {
      /* pas d'événements : le chien de garde suffit */
    }
  }

  /** Aperçu : la fenêtre « se ferme » ici. Le texte s'efface, voile et marque restent jusqu'au retour. */
  function endPreview(): void {
    if (over) return
    over = true
    if (warp === self) warp = null
    run.dispose()
    const text = stageEl()?.querySelector('.stage-text')
    anim(text, KF.fadeOut(240).frames, { ...KF.fadeOut(240).opts, level: 'sober' })
    if (previewDriver) previewDriver.warpEnded()
    else resetStage()
  }

  /** Full : l'interface est aspirée dans le réacteur (instantané de transition de vue), sinon le voile monte sur l'interface vivante. */
  function startFull(): void {
    const canVT = typeof document.startViewTransition === 'function' && !root.classList.contains('vt-active') && !document.hidden
    const go = (viaVT: boolean): void => {
      if (over || final) return
      void show(base).then((el) => {
        if (el && !over && !final) timeline(el, viaVT)
      })
    }
    if (canVT) {
      try {
        root.classList.add('vt-warp')
        transition = document.startViewTransition(() => {
          if (over || final) return
          setShellInert(true)
          // Monté en « hold » : rien au-dessus du voile tant que la chronologie n'a pas démarré.
          return show({ ...base, phase: 'hold' }).then(() => {})
        })
      } catch {
        transition = null
        root.classList.remove('vt-warp')
      }
    }
    if (!transition) {
      go(false)
      setShellInert(true)
      return
    }
    const vt = transition
    run.on(() => root.classList.remove('vt-warp'))
    vt.ready.then(
      () => go(true),
      () => go(false)
    )
    vt.finished
      .catch(() => {})
      .finally(() => {
        root.classList.remove('vt-warp')
        if (transition === vt) transition = null
      })
  }

  /** §7.3, t = 0 quand la transition est prête (ou au montage sans transition). Tout finit avant 1000 ms. */
  function timeline(el: HTMLElement, viaVT: boolean): void {
    const q = (s: string): HTMLElement | null => el.querySelector<HTMLElement>(s)
    const M = markPoint()
    const canvas = el.querySelector<HTMLCanvasElement>('.stage-canvas')
    if (canvas && !isIdle()) {
      run.streaks = runStreaks(canvas, [
        { mode: 'aspire', at: 0, dur: 480, origin: C },
        { mode: 'burst', at: 540, dur: 360, origin: M }
      ])
    }
    if (viaVT) run.play(root, KF.oldRoot(C.x, C.y), { pseudoElement: '::view-transition-old(root)' })
    else run.play(q('.stage-veil'), KF.veilIn)
    run.play(q('.stage-flash'), KF.flash)
    // Le cœur du réacteur devient le logo.
    run.play(q('.stage-mark'), KF.markFly(C.x - M.x, C.y - M.y))
    const ring = q('.stage-ring')
    run.play(ring, KF.ringLight)
    // fill 'forwards' : avant 720 ms, c'est ringLight qui tient la couronne éteinte.
    run.play(ring, KF.ringOut, { fill: 'forwards' })
    run.play(q('.stage-text'), KF.warpText)
    run.play(q('.stage-badge'), KF.warpText)
    run.play(canvas, KF.canvasOut)
  }

  return self
}

/** Seule porte vers installUpdate depuis l'interface : l'IPC part d'abord, l'animation ensuite. */
export function requestRestart(o: RestartRequest): void {
  if (warp) return
  if (o.preview && !previewDriver) return
  const t: Tier | 'hidden' = document.hidden ? 'hidden' : tier()
  const delayMs = DELAY[t]
  // 1. L'IPC D'ABORD, avant tout travail visuel, dans son propre try : quoi qu'il arrive à l'animation, main a l'ordre.
  let result: Promise<InstallResult | void>
  if (o.preview) result = Promise.resolve({ ok: true, quitAt: Date.now() + delayMs })
  else {
    try {
      result = Promise.resolve(window.launcher.installUpdate({ delayMs }))
    } catch (e) {
      result = Promise.reject(e)
    }
  }
  // Un retour encore à l'écran laisse la place.
  if (reveal) finishReveal(reveal, false)
  const s = createWarp(o, t, delayMs)
  warp = s
  result.then(
    (r) => (r && r.ok === false ? s.abort('refused') : s.armSafety(r?.quitAt ?? Date.now() + delayMs)),
    () => s.abort('ipc')
  )
  if (o.preview) previewDriver?.warpStarted()
  if (t === 'hidden') return
  // 2. L'animation, juste après (même image) : hors du rendu de React si l'appel vient d'un effet, pour que flushSync monte la scène.
  // Une exception est rattrapée : main ferme de toute façon à l'heure dite.
  queueMicrotask(() => {
    try {
      s.start()
    } catch (e) {
      console.error(e)
      s.finalFrame()
    }
  })
}

/** Un saut est en cours (redémarrage demandé). */
export function warpActive(): boolean {
  return stage.get().mode === 'warp'
}

// ---------- retour (§8) ----------

type Variant = 'cinematic' | 'sober' | 'quiet'

interface Reveal {
  preview: boolean
  run: Run
  phase: 'hold' | 'run' | 'exit' | 'done'
  variant: Variant | null
  /** Passé pendant l'attente : on file vers la sortie dès que l'interface est là. */
  skipped: boolean
  /** Fenêtre sans focus mais tout juste relancée (§8.2) : la chronologie joue quand même. */
  idleOk: boolean
  t0: number
  holdCheck: (() => void) | null
  disarm: () => void
  done: Promise<void>
  resolve: () => void
}

let reveal: Reveal | null = null

function createReveal(preview: boolean, t0 = performance.now()): Reveal {
  let resolve!: () => void
  const done = new Promise<void>((r) => (resolve = r))
  return { preview, run: new Run(), phase: 'hold', variant: null, skipped: false, idleOk: false, t0, holdCheck: null, disarm: () => {}, done, resolve }
}

function buildInfo(preview: boolean, skipHint: boolean): RevealInfo {
  // Aperçu : seulement une mise à jour enregistrée qui a installé la version qui tourne (des faits, pas une démo).
  const stored = lastUpdate.get().value
  const lu = preview ? (stored && stored.to === VERSION ? stored : null) : thisBootUpdate()
  let from = preview ? null : (lu?.from ?? PREVIOUS_VERSION)
  if (from === VERSION) from = null
  const chips: RevealChip[] = []
  if (lu?.fingerprint) chips.push({ key: 'signed', label: 'Signée · ', mono: lu.fingerprint.slice(0, 8), title: lu.fingerprint })
  if (lu?.downloadMs !== undefined) chips.push({ key: 'download', label: `Téléchargée en ${duration(lu.downloadMs)}` })
  if (lu?.backMs !== undefined) chips.push({ key: 'back', label: `De retour en ${duration(lu.backMs)}` })
  return { kicker: preview ? 'Aperçu · mise à jour installée' : 'Mise à jour installée', from, to: VERSION, chips, skipHint }
}

/** Le clic qui suit le pointerdown avalé n'atteint pas l'interface non plus. */
function swallowClick(): void {
  const eat = (e: Event): void => {
    e.stopPropagation()
    e.preventDefault()
  }
  addEventListener('click', eat, { capture: true, once: true })
  setTimeout(() => removeEventListener('click', eat, true), 800)
}

/** Passé avec un modificateur (Ctrl+K…) : la touche du raccourci qui suit n'atteint pas Shell non plus. */
function swallowChord(mod: string): void {
  const eat = (e: KeyboardEvent): void => {
    if (!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) return
    e.stopPropagation()
    e.preventDefault()
  }
  const off = (): void => {
    removeEventListener('keydown', eat, true)
    removeEventListener('keyup', up, true)
  }
  const up = (e: KeyboardEvent): void => {
    if (e.key === mod) off()
  }
  addEventListener('keydown', eat, true)
  addEventListener('keyup', up, true)
  setTimeout(off, 800)
}

/** §8.6 : la première touche ou le premier clic passe le retour, et n'atteint jamais les raccourcis de Shell. */
function armSkip(r: Reveal): void {
  const onSkip = (e: Event): void => {
    e.stopPropagation()
    e.preventDefault()
    r.disarm()
    if (e.type === 'pointerdown') swallowClick()
    else if (e instanceof KeyboardEvent && /^(Control|Shift|Alt|Meta|AltGraph)$/.test(e.key)) swallowChord(e.key)
    if (r.phase === 'hold') {
      r.skipped = true
      r.holdCheck?.()
    } else if (r.phase === 'run') exitReveal(r, true)
  }
  const opts = { capture: true, once: true } as const
  addEventListener('keydown', onSkip, opts)
  addEventListener('pointerdown', onSkip, opts)
  r.disarm = () => {
    removeEventListener('keydown', onSkip, true)
    removeEventListener('pointerdown', onSkip, true)
  }
  r.run.on(() => r.disarm())
}

/** §8.3 : jusqu'à ce que .boot disparaisse (au moins 400 ms en Full, 300 en sobre ; au plus 1500), puis 2 images. */
function hold(r: Reveal): Promise<void> {
  return new Promise((resolve) => {
    const rootEl = document.getElementById('root')
    const min = startTier === 'full' ? 400 : 300
    const since = (): number => performance.now() - r.t0
    const uiUp = (): boolean => !!rootEl?.firstElementChild && !rootEl.querySelector('.boot')
    let over = false
    const end = (): void => {
      if (over) return
      over = true
      mo.disconnect()
      r.holdCheck = null
      // La première image peinte de l'interface existe sous le voile.
      void twoFrames().then(resolve)
    }
    // Le minuteur du minimum le constate lui-même : setTimeout arrondit, since() peut y lire 399,8 ms pour 400.
    let minOk = false
    const check = (): void => {
      if (uiUp() && (r.skipped || minOk || since() >= min)) end()
    }
    const mo = new MutationObserver(check)
    if (rootEl) mo.observe(rootEl, { childList: true, subtree: true })
    r.holdCheck = check
    r.run.later(min - since(), () => {
      minOk = true
      check()
    })
    r.run.later(1500 - since(), end)
    r.run.on(() => {
      over = true
      mo.disconnect()
    })
  })
}

function bootReveal(t0: number): void {
  const r = createReveal(false, t0)
  reveal = r
  // Écrit au début : un rechargement ou un plantage ne le rejoue jamais.
  write(REVEALED_KEY, `${VERSION}|${thisBootUpdate()?.installedAt ?? 0}`)
  armSkip(r)
  // Filet : quoi qu'il arrive, l'interface revient 5 s après le montage (attente ≤ 1,5 s + chronologie 2 s + marge).
  r.run.later(5000 - (performance.now() - t0), () => finishReveal(r))
  void hold(r).then(() => {
    if (reveal === r && r.phase === 'hold') startReveal(r, startTier)
  })
}

/** Fin de l'attente (ou retour d'aperçu, sans attente) : choisit la variante (§8.2) et lance sa chronologie. */
function startReveal(r: Reveal, t: Tier): void {
  if (document.hidden || t === 'reduced') return finishReveal(r)
  const lu = r.preview ? null : thisBootUpdate()
  if (!r.preview) {
    write(REVEALED_KEY, `${VERSION}|${lu?.installedAt ?? 0}`)
    announceStage(`Player X ${VERSION} est installée.`)
  }
  const focused = !isIdle()
  // Tu viens de cliquer « Redémarrer » : Windows n'a peut-être pas rendu le focus, la séquence joue quand même.
  const recent = lu?.relaunch === true && lu.backMs !== undefined
  r.idleOk = !focused
  r.variant = t === 'full' && lu?.relaunch !== false && (focused || recent) ? 'cinematic' : focused ? 'sober' : 'quiet'
  const state = (phase: StagePhase): StageState => revealState(t, r.preview, phase)

  if (r.variant === 'quiet' || r.skipped) {
    // Sans contenu : la sortie (rapide si passé), ou le fondu calme de 260 ms.
    r.phase = r.variant === 'quiet' ? 'exit' : 'run'
    void show(state('exit'), () => revealInfo.set(null)).then((el) => {
      if (reveal !== r) return
      if (!el) return finishReveal(r)
      if (r.variant !== 'quiet') return exitReveal(r, true)
      const o: AnimOpts = { level: 'sober', whenIdle: true }
      r.run.play(el.querySelector('.stage-veil'), KF.fadeOut(260), o)
      r.run.play(el.querySelector('.stage-mark'), KF.fadeOut(260), o)
      r.run.later(260, () => finishReveal(r))
    })
    return
  }

  r.phase = 'run'
  const info = buildInfo(r.preview, r.variant === 'cinematic')
  void show(state('run'), () => revealInfo.set(info)).then((el) => {
    if (reveal !== r || r.phase !== 'run') return
    if (!el) return finishReveal(r)
    if (r.variant === 'sober') {
      // §8.5 : tout le contenu ensemble, tient jusqu'à 860 ms, puis tout s'efface.
      r.run.play(el.querySelector('.stage-text'), KF.fade(260), { level: 'sober' })
      r.run.later(860, () => exitReveal(r, false))
      return
    }
    cinematic(r, el)
  })
}

/** §8.4, t = 0 à la fin de l'attente. */
function cinematic(r: Reveal, el: HTMLElement): void {
  const o: AnimOpts = { whenIdle: r.idleOk }
  const all = (s: string): HTMLElement[] => [...el.querySelectorAll<HTMLElement>(s)]
  const canvas = el.querySelector<HTMLCanvasElement>('.stage-canvas')
  if (canvas && (r.idleOk || !isIdle())) r.run.streaks = runStreaks(canvas, [{ mode: 'arrive', at: 0, dur: 600, origin: markPoint() }])
  all('.stage-ring g').forEach((g, i) => r.run.play(g, KF.ringGroup(i), o))
  r.run.play(el.querySelector('.stage-kicker'), KF.kicker, o)
  all('.stage-from, .stage-arrow').forEach((e) => r.run.play(e, KF.from, o))
  all('.stage-to > span').forEach((e, i) => r.run.play(e, KF.toChar(i), o))
  all('.stage-chip').forEach((e, i) => r.run.play(e, KF.chip(i), o))
  r.run.play(el.querySelector('.stage-skip'), KF.skipIn, o)
  r.run.later(1400, () => exitReveal(r, false))
}

/** Sortie à 1400 ms, ou tout de suite (passé) compressée à 300 ms : contenu et couronne en 150, marque et voile en 300. */
function exitReveal(r: Reveal, fast: boolean): void {
  if (r.phase !== 'run') return
  r.phase = 'exit'
  // L'entrée passe à l'interface à partir d'ici.
  r.disarm()
  const el = stageEl()
  if (!el) return finishReveal(r)
  stage.set((s) => (s.mode === 'reveal' ? { ...s, phase: 'exit' } : s))
  const q = (s: string): HTMLElement | null => el.querySelector<HTMLElement>(s)
  if (r.variant === 'sober') {
    const ms = fast ? 150 : 200
    const o: AnimOpts = { level: 'sober', whenIdle: r.idleOk }
    for (const s of ['.stage-veil', '.stage-mark', '.stage-text']) r.run.play(q(s), fromNow(KF.fadeOut(ms)), o)
    r.run.later(ms, () => finishReveal(r))
    return
  }
  const o: AnimOpts = { whenIdle: r.idleOk }
  const content = fast ? 150 : 240
  r.run.play(q('.stage-text'), fromNow(KF.contentOut), { ...o, duration: content })
  r.run.play(q('.stage-skip'), fromNow(KF.contentOut), { ...o, duration: content })
  r.run.play(q('.stage-ring'), fromNow(KF.ringExit), { ...o, duration: fast ? 150 : 400 })
  r.run.play(q('.stage-shock'), KF.shock, { ...o, duration: fast ? 250 : 500 })
  if (fast) r.run.play(q('.stage-canvas'), fromNow(KF.fadeOut(150)), o)
  const flight = fast ? 300 : 600
  flyToRail(r, q('.stage-mark'), flight, o)
  r.run.play(q('.stage-veil'), fast ? KF.veilOut(250, 25) : KF.veilOut(), o)
  r.run.later(flight, () => finishReveal(r))
}

/** FLIP vers .rail-logo .brand-mark (rectangles lus une fois, maintenant) ; sans logo dans le rail, fondu sur place. */
function flyToRail(r: Reveal, mark: HTMLElement | null, ms: number, o: AnimOpts): void {
  if (!mark) return
  const a = mark.getBoundingClientRect()
  const b = document.querySelector('.rail-logo .brand-mark')?.getBoundingClientRect()
  if (b && b.width > 0 && b.height > 0 && a.height > 0) {
    const dx = b.left + b.width / 2 - (a.left + a.width / 2)
    const dy = b.top + b.height / 2 - (a.top + a.height / 2)
    r.run.play(mark, KF.markToRail(dx, dy, b.height / a.height, ms), o)
  } else r.run.play(mark, KF.markFadeInPlace, { ...o, duration: (ms * 400) / 600 })
}

/** Fin du retour : le vrai logo réapparaît là où la marque s'est posée, la scène se démonte, Quoi de neuf peut s'ouvrir. */
function finishReveal(r: Reveal, sync = true): void {
  if (r.phase === 'done') return
  r.phase = 'done'
  r.run.dispose()
  if (reveal === r) reveal = null
  const idle = (): void => {
    revealInfo.set(null)
    if (stage.get().mode === 'reveal') stage.set(STAGE_IDLE)
  }
  // Même image : logo du rail visible et scène démontée.
  document.documentElement.classList.remove('px-revealing')
  if (sync) {
    try {
      flushSync(idle)
    } catch {
      idle()
    }
  } else idle()
  revealDone.set(true)
  r.resolve()
}

function disposeReveal(r: Reveal): void {
  if (r.phase === 'done') return
  r.phase = 'done'
  r.run.dispose()
  r.run.settle('cancel')
  if (reveal === r) reveal = null
  r.resolve()
}

/** Retour de l'aperçu, sans attente (l'interface est déjà là). Résolu une fois la scène démontée. */
export function playPreviewReveal(): Promise<void> {
  // Le saut d'aperçu est fini : il cède la place.
  const w = warp
  if (w) w.dispose()
  if (reveal) disposeReveal(reveal)
  const t = tier()
  if (t === 'reduced' || document.hidden) {
    resetStage()
    return Promise.resolve()
  }
  document.documentElement.classList.remove('vt-warp')
  setShellInert(false)
  const r = createReveal(true)
  reveal = r
  revealDone.set(false)
  document.documentElement.classList.add('px-revealing')
  armSkip(r)
  r.run.later(5000, () => finishReveal(r))
  startReveal(r, t)
  return r.done
}

/** Remet la scène à zéro où qu'elle en soit : traînées arrêtées, animations annulées, ni inert, ni vt-warp, ni px-revealing. */
export function resetStage(): void {
  const w = warp
  warp = null
  w?.dispose()
  if (reveal) disposeReveal(reveal)
  stopAllStreaks()
  for (const a of stageAnimations()) a.cancel()
  document.documentElement.classList.remove('vt-warp', 'px-revealing')
  setShellInert(false)
  revealInfo.set(null)
  stage.set(STAGE_IDLE)
}

// ---------- au chargement du module (importé par App avant tout rendu) ----------

if (REVEAL_AT_BOOT) bootReveal(LOADED_AT)
else if (startTier !== 'reduced') {
  // Chemin asynchrone (simulateur, réinstallation de la même version) : la mise à jour n'est connue qu'à l'arrivée de lastUpdate.
  const off = lastUpdate.subscribe(() => {
    const { loaded, value: v } = lastUpdate.get()
    if (!loaded) return
    off()
    if (!v || !v.thisBoot || v.to !== VERSION || read(REVEALED_KEY) === `${VERSION}|${v.installedAt}`) return
    // Seulement pendant ce qui serait l'attente : l'interface n'est pas encore affichée.
    const rootEl = document.getElementById('root')
    const uiUp = !!rootEl?.firstElementChild && !rootEl.querySelector('.boot')
    if (uiUp || document.hidden || performance.now() - LOADED_AT > 1500 || stage.get().mode !== 'idle') return
    document.documentElement.classList.add('px-revealing')
    revealDone.set(false)
    stage.set(revealState(startTier, false, 'hold'))
    bootReveal(performance.now())
  })
}
