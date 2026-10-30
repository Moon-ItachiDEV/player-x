// Prêt à jouer, côté interface : l'état des mises à jour Steam (appid → état), tenu par le processus principal
// (services/steamUpdates.ts). Un seul abonnement pour toute l'appli ; chaque jaquette lit l'état de son jeu.
import { useSyncExternalStore } from 'react'
import { updateActive } from '@shared/steamUpdate'
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

/**
 * Bouton principal quand Steam a une mise à jour (ou un premier téléchargement) pour ce jeu : il ouvre les téléchargements
 * de Steam, sans lancer le jeu (demande de Breezydev, 0.9.7-beta.4 : « mettre à jour seulement »). Steam n'a pas de
 * commande qui lance seulement la mise à jour ; « … est prêt » propose ensuite Jouer.
 */
export function updateAction(u: SteamUpdate | undefined): { label: string; title: string } | undefined {
  if (!u) return undefined
  if (updateActive(u)) return { label: 'Voir dans Steam', title: 'Steam télécharge : ouvre ses téléchargements. Le jeu ne démarre pas.' }
  if (u.firstInstall) return { label: 'Installer', title: 'Ouvre les téléchargements de Steam pour reprendre le téléchargement. Le jeu ne démarre pas.' }
  return { label: 'Mettre à jour', title: 'Ouvre les téléchargements de Steam pour lancer la mise à jour. Le jeu ne démarre pas.' }
}
