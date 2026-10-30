// Textes français de l'Armurerie et des loadouts : emplacements, catégories d'armes, classes, stats du panneau,
// objectifs et effets des accessoires. Les noms des accessoires restent ceux affichés par le jeu.
import type { GoalId } from './engine'
import type { SlotId, WeaponCategory } from './types'

export const SLOT_LABEL: Record<SlotId, string> = {
  optic: 'Optique',
  'optic-accessory': 'Accessoire d’optique',
  muzzle: 'Bouche',
  barrel: 'Canon',
  underbarrel: 'Sous le canon',
  magazine: 'Chargeur',
  ammo: 'Munitions',
  accessory: 'Accessoire du haut',
  'right-accessory': 'Accessoire de droite',
  ergonomics: 'Ergonomie'
}

export const CATEGORY_LABEL: Record<WeaponCategory, string> = {
  'assault-rifle': 'Fusil d’assaut',
  carbine: 'Carabine',
  smg: 'Mitraillette',
  lmg: 'Mitrailleuse légère',
  dmr: 'Fusil de tireur d’élite',
  sniper: 'Fusil de précision',
  shotgun: 'Fusil à pompe',
  pistol: 'Pistolet'
}

export type Bf6ClassId = 'assault' | 'engineer' | 'support' | 'recon'
export const BF6_CLASSES: Bf6ClassId[] = ['assault', 'engineer', 'support', 'recon']
export const CLASS_LABEL: Record<Bf6ClassId, string> = { assault: 'Assaut', engineer: 'Ingénieur', support: 'Soutien', recon: 'Éclaireur' }

export interface StatInfo {
  label: string
  /** Valeur affichée (unité comprise). */
  fmt: (v: number) => string
}

