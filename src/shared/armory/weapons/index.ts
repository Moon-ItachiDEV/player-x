// Armes de l'Armurerie : chacune est un relevé complet du menu de personnalisation du jeu (accessoires, points, effets).
// Ajouter une arme = un fichier de plus ici, relevé en jeu ; aucune valeur devinée.
import type { ArmoryWeapon } from '../types'
import { M433 } from './m433'

export const ARMORY_WEAPONS: ArmoryWeapon[] = [M433]

/**
 * Image de l'arme : celle que l'API gametools.network renvoie avec les stats, sur son CDN (dépôt public
 * community-network/Image-CDN, nom interne du jeu). Rien n'est embarqué : une image qui ne charge pas laisse le nom.
 */
export const WEAPON_IMAGE: Record<string, string> = {
  m433: 'https://cdn.gametools.network/weapons/bf6/T_UI_HK433_PKG_Factory_MED-39181b6c.webp'
}

export const armoryWeapon = (id: string | undefined): ArmoryWeapon | undefined => ARMORY_WEAPONS.find((w) => w.id === id)

/** Nom d'arme ramené à ses lettres et chiffres (« M433 », « m-433 » → « m433 ») pour retrouver une arme par son nom. */
export const weaponKey = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()

/** Arme de l'Armurerie qui porte ce nom (tel que le joueur l'écrit ou que gametools le renvoie). */
export const armoryWeaponByName = (name: string): ArmoryWeapon | undefined => ARMORY_WEAPONS.find((w) => weaponKey(w.name) === weaponKey(name))
