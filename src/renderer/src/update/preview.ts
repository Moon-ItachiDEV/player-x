// « Voir l'aperçu » : rejoue toute la séquence (carte, bouclier, compte à rebours, saut, retour, Quoi de neuf) sans rien télécharger ni installer.
// CONTRAT partagé par la carte, Quoi de neuf et À propos. Règles d'honnêteté : aucune version, taille, vitesse ni empreinte inventée.
import { createStore, gameRunning, isIdle, isRealUpdateBusy } from './session'
import { announceStage, playPreviewReveal, resetStage, revealDone, setPreviewDriver, stage } from './stage'

export type PreviewFrame =
  | { phase: 'download'; percent: number }
  | { phase: 'verify'; step: 'signature' | 'hash' | 'check'; hashP: number }
  | { phase: 'ready' }

export interface PreviewState {
  active: boolean
  /** Image affichée par la carte (null hors de la partie « carte »). */
  frame: PreviewFrame | null
  /** Où en est l'aperçu. */
  part: 'card' | 'warp' | 'reveal' | 'whatsnew' | null
}

export const PREVIEW_IDLE: PreviewState = { active: false, frame: null, part: null }
export const preview = createStore<PreviewState>(PREVIEW_IDLE)

/** Version qui présente l'animation : son Quoi de neuf propose « Voir l'aperçu ». */
export const PREVIEW_INTRO = '0.6.0'
/** Compte à rebours de l'aperçu, en secondes (le vrai en compte 10). */
export const PREVIEW_COUNTDOWN = 5

interface Session {
  ctl: AbortController
  trigger: HTMLElement | null
  started: boolean
  ended: boolean
}

let current: Session | null = null

/** Attend `ms`, ou rejette dès l'arrêt de l'aperçu. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return until(new Promise((resolve) => setTimeout(resolve, Math.max(0, ms))), signal)
}

/** La promesse, ou un rejet dès l'arrêt de l'aperçu (les minuteries restantes ne font alors plus rien). */
function until<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e) => {
        signal.removeEventListener('abort', onAbort)
        reject(e)
      }
    )
  })
}

export async function startPreview(o: { from: 'about' | 'whatsnew'; trigger?: HTMLElement | null }): Promise<void> {
  // Rien n'anime pendant une partie : pas d'aperçu non plus.
  if (current || preview.get().active || gameRunning.get()) return
  // Un saut ou un retour à l'écran passe avant.
  if (stage.get().mode !== 'idle' || !revealDone.get()) return
  const session: Session = { ctl: new AbortController(), trigger: o.trigger ?? null, started: false, ended: false }
  current = session
  try {
    // Une vraie mise à jour en cours passe avant : pas d'aperçu.
    const real = await until(
      Promise.resolve()
        .then(() => window.launcher.getUpdateState())
        .catch(() => null),
      session.ctl.signal
    )
    if (isRealUpdateBusy(real)) return
    await runPreview(session)
  } catch {
    /* arrêté : Échap, ×, « Plus tard », fenêtre en arrière-plan, vraie mise à jour, Quoi de neuf fermé */
  } finally {
    end(session)
  }
}

/** Arrête l'aperçu où qu'il en soit (Échap, ×, « Plus tard », fenêtre en arrière-plan, vraie mise à jour, Quoi de neuf fermé). */
export function stopPreview(): void {
  if (current) end(current)
  else if (preview.get().active) preview.set(PREVIEW_IDLE)
}

/** Range tout, une seule fois : aucune traînée, animation, inert, vt-warp ni px-revealing ne survit ; le focus revient au déclencheur. */
function end(s: Session): void {
  if (s.ended) return
  s.ended = true
  s.ctl.abort()
  if (current === s) current = null
  setPreviewDriver(null)
  // La scène n'est remise à zéro que si elle appartient à l'aperçu : un vrai saut passe avant.
  const st = stage.get()
  if (st.mode === 'idle' || st.preview) resetStage()
  preview.set(PREVIEW_IDLE)
  revealDone.set(true)
  if (!s.started) return
  announceStage('Aperçu terminé.')
  // Après le rendu qui réactive le bouton (désactivé pendant l'aperçu), et sans voler un focus déplacé entre-temps.
  const t = s.trigger
  if (t)
    requestAnimationFrame(() => {
      const a = document.activeElement
      if (t.isConnected && !(t as HTMLButtonElement).disabled && (!a || a === document.body)) t.focus()
    })
}