const fr = (digits: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const n0 = fr(0)
const n1 = fr(1)
const n2 = fr(2)

/** Stats du panneau de l'arme, dans l'ordre d'affichage. */
export const STAT_INFO: Record<string, StatInfo> = {
  ads_time_in_ms: { label: 'Temps de visée', fmt: (v) => `${n0.format(v)} ms` },
  sprint_recovery_ms: { label: 'Sortie de sprint', fmt: (v) => `${n0.format(v)} ms` },
  ads_move_speed_mult: { label: 'Vitesse en visant', fmt: (v) => `× ${n2.format(v)}` },
  reload_s: { label: 'Rechargement', fmt: (v) => `${n2.format(v)} s` },
  recoil_amount_deg: { label: 'Recul', fmt: (v) => `${n1.format(v)}°` },
  recoil_variation_deg: { label: 'Variation du recul', fmt: (v) => `${n1.format(v)}°` },
  muzzle_velocity: { label: 'Vitesse de la balle', fmt: (v) => `${n0.format(v)} m/s` },
  mag: { label: 'Chargeur', fmt: (v) => `${n0.format(v)} balles` },
  headshot_mult: { label: 'Multiplicateur à la tête', fmt: (v) => `× ${n2.format(v)}` },
  collateral_mult: { label: 'Dégâts à travers une cible', fmt: (v) => `× ${n2.format(v)}` },
  regen_delay_s: { label: 'Soin de l’ennemi retardé', fmt: (v) => `${n1.format(v)} s` },
  spot_3d_m: { label: 'Repéré en tirant', fmt: (v) => `${n0.format(v)} m` },
  spot_2d_m: { label: 'Repéré sur la minicarte', fmt: (v) => `${n0.format(v)} m` }
}

export const BAR_LABEL = { hipfire: 'Hanche', precision: 'Précision', control: 'Contrôle', mobility: 'Mobilité' } as const
export type BarKey = keyof typeof BAR_LABEL
export const BAR_KEYS: BarKey[] = ['hipfire', 'precision', 'control', 'mobility']

export interface GoalInfo {
  label: string
  /** Quand la choisir. */
  hint: string
  /** Ce que la recherche classe, dans l'ordre. */
  rule: string
}

export const GOAL_INFO: Record<GoalId, GoalInfo> = {
  close: { label: 'Courte portée', hint: 'Tir à la hanche et déplacements', rule: 'Hanche et mobilité d’abord, puis le temps de visée, puis le contrôle.' },
  mid: { label: 'Moyenne portée', hint: 'Rafales en visant', rule: 'Contrôle et précision d’abord, puis le temps de visée, puis la mobilité.' },
  long: {
    label: 'Longue portée',
    hint: 'Duels de loin',
    rule: 'Contrôle et précision, puis la vitesse de la balle et les dégâts à la tête, puis le temps de visée et la mobilité.'
  },
  control: { label: 'Meilleur contrôle', hint: 'Le moins de recul', rule: 'Contrôle d’abord, puis le moins de recul et de variation, puis le temps de visée et la mobilité.' },
  ads: { label: 'Visée rapide', hint: 'Premier à viser', rule: 'Le temps de visée le plus court, puis la mobilité, puis le contrôle.' },
  hipfire: { label: 'Tir à la hanche', hint: 'Sans viser', rule: 'Hanche d’abord, puis la mobilité, puis le contrôle.' },
  balanced: { label: 'Équilibrée', hint: 'Un peu de tout', rule: 'La plus grande somme des quatre barres, puis le temps de visée.' }
}
export const GOAL_GROUPS: { id: 'range' | 'quality'; label: string; goals: GoalId[] }[] = [
  { id: 'range', label: 'Selon la distance', goals: ['close', 'mid', 'long'] },
  { id: 'quality', label: 'Selon une qualité', goals: ['control', 'ads', 'hipfire', 'balanced'] }
]

/**
 * Effets des accessoires, d'après le vocabulaire de la base d'AntiPhysicsGames (CC BY-NC-SA 4.0), y compris ceux que
 * le panneau ne montre pas. `good` : l'effet aide (vert) ; false : il gêne ; undefined : neutre.
 */
export function tagLabel(tag: string): { text: string; good?: boolean } | null {
  const m = tag.match(/^([+-]?)([A-Za-z-]+?)(\d?)$/)
  if (!m) return null
  const [, sign, code, lvl] = m
  const plus = sign !== '-'
  const level = lvl && Number(lvl) > 1 ? ` (${lvl} crans)` : ''
  switch (code) {
    case 'ADS':
      return { text: plus ? 'Visée plus rapide' : 'Visée plus lente', good: plus }
    case 'REC':
      return { text: plus ? `Moins de recul${level}` : 'Plus de recul', good: plus }
    case 'HIP':
      return { text: plus ? `Hanche plus précise${level}` : 'Hanche moins précise', good: plus }
    case 'DRAW':
      return { text: plus ? 'Dégainage plus rapide' : lvl === '2' ? 'Dégainage bien plus lent' : 'Dégainage plus lent', good: plus }
    case 'mACC':
      return { text: plus ? 'Plus précis en bougeant' : 'Moins précis en bougeant', good: plus }
    case 'mSPD':
      return { text: plus ? 'Plus rapide en visant' : 'Plus lent en visant', good: plus }
    case 'PEN':
      return { text: plus ? 'Traverse mieux les cibles' : 'Traverse moins les cibles', good: plus }
    case 'VEL':
      return { text: plus ? 'Balle plus rapide' : 'Balle plus lente', good: plus }
    case 'RBLD':
      return { text: 'Recul qui monte moins', good: true }
    case 'HIP-RBLD':
      return { text: 'Hanche qui se resserre plus vite', good: true }
    case 'LINEAR':
      return { text: 'Recul plus vertical' }
    case 'HEAD':
      return { text: 'Plus de dégâts à la tête', good: true }
    case 'MAG':
      return { text: plus ? 'Chargeur plus grand' : 'Chargeur plus petit', good: plus }
    case 'RELOAD':
      return { text: 'Rechargement plus rapide', good: true }
    case 'SWAY':
      return { text: plus ? 'Moins de balancement' : 'Plus de balancement', good: plus }
    case 'HIDE-3D':
      return { text: 'Pas de marqueur en tirant', good: true }
    case 'HIDE-MAP':
      return { text: 'Discret sur la minicarte', good: true }
    case 'VISIBLE':
      return { text: 'Faisceau visible', good: false }
    case 'MOUNT':
      return { text: 'Se pose sur un appui', good: true }
    case 'THERMAL':
      return { text: 'Vision thermique' }
    case 'VARIABLE':
      return { text: 'Zoom variable' }
    case 'BLIND':
      return { text: 'Éblouit' }
    case 'AUTO':
      return { text: 'S’allume en visant' }
    case 'ADS-RELOAD':
      return { text: 'Recharge en visant', good: true }
    case 'REGEN-DELAY':
      return { text: 'Retarde le soin de l’ennemi', good: true }
    case 'SEMI-ONLY':
      return { text: 'Effets en coup par coup seulement' }
    default:
      return null
  }
}
