// Passage de relais entre la version qui se ferme et celle qui démarre : ce qui est mesuré (durée, empreinte) survit au redémarrage.
// Module pur, sans import d'Electron : testé sous Node seul (npm run test:update).
import type { LastUpdate } from '@shared/types'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

/** Écrit dans la base juste avant de fermer pour installer, relu au démarrage suivant. */
export interface PendingUpdate {
  from: string
  to: string
  fingerprint?: string
  size?: number
  downloadMs?: number
  quitAt: number
  relaunch: boolean
  bounds?: WindowBounds
}

/** Zone utile d'un écran (workArea d'Electron). */
export interface Area {
  x: number
  y: number
  width: number
  height: number
}

/** Délai maximal avant quitAndInstall, quoi que demande l'interface. */
export const MAX_INSTALL_DELAY = 1500
/** Au-delà, « de retour en » ne veut plus rien dire (PC en veille, installeur bloqué…). */
export const MAX_BACK_MS = 180_000
/** Même minimum que la fenêtre (minWidth, minHeight dans index.ts). */
const MIN_W = 1024
const MIN_H = 640

export function clampDelay(raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0
  return Math.min(MAX_INSTALL_DELAY, Math.max(0, n))
}

const str = (v: unknown, max = 64): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const optNum = (v: unknown): boolean => v === undefined || num(v)
/** SHA-512 en hexadécimal minuscule, tel que calculé par updater.ts. */
const optHex = (v: unknown): boolean => v === undefined || (typeof v === 'string' && /^[0-9a-f]{128}$/.test(v))

export function isPending(v: unknown): v is PendingUpdate {
  const p = v as PendingUpdate | null
  return (
    !!p &&
    typeof p === 'object' &&
    str(p.from) &&
    str(p.to) &&
    num(p.quitAt) &&
    typeof p.relaunch === 'boolean' &&
    optHex(p.fingerprint) &&
    optNum(p.size) &&
    optNum(p.downloadMs)
  )
}

/** Dernière mise à jour relue de la base : la valeur est montrée telle quelle par l'interface, on la vérifie. */
export function isLast(v: unknown): v is LastUpdate {
  const l = v as LastUpdate | null
  return (
    !!l &&
    typeof l === 'object' &&
    str(l.from) &&
    str(l.to) &&
    num(l.installedAt) &&
    typeof l.relaunch === 'boolean' &&
    optHex(l.fingerprint) &&
    optNum(l.size) &&
    optNum(l.downloadMs) &&
    optNum(l.backMs)
  )
}

/** `null` si la version qui démarre n'est pas celle qui devait s'installer (installation ratée ou annulée). */
export function lastFromPending(p: PendingUpdate, version: string, now: number): LastUpdate | null {
  if (p.to !== version) return null
  const back = now - p.quitAt
  return {
    from: p.from,
    to: p.to,
    fingerprint: p.fingerprint,
    size: p.size,
    downloadMs: p.downloadMs,
    installedAt: now,
    relaunch: p.relaunch,
    backMs: p.relaunch && back > 0 && back <= MAX_BACK_MS ? back : undefined,
    thisBoot: true
  }
}

const coord = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 100_000

/** Position enregistrée, si elle est bien formée, assez grande et encore visible sur un écran. Sinon `null` : taille par défaut. */
export function visibleBounds(raw: unknown, areas: Area[]): WindowBounds | null {
  const b = raw as WindowBounds | null
  if (!b || typeof b !== 'object' || !coord(b.x) || !coord(b.y) || !coord(b.width) || !coord(b.height) || typeof b.maximized !== 'boolean') return null
  if (b.width < MIN_W || b.height < MIN_H) return null
  // Au moins 64 px de la fenêtre sur l'écran, barre de titre comprise (écran débranché, résolution changée).
  const visible = areas.some(
    (a) => b.x < a.x + a.width - 64 && b.x + b.width > a.x + 64 && b.y >= a.y - 8 && b.y < a.y + a.height - 64
  )
  const r = Math.round
  return visible ? { x: r(b.x), y: r(b.y), width: r(b.width), height: r(b.height), maximized: b.maximized } : null
}
