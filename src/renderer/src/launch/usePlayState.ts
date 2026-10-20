// État des boutons Jouer d'un jeu, le même sur toutes les surfaces (spec launch-sequence.md §3.3) : accueil, « À reprendre »,
// bibliothèque, rail des favoris, fiche, profil. Les boutons restent focalisables (aria-disabled, jamais disabled) :
// le focus survit à chaque changement de libellé.
import { useEffect, useReducer } from 'react'
import type { Game } from '@shared/types'
import type { LaunchFn } from '../contracts'
import { cleanName } from '@shared/text'
import { playCopy, type PlayState } from './copy'
import { LABEL_MIN_MS, playStateOf, STALLED_MS } from './phase'
import { isBusy, useLatestLaunch, type LaunchView } from './store'

export interface PlayInfo {
  state: PlayState
  label: string
  ariaLabel: string
  title: string
  /** Classe d'état des gros boutons : is-sending, is-waiting ou is-live (vide au repos). */
  className: string
  /** Rond qui tourne (envoi de moins de 5 s, vérification), horloge immobile (attente), point cyan (en jeu), ou Jouer. */
  icon: 'spin' | 'clock' | 'dot' | 'play'
  /** Le lancement attend encore : aria-busy. */
  busy: boolean
  /** aria-disabled : un clic ne ferait rien (envoi, vérification). */
  inert: boolean
  /** Dernier lancement de ce jeu (route, phase), ou null. */
  launch: LaunchView | null
  /** Clic : lance, ramène la carte devant pendant l'attente, ou vérifie un jeu qui semblait tourner. */
  activate: (from?: HTMLElement | null) => void
}

const CLASS: Record<PlayState, string> = {
  idle: '',
  sending: 'is-sending',
  checking: 'is-sending',
  pending: 'is-waiting',
  running: 'is-live',
  'demo-running': 'is-live'
}

/** `onLaunch` : startLaunch, reçu d'App comme toutes les actions des écrans. */
export function usePlayState(game: Game, onLaunch: LaunchFn): PlayInfo {
  const v = useLatestLaunch(game.id)
  const [, wake] = useReducer((n: number) => n + 1, 0)
  const now = Date.now()
  const state = playStateOf(!!game.running, v, now)
  const sendingFor = v && v.status.phase === 'sending' ? now - v.clickedAt : -1

  // Deux seuils dépendent du temps : la fin des 600 ms de « Lancement… », et l'horloge à 5 s d'envoi.
  useEffect(() => {
    if (!v) return
    const at = Date.now()
    const ends = [v.clickedAt + LABEL_MIN_MS, v.status.phase === 'sending' ? v.clickedAt + STALLED_MS : Infinity].filter((t) => t > at)
    if (!ends.length) return
    const id = setTimeout(wake, Math.min(...ends) - at + 16)
    return () => clearTimeout(id)
  }, [v])

  const c = playCopy(state, cleanName(game.name))
  const icon: PlayInfo['icon'] =
    state === 'checking' || (state === 'sending' && sendingFor < STALLED_MS)
      ? 'spin'
      : state === 'sending' || state === 'pending'
        ? 'clock'
        : state === 'running' || state === 'demo-running'
          ? 'dot'
          : 'play'
  const inert = state === 'sending' || state === 'checking'
  return {
    state,
    ...c,
    className: CLASS[state],
    icon,
    busy: isBusy(v),
    inert,
    launch: v,
    activate: (from) => {
      if (inert) return
      onLaunch(game, from)
    }
  }
}
