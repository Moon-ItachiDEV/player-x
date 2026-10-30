// Prêt à jouer, côté interface : l'état des mises à jour Steam (appid → état), tenu par le processus principal
// (services/steamUpdates.ts). Un seul abonnement pour toute l'appli ; chaque jaquette lit l'état de son jeu.
import { useSyncExternalStore } from 'react'
import type { Game, SteamUpdate, SteamUpdates } from '@shared/types'
import { createStore } from '../update/session'

const updates = createStore<SteamUpdates>({})

/** À appeler une fois (App) : l'état actuel, puis chaque changement. Renvoie la fonction de désabonnement. */
export function bindSteamUpdates(): () => void {
  const api = window.launcher
  // Un changement arrivé avant la première réponse est plus récent qu'elle : il gagne.
  let heard = false
  const off = api.onSteamUpdates((u) => {
    heard = true
    updates.set(u)
  })
  api
    .getSteamUpdates()
    .then((u) => {
      if (!heard) updates.set(u)
    })
    .catch(() => {})
  return off
}

/** Où en est Steam avec ce jeu (jeux Steam seulement) ; undefined s'il est prêt à jouer. */
export function useSteamUpdate(game: Game | null | undefined): SteamUpdate | undefined {
  const appId = game?.store === 'steam' ? game.storeId : null
  return useSyncExternalStore(updates.subscribe, () => (appId ? updates.get()[appId] : undefined))
}

/** Libellé du bouton Jouer quand une mise à jour attend : Steam la termine, puis lance le jeu. */
export function playLabelFor(u: SteamUpdate | undefined): string | undefined {
  return u && !u.firstInstall ? 'Mettre à jour et jouer' : undefined
}
