// Scène plein écran des mises à jour : le saut (redémarrage → fermeture) et le retour (premier lancement après la mise à jour).
// CONTRAT partagé par la carte (UpdateNotice), Quoi de neuf, À propos et l'aperçu. L'implémentation suit docs/design (spec Séquence Réacteur §7–§8).
import type { InstallResult } from '@shared/types'
import { createStore, type Tier } from './session'

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

export const stage = createStore<StageState>(STAGE_IDLE)

/** Ce lancement suit une mise à jour et le retour (allumage) doit jouer dès le premier rendu. */
export const REVEAL_AT_BOOT = false

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

/** Seule porte vers installUpdate depuis l'interface : l'IPC part d'abord, l'animation ensuite. */
export function requestRestart(o: RestartRequest): void {
  if (o.preview) return
  void (window.launcher.installUpdate({ delayMs: 0 }) as Promise<InstallResult>).catch(() => {})
}

/** Un saut est en cours (redémarrage demandé). */
export function warpActive(): boolean {
  return stage.get().mode === 'warp'
}
