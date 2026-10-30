// Armurerie Battlefield 6 : une arme, ses accessoires par emplacement, et ce que chacun change sur le panneau de l'arme.
// Chaque arme est un relevé du menu de personnalisation du jeu (voir weapons/).

export type SlotId = 'optic' | 'optic-accessory' | 'muzzle' | 'barrel' | 'underbarrel' | 'magazine' | 'ammo' | 'accessory' | 'right-accessory' | 'ergonomics'

export type WeaponCategory = 'assault-rifle' | 'carbine' | 'smg' | 'lmg' | 'dmr' | 'sniper' | 'shotgun' | 'pistol'

export type StatValue = number | boolean | string[]
export type Stats = Record<string, StatValue>

export interface ArmoryAttachment {
  /** Nom affiché par le jeu (identifiant dans son emplacement). */
  name: string
  /** Famille (« Sight 1.00x », « Suppressor »…). */
  type: string
  /** Points pris sur le budget de 100 ; null : pas encore relevé. */
  pts: number | null
  /** Effets et défauts, y compris ceux que le panneau n'affiche pas (« +RBLD », « HIDE-3D »…). */
  tags?: string[]
  /** Valeurs du panneau avec cet accessoire seul sur l'arme de série (seulement celles qui changent). */
  changes?: Record<string, number | boolean>
  /** Optique : accessoires d'optique qu'elle accepte. */
  enables?: string[]
}

export interface ArmoryWeapon {
  id: string
  name: string
  category: WeaponCategory
  /** Date du relevé en jeu (AAAA-MM-JJ). */
  captured: string
  /** D'où vient le relevé : la base d'AntiPhysicsGames, ou un relevé fait pour Player X. */
  source: 'antiphysics' | 'player-x'
  /** Panneau de l'arme de série. */
  stats: Stats
  /** Les quatre barres du jeu. */
  bars: { hipfire: number; precision: number; control: number; mobility: number }
  /** Recul : chaque effet de recul est un cran sur une valeur cachée (recul = b × (1 − s × crans)). */
  recModel?: { b: number; s: number } | null
  attachments: Partial<Record<SlotId, ArmoryAttachment[]>>
}

/** Une config : l'accessoire choisi (son nom) par emplacement. */
export type Build = Partial<Record<SlotId, string>>
