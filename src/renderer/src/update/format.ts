// Chiffres des mises à jour, à la française : espace insécable avant l'unité, virgule décimale.

const NB = ' '
const MiB = 1024 * 1024
const one = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const int = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export const pct = (n: number): string => `${n}${NB}%`

/** « 92,4 Mo » ou « 512 Ko ». */
export const mo = (b: number): string => (b >= MiB ? `${one.format(b / MiB)}${NB}Mo` : `${int.format(b / 1024)}${NB}Ko`)

/** « 38,1 / 92,4 Mo » (l'unité une seule fois, celle du total). */
export function pair(done: number, total: number): string {
  if (total >= MiB) return `${one.format(done / MiB)} / ${one.format(total / MiB)}${NB}Mo`
  return `${int.format(done / 1024)} / ${int.format(total / 1024)}${NB}Ko`
}

export const speed = (bps: number): string => `${mo(bps)}/s`

/** Rythme des paquets de lumière : lent (< 1 Mio/s), moyen (< 8 Mio/s), rapide. */
export type Rate = 'slow' | 'mid' | 'fast'
export const rate = (bps = 0): Rate => (bps < MiB ? 'slow' : bps < 8 * MiB ? 'mid' : 'fast')

/** « 38 s », « 1 min 12 s », « 4 min ». */
export function duration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return `${s}${NB}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}${NB}min ${r}${NB}s` : `${m}${NB}min`
}

/** « 3f9a1c0e…a77d8b21 » */
export const fpShort = (hex: string): string => `${hex.slice(0, 8)}…${hex.slice(-8)}`

/** Les 32 premiers caractères par groupes de 4, pour À propos : « 3f9a 1c0e 77b2 … ». */
export const fpGroups = (hex: string): string => `${(hex.slice(0, 32).match(/.{1,4}/g) ?? []).join(' ')} …`
