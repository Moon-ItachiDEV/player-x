// Mes loadouts, côté interface : le carnet tenu par le processus principal (services/bf6Loadouts.ts), relu à chaque
// ouverture de l'onglet (le mode démo a le sien). Un brouillon venu de l'Armurerie attend ici que l'onglet l'ouvre.
import { useEffect } from 'react'
import type { Bf6Loadout } from '@shared/bf6Loadouts'
import type { LoadoutDraftSaved, MyWeapon } from '@shared/bf6Workshop'
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

const myWeapons = createStore<MyWeapon[]>([])
const savedDraft = createStore<LoadoutDraftSaved | null>(null)

export function reloadWorkshop(): void {
  window.launcher
    .getMyBf6Weapons()
    .then((w) => myWeapons.set(w))
    .catch(() => undefined)
  window.launcher
    .getBf6LoadoutDraft()
    .then((d) => savedDraft.set(d))
    .catch(() => undefined)
}

/** « Mes armes » (apprises des loadouts enregistrés). */
export function useMyWeapons(): MyWeapon[] {
  useEffect(reloadWorkshop, [])
  return useStore(myWeapons)
}

/** Le brouillon gardé (null : aucun). */
export const useSavedDraft = (): LoadoutDraftSaved | null => useStore(savedDraft)

export const draftActions = {
  set: (d: { id?: string; loadout: unknown }): Promise<void> => window.launcher.setBf6LoadoutDraft(d).then((saved) => savedDraft.set(saved)),
  clear: (): Promise<void> => window.launcher.setBf6LoadoutDraft(null).then(() => savedDraft.set(null))
}

export const loadoutActions = {
  save: (l: LoadoutDraft): Promise<Bf6Loadout[]> =>
    window.launcher.saveBf6Loadout(l).then((list) => {
      loadouts.set(list)
      window.launcher
        .getMyBf6Weapons()
        .then((w) => myWeapons.set(w))
        .catch(() => undefined)
      return list
    }),
  saveMany: (ls: LoadoutDraft[]): Promise<Bf6Loadout[]> =>
    window.launcher.saveBf6Loadouts(ls).then((list) => {
      loadouts.set(list)
      window.launcher
        .getMyBf6Weapons()
        .then((w) => myWeapons.set(w))
        .catch(() => undefined)
      return list
    }),
  forgetWeapon: (key: string): Promise<void> => window.launcher.forgetMyBf6Weapon(key).then((w) => myWeapons.set(w)),
  remove: (id: string): Promise<Bf6Loadout[]> => window.launcher.deleteBf6Loadout(id).then((list) => (loadouts.set(list), list))
}

export const setLoadoutDraft = (d: LoadoutDraft | null): void => draft.set(d)
export const takeLoadoutDraft = (): LoadoutDraft | null => {
  const d = draft.get()
  draft.set(null)
  return d
}

/** Style des cartes : A « Gunsmith » ou B « Affiche » (gardé sur ce PC, à tester en vrai). */
export type CardStyle = 'a' | 'b'
export const CARD_KEY = 'pg.stats.loadouts.card'
const readCard = (): CardStyle => {
  try {
    return localStorage.getItem(CARD_KEY) === 'b' ? 'b' : 'a'
  } catch {
    return 'a'
  }
}
const cardStyle = createStore<CardStyle>(readCard())
export const useCardStyle = (): CardStyle => useStore(cardStyle)
export function setCardStyle(s: CardStyle): void {
  cardStyle.set(s)
  try {
    localStorage.setItem(CARD_KEY, s)
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
}
