// « Voir l'aperçu » : rejoue toute la séquence (carte, bouclier, compte à rebours, saut, retour, Quoi de neuf) sans rien télécharger ni installer.
// CONTRAT partagé par la carte, Quoi de neuf et À propos. Règles d'honnêteté : aucune version, taille, vitesse ni empreinte inventée.
import { createStore } from './session'

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

export async function startPreview(o: { from: 'about' | 'whatsnew'; trigger?: HTMLElement | null }): Promise<void> {
  void o
}

/** Arrête l'aperçu où qu'il en soit (Échap, ×, « Plus tard », fenêtre en arrière-plan, vraie mise à jour, Quoi de neuf fermé). */
export function stopPreview(): void {
  preview.set(PREVIEW_IDLE)
}
