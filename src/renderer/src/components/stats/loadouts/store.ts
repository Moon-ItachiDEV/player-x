// Mes loadouts, côté interface : le carnet tenu par le processus principal (services/bf6Loadouts.ts), relu à chaque
// ouverture de l'onglet (le mode démo a le sien). Un brouillon venu de l'Armurerie attend ici que l'onglet l'ouvre.
import { useEffect } from 'react'
import type { Bf6Loadout } from '@shared/bf6Loadouts'
import { createStore, useStore } from '../../../update/session'

const loadouts = createStore<Bf6Loadout[] | null>(null)

/** Brouillon à ouvrir dans l'éditeur (config posée dans l'Armurerie). */
export type LoadoutDraft = Partial<Bf6Loadout>
const draft = createStore<LoadoutDraft | null>(null)

export function reloadLoadouts(): void {
  window.launcher
    .getBf6Loadouts()
    .then((list) => loadouts.set(list))
    .catch(() => loadouts.set([]))
}

/** Le carnet (null pendant la première lecture), relu au montage. */
export function useLoadouts(): Bf6Loadout[] | null {
  useEffect(reloadLoadouts, [])
  return useStore(loadouts)
}

export const loadoutActions = {
  save: (l: LoadoutDraft): Promise<Bf6Loadout[]> => window.launcher.saveBf6Loadout(l).then((list) => (loadouts.set(list), list)),
  remove: (id: string): Promise<Bf6Loadout[]> => window.launcher.deleteBf6Loadout(id).then((list) => (loadouts.set(list), list))
}

export const setLoadoutDraft = (d: LoadoutDraft | null): void => draft.set(d)
export const takeLoadoutDraft = (): LoadoutDraft | null => {
  const d = draft.get()
  draft.set(null)
  return d
}
