// Collections et jeux masqués, côté interface : le rangement tenu par le processus principal (services/shelves.ts).
// Un seul état pour toute l'appli ; chaque action renvoie le rangement à jour (ou rejette avec un message en français).
import type { Shelves } from '@shared/types'
import { createStore, useStore } from '../update/session'

const shelves = createStore<Shelves>({ collections: [], hidden: [] })

/** Relit le rangement (démarrage, bascule du mode démo). */
export function loadShelves(): void {
  window.launcher
    .getShelves()
    .then((s) => shelves.set(s))
    .catch(() => {})
}

export function useShelves(): Shelves {
  return useStore(shelves)
}

const keep = (p: Promise<Shelves>): Promise<Shelves> => p.then((s) => (shelves.set(s), s))

export const shelfActions = {
  create: (name: string, gameId?: string) => keep(window.launcher.createCollection(name, gameId)),
  rename: (id: string, name: string) => keep(window.launcher.renameCollection(id, name)),
  remove: (id: string) => keep(window.launcher.deleteCollection(id)),
  toggle: (id: string, gameId: string, on: boolean) => keep(window.launcher.setInCollection(id, gameId, on)),
  hide: (gameId: string, hidden: boolean) => keep(window.launcher.setGameHidden(gameId, hidden))
}
