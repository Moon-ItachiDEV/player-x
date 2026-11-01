// Mes loadouts Battlefield 6 : le carnet du joueur, gardé sur ce PC (base locale). Le mode démo a le sien, pour ne
// jamais toucher au vrai. Règles (nettoyage, plafond) dans shared/bf6Loadouts.ts.
import { randomBytes } from 'node:crypto'
import { cleanLoadouts, withLoadout, withoutLoadout, type Bf6Loadout } from '@shared/bf6Loadouts'
import { cleanDraft, cleanMyWeapons, forgetWeapon, learnWeapon, type LoadoutDraftSaved, type MyWeapon } from '@shared/bf6Workshop'
import { getKv, setKv } from '../db'
import { getSettings } from './settings'

const demo = (): boolean => getSettings().demoMode
const key = (): string => (demo() ? 'demoBf6Loadouts' : 'bf6Loadouts')
const weaponsKey = (): string => (demo() ? 'demoBf6MyWeapons' : 'bf6MyWeapons')
const draftKey = (): string => (demo() ? 'demoBf6LoadoutDraft' : 'bf6LoadoutDraft')

export function getBf6Loadouts(): Bf6Loadout[] {
  return cleanLoadouts(getKv<unknown>(key(), []))
}

/** Enregistre un loadout (nouveau s'il n'a pas d'identifiant connu). Renvoie le carnet. */
export function saveBf6Loadout(raw: unknown): Bf6Loadout[] {
  const list = getBf6Loadouts()
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const known = typeof r.id === 'string' && list.some((l) => l.id === r.id)
  const now = Date.now()
  const next = withLoadout(list, { ...r, id: known ? r.id : `l${randomBytes(6).toString('hex')}` }, now)
  setKv(key(), next)
  // L'arme est retenue dans « Mes armes » : ses accessoires seront proposés la prochaine fois.
  setKv(weaponsKey(), learnWeapon(getMyWeapons(), next[0], now))
  return next
}

/** Plusieurs loadouts d'un coup (les modèles) : un seul enregistrement, l'ordre donné est gardé. */
export function saveBf6Loadouts(raws: unknown): Bf6Loadout[] {
  if (!Array.isArray(raws)) return getBf6Loadouts()
  let list = getBf6Loadouts()
  let weapons = getMyWeapons()
  const base = Date.now()
  raws
    .slice()
    .reverse()
    .forEach((raw, i) => {
      const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      list = withLoadout(list, { ...r, id: `l${randomBytes(6).toString('hex')}` }, base + i)
      weapons = learnWeapon(weapons, list[0], base + i)
    })
  setKv(key(), list)
  setKv(weaponsKey(), weapons)
  return list
}

export function getMyWeapons(): MyWeapon[] {
  return cleanMyWeapons(getKv<unknown>(weaponsKey(), []))
}

export function forgetMyWeapon(k: unknown): MyWeapon[] {
  const next = forgetWeapon(getMyWeapons(), String(k))
  setKv(weaponsKey(), next)
  return next
}

/** Le brouillon de l'atelier : une seule entrée, remplacée à chaque modification, effacée à l'enregistrement. */
export function getLoadoutDraft(): LoadoutDraftSaved | null {
  return cleanDraft(getKv<unknown>(draftKey(), null))
}

export function setLoadoutDraft(raw: unknown): LoadoutDraftSaved | null {
  const d = cleanDraft(raw && typeof raw === 'object' ? { ...(raw as object), savedAt: Date.now() } : null)
  setKv(draftKey(), d)
  return d
}

export function deleteBf6Loadout(id: unknown): Bf6Loadout[] {
  const next = withoutLoadout(getBf6Loadouts(), String(id))
  setKv(key(), next)
  return next
}
