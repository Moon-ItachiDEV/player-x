// Mes loadouts Battlefield 6 : le carnet du joueur, gardé sur ce PC (base locale). Le mode démo a le sien, pour ne
// jamais toucher au vrai. Règles (nettoyage, plafond) dans shared/bf6Loadouts.ts.
import { randomBytes } from 'node:crypto'
import { cleanLoadouts, withLoadout, withoutLoadout, type Bf6Loadout } from '@shared/bf6Loadouts'
import { getKv, setKv } from '../db'
import { getSettings } from './settings'

const key = (): string => (getSettings().demoMode ? 'demoBf6Loadouts' : 'bf6Loadouts')

export function getBf6Loadouts(): Bf6Loadout[] {
  return cleanLoadouts(getKv<unknown>(key(), []))
}

/** Enregistre un loadout (nouveau s'il n'a pas d'identifiant connu). Renvoie le carnet. */
export function saveBf6Loadout(raw: unknown): Bf6Loadout[] {
  const list = getBf6Loadouts()
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const known = typeof r.id === 'string' && list.some((l) => l.id === r.id)
  const next = withLoadout(list, { ...r, id: known ? r.id : `l${randomBytes(6).toString('hex')}` }, Date.now())
  setKv(key(), next)
  return next
}

export function deleteBf6Loadout(id: unknown): Bf6Loadout[] {
  const next = withoutLoadout(getBf6Loadouts(), String(id))
  setKv(key(), next)
  return next
}
