// Relevé des actus des jeux : ce qu'on garde des dernières annonces de chaque jeu (par appid Steam), et ce qu'on en tire
// (badge « Nouveau patch », dernier patch, page Actus des jeux). Module pur, sans Electron : testé sous Node seul (npm run test:news).
import { cleanName } from '@shared/text'
import type { Game, NewsFeedItem } from '@shared/types'
import { isPatchPost, type RawNews } from './newsFormat'

/** Annonces gardées par jeu dans le relevé (titres seulement). */
export const ITEMS_PER_GAME = 5
/** Page Actus des jeux : au plus tant d'annonces. */
export const FEED_MAX = 200
/** Comme NEW_MS de NewsSection.tsx : au-delà de 7 jours, plus de badge « Nouveau patch » ni de « Nouveau ». */
export const NEW_MS = 7 * 24 * 3600_000

export interface IndexItem {
  id: string
  title: string
  url: string
  date: number
  patch: boolean
}

/** Ce que le relevé sait d'un jeu : ses dernières annonces et son dernier patch. */
export interface IndexEntry {
  at: number
  /** Date de la plus récente annonce (0 : aucune). */
  latest: number
  patch?: { id: string; title: string; date: number }
  /** Absent des relevés de la 0.7.2 : relevé redemandé une fois. */
  items?: IndexItem[]
}

export type NewsIndex = Record<string, IndexEntry>

/** Relevé d'un jeu à partir de ses annonces (les plus récentes d'abord). Le dernier patch est cherché dans toutes. */
export function entryFrom(raw: RawNews[], at: number): IndexEntry {
  const patch = raw.find((n) => isPatchPost(n.title, n.tags))
  return {
    at,
    latest: raw[0]?.date ?? 0,
    ...(patch ? { patch: { id: patch.gid, title: patch.title, date: patch.date } } : {}),
    items: raw.slice(0, ITEMS_PER_GAME).map((n) => ({ id: n.gid, title: n.title, url: n.url, date: n.date, patch: isPatchPost(n.title, n.tags) }))
  }
}

/** À relever : jamais relevé, relevé d'avant la 0.7.4 (sans annonces), ou plus vieux que `maxAge`. */
export function needsRefresh(entry: IndexEntry | undefined, now: number, maxAge: number): boolean {
  return !entry || !entry.items || now - entry.at > maxAge
}

/** Nouvelle date « vu jusqu'à » : toutes les annonces (sans `upTo`), ou seulement jusqu'à celle qu'on vient de lire. Jamais en arrière. */
export function nextSeen(prev: number, latest: number, upTo?: unknown): number {
  if (upTo === undefined) return Math.max(prev, latest)
  if (typeof upTo === 'number' && Number.isFinite(upTo) && upTo > 0) return Math.max(prev, Math.min(upTo, latest))
  return prev
}

/** Dernier patch du jeu (`lastPatch`, même vu ou ancien) et badge « Nouveau patch » (moins de 7 jours, pas encore vu). */
export function patchFlags(entry: IndexEntry | undefined, seenAt: number, now: number): Pick<Game, 'newPatch' | 'lastPatch'> {
  const p = entry?.patch
  if (!p) return {}
  const lastPatch = { id: p.id, title: p.title, at: p.date }
  return now - p.date < NEW_MS && p.date > seenAt ? { newPatch: { ...lastPatch }, lastPatch } : { lastPatch }
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

/**
 * Annonces de tous les jeux suivis, les plus récentes d'abord. Un appid partagé (Battlefield 6 sur EA et sur Steam) n'est
 * compté qu'une fois, pour le jeu joué le plus récemment.
 */
export function buildFeed(
  index: NewsIndex,
  games: { id: string; name: string; appId: string; lastPlayed?: number }[],
  seen: Record<string, number>,
  now: number
): NewsFeedItem[] {
  const owners = [...games].sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
  const taken = new Set<string>()
  const keys = new Set<string>()
  const items: NewsFeedItem[] = []
  for (const g of owners) {
    if (taken.has(g.appId)) continue
    taken.add(g.appId)
    const entry = index[g.appId]
    if (!entry?.items) continue
    const seenAt = seen[g.id] ?? 0
    const gameName = cleanName(g.name)
    for (const it of entry.items) {
      const key = `${g.appId}:${it.id}`
      if (keys.has(key)) continue
      keys.add(key)
      items.push({ id: it.id, gameId: g.id, gameName, title: it.title, url: it.url, date: it.date, patch: it.patch, isNew: it.date > seenAt && now - it.date < NEW_MS })
    }
  }
  items.sort((a, b) => b.date - a.date || collator.compare(a.gameName, b.gameName))
  return items.slice(0, FEED_MAX)
}