/** §11.2, les visuels du palier courant. */
async function runPreview(s: Session): Promise<void> {
  const { signal } = s.ctl
  const offs: (() => void)[] = []
  signal.addEventListener('abort', () => offs.splice(0).forEach((off) => off()), { once: true })

  let stopAfterReveal = false
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return
    const part = preview.get().part
    // Pendant le retour, Échap le passe (la scène s'en charge) et l'aperçu s'arrête à la fin, sans Quoi de neuf.
    if (part === 'reveal') {
      stopAfterReveal = true
      return
    }
    // Dans Quoi de neuf, Échap le ferme aussi (son propre écouteur) : on le laisse passer.
    if (part !== 'whatsnew') {
      e.preventDefault()
      e.stopPropagation()
    }
    stopPreview()
  }
  addEventListener('keydown', onKey, true)
  offs.push(() => removeEventListener('keydown', onKey, true))
  const onIdle = (): void => {
    if (isIdle()) stopPreview()
  }
  addEventListener('blur', onIdle)
  document.addEventListener('visibilitychange', onIdle)
  offs.push(() => {
    removeEventListener('blur', onIdle)
    document.removeEventListener('visibilitychange', onIdle)
  })
  // Une partie qui démarre arrête l'aperçu (rien n'anime en jeu).
  offs.push(gameRunning.subscribe(() => gameRunning.get() && stopPreview()))
  // Un vrai téléchargement, une vraie vérification, une vraie mise à jour prête ou en cours d'installation gagne toujours.
  try {
    offs.push(window.launcher.onUpdateState((u) => isRealUpdateBusy(u) && stopPreview()))
  } catch {
    /* pas d'événements */
  }

  let card: PreviewFrame = { phase: 'download', percent: 0 }
  let warpStarted!: () => void
  let warpEnded!: () => void
  const started = new Promise<void>((r) => (warpStarted = r))
  const ended = new Promise<void>((r) => (warpEnded = r))
  setPreviewDriver({
    // La carte garde sa dernière image sous le voile : elle est aspirée avec l'interface.
    warpStarted: () => {
      preview.set({ active: true, part: 'warp', frame: card })
      warpStarted()
    },
    warpEnded: () => warpEnded()
  })

  s.started = true
  announceStage("Aperçu de l'animation de mise à jour. Échap pour arrêter.")
  const t0 = performance.now()
  const at = (ms: number): Promise<void> => wait(t0 + ms - performance.now(), signal)
  const show = (frame: PreviewFrame): void => {
    card = frame
    preview.set({ active: true, part: 'card', frame })
  }

  show(card)
  // 0 → 100 % par 10 toutes les 500 ms ; le 100 % arrive un peu avant la vérification pour être vu.
  for (let k = 1; k <= 9; k++) {
    await at(500 * k)
    show({ phase: 'download', percent: 10 * k })
  }
  await at(4750)
  show({ phase: 'download', percent: 100 })
  await at(5000)
  show({ phase: 'verify', step: 'signature', hashP: 0 })
  for (let i = 0; i <= 5; i++) {
    await at(5600 + i * 100)
    show({ phase: 'verify', step: 'hash', hashP: i / 5 })
  }
  await at(6200)
  show({ phase: 'verify', step: 'check', hashP: 1 })
  await at(6800)
  // La carte verrouille, compte PREVIEW_COUNTDOWN secondes (mêmes pauses que le vrai), puis requestRestart({ preview: true }).
  show({ phase: 'ready' })

  await until(started, signal)
  await until(ended, signal)
  // Le temps où la vraie fenêtre serait fermée.
  await wait(600, signal)
  preview.set({ active: true, part: 'reveal', frame: null })
  await until(playPreviewReveal(), signal)
  if (stopAfterReveal) return
  // Quoi de neuf s'ouvre en mode aperçu ; sa fermeture appelle stopPreview().
  preview.set({ active: true, part: 'whatsnew', frame: null })
  await until(new Promise<never>(() => {}), signal)
}
