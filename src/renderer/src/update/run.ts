// Une course de scène (mise à jour, lancement d'un jeu) : minuteries, animations, écouteurs et traînées, rangés d'un coup.
import { KF, type KeyframeSet } from './keyframes'
import { anim, type AnimOpts } from './session'
import type { StreakRun } from './streaks'

/** Minuteries, animations, écouteurs et traînées d'une course de la scène : tout se range d'un coup. */
export class Run {
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

  settle(how: 'finish' | 'cancel'): void
  /**
   * 'fade' : tout s'arrête (minuteries comprises) et `el` s'efface en 160 ms, même fenêtre en arrière-plan.
   * Rend le fondu (null s'il n'a pas pu jouer : l'appelant démonte tout de suite).
   */
  settle(how: 'fade', el: Element | null | undefined): Animation | null
  settle(how: 'finish' | 'cancel' | 'fade', el?: Element | null): Animation | null | void {
    this.streaks?.stop()
    if (how === 'fade') {
      for (const t of this.timers) clearTimeout(t)
      this.timers = []
    }
    for (const a of this.anims) {
      try {
        if (how === 'finish') a.finish()
        else a.cancel()
      } catch {
        /* pseudo-élément déjà disparu */
      }
    }
    if (how !== 'fade') return
    this.anims = []
    const f = KF.fadeOut(160)
    return anim(el, f.frames, { ...f.opts, level: 'sober', whenIdle: true })
  }

  dispose(): void {
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
    for (const off of this.offs.splice(0)) off()
    this.streaks?.stop()
  }
}
