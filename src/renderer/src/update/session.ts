// Mises à jour, côté interface : versions de ce lancement, paliers d'effets, porte unique vers Element.animate,
// petits stores partagés et état des mises à jour. Importé par App AVANT WhatsNew (qui écrit pg.lastVersion).
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { LastUpdate, UpdateState } from '@shared/types'
import { motionReduced } from '../motion'

export const VERSION = window.launcher.version

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Lu au chargement du module, AVANT que WhatsNew n'écrive pg.lastVersion (même règle que WhatsNew.shouldOpen). */
export const PREVIOUS_VERSION = read('pg.lastVersion')
/** Ce lancement suit une mise à jour (jamais sur une installation neuve : l'écran de démarrage n'a pas encore été passé). */
export const UPDATED_THIS_LAUNCH = PREVIOUS_VERSION ? PREVIOUS_VERSION !== VERSION : read('pg.setup') !== null

// ---------- paliers ----------

/** full : « Effets visuels » ; sober : effets coupés ; reduced : « Réduire les animations » ou réglage de Windows. */
export type Tier = 'full' | 'sober' | 'reduced'

/** Pour tout ce qui s'affiche avant le premier effet d'App (qui pose data-fx et .reduce-motion). */
export function initialTier(): Tier {
  let ui: { visualFx?: boolean; reduceMotion?: boolean } = {}
  try {
    ui = JSON.parse(read('pg.ui') ?? '{}') ?? {}
  } catch {
    /* préférences illisibles : valeurs par défaut */
  }
  if (ui.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced'
  // Valeur par défaut d'App : visualFx true
  return ui.visualFx === false ? 'sober' : 'full'
}

/** Palier courant. Avant le premier effet d'App, data-fx n'existe pas encore : on retombe sur initialTier(). */
export function tier(): Tier {
  const root = document.documentElement
  if (root.dataset.fx === undefined) return initialTier()
  if (motionReduced()) return 'reduced'
  return root.dataset.fx === 'on' ? 'full' : 'sober'
}

/** Fenêtre en arrière-plan, lu à l'instant (data-window peut avoir un événement de retard). */
export function isIdle(): boolean {
  return document.visibilityState !== 'visible' || !document.hasFocus()
}

/** Effets riches permis maintenant : palier full et fenêtre au premier plan. */
export const fx = (): boolean => tier() === 'full' && !isIdle()

export type AnimOpts = KeyframeAnimationOptions & {
  /** Palier minimal : 'full' (défaut) ou 'sober' (joue aussi effets coupés). Jamais en reduced. */
  level?: 'full' | 'sober'
  /** Joue aussi fenêtre en arrière-plan (fondus qui doivent finir quoi qu'il arrive). */
  whenIdle?: boolean
}

/**
 * Seule porte vers Element.animate pour les mises à jour : WAAPI ignore la règle globale « 0.01 ms » de .reduce-motion.
 * null en reduced, sous le palier demandé, ou fenêtre inactive (sauf whenIdle).
 */
export function anim(el: Element | null | undefined, frames: Keyframe[], o: AnimOpts = {}): Animation | null {
  const { level = 'full', whenIdle = false, ...opts } = o
  const t = tier()
  if (!el || t === 'reduced' || (level === 'full' && t !== 'full') || (!whenIdle && isIdle())) return null
  try {
    return el.animate(frames, opts)
  } catch {
    // Pseudo-élément disparu (transition de vue terminée) : rien à animer.
    return null
  }
}

// ---------- petits stores observables (sans dépendance) ----------

export interface Store<T> {
  get(): T
  set(v: T | ((prev: T) => T)): void
  subscribe(cb: () => void): () => void
}

export function createStore<T>(init: T): Store<T> {
  let value = init
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(v) {
      const next = typeof v === 'function' ? (v as (prev: T) => T)(value) : v
      if (Object.is(next, value)) return
      value = next
      for (const l of [...listeners]) l()
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    }
  }
}

export function useStore<T>(s: Store<T>): T {
  return useSyncExternalStore(s.subscribe, s.get)
}

/** Un jeu lancé depuis Player X tourne (tenu à jour par App) : l'aperçu n'est alors ni proposé ni joué. */
export const gameRunning = createStore(false)

// ---------- dernière mise à jour connue du processus principal ----------

/** loaded passe à true à l'arrivée de la réponse, ou après 400 ms (valeur null en attendant). */
export const lastUpdate = createStore<{ loaded: boolean; value: LastUpdate | null }>({ loaded: false, value: null })
{
  const t400 = setTimeout(() => lastUpdate.set((p) => (p.loaded ? p : { ...p, loaded: true })), 400)
  const get = window.launcher.getLastUpdate as (() => Promise<LastUpdate | null>) | undefined
  Promise.resolve()
    .then(() => (get ? get.call(window.launcher) : null))
    .then((value) => lastUpdate.set({ loaded: true, value: value ?? null }))
    .catch(() => lastUpdate.set({ loaded: true, value: null }))
    .finally(() => clearTimeout(t400))
}

/** La dernière mise à jour, seulement si elle vient d'installer la version qui tourne (au lancement qui l'a installée). */
export function thisBootUpdate(): LastUpdate | null {
  const v = lastUpdate.get().value
  return v && v.thisBoot && v.to === VERSION ? v : null
}

// ---------- état des mises à jour ----------

/** État des mises à jour (processus principal), tenu à jour par l'événement `update:state`. `null` tant qu'il n'est pas connu. */
export function useUpdateState(): [UpdateState | null, (s: UpdateState) => void] {
  const [state, setState] = useState<UpdateState | null>(null)
  useEffect(() => {
    let alive = true
    const off = window.launcher.onUpdateState((s) => alive && setState(s))
    // Un événement arrivé entre-temps est plus récent : on le garde.
    window.launcher
      .getUpdateState()
      .then((s) => alive && setState((cur) => cur ?? s))
      .catch(() => {})
    return () => {
      alive = false
      off()
    }
  }, [])
  return [state, setState]
}

/** Une vraie mise à jour est en cours (l'aperçu n'est alors pas proposé, et s'arrête s'il tournait). */
export function isRealUpdateBusy(s: UpdateState | null): boolean {
  return !!s && (s.state === 'downloading' || s.state === 'verifying' || s.state === 'ready' || s.state === 'installing')
}
