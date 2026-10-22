// Présentation du relevé des actus : rangée « Mises à jour de tes jeux » de l'accueil et page Actus des jeux.
// Module pur, sans React : testé sous Node seul (npm run test:news).
import type { NewsFeedItem } from '@shared/types'

/** Rangée de l'accueil : au plus tant de patchs… */
export const HOME_MAX = 10
/** … de moins de 60 jours. */
export const HOME_MAX_AGE = 60 * 24 * 3600_000

/** Rangée de l'accueil : les patchs récents seulement, dans l'ordre du relevé (les plus récents d'abord). */
export function homeFeed(items: NewsFeedItem[], now: number): NewsFeedItem[] {
  return items.filter((i) => i.patch && now - i.date < HOME_MAX_AGE).slice(0, HOME_MAX)
}

export type Bucket = 'today' | 'yesterday' | 'week' | 'month' | 'older'
export const BUCKETS: Bucket[] = ['today', 'yesterday', 'week', 'month', 'older']
/** Groupes glissants (7 et 30 jours), pas la semaine ni le mois du calendrier : les titres le disent. */
export const BUCKET_LABEL: Record<Bucket, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  week: 'Ces 7 derniers jours',
  month: 'Ces 30 derniers jours',
  older: 'Plus ancien'
}

/** Minuit (heure locale) du jour de `t`. */
function dayStart(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Groupe d'une annonce, par jour du calendrier local. Une date dans le futur (horloge de Steam en avance) compte pour aujourd'hui. */
export function bucketOf(date: number, now: number): Bucket {
  const today = dayStart(now)
  if (date >= today) return 'today'
  // Arrondi : un passage à l'heure d'été ou d'hiver fait des jours de 23 h ou 25 h.
  const days = Math.round((today - dayStart(date)) / 86_400_000)
  if (days <= 1) return 'yesterday'
  if (days < 7) return 'week'
  if (days < 30) return 'month'
  return 'older'
}

/** Annonces groupées par jour, groupes vides retirés ; l'ordre des annonces est gardé. */
export function groupFeed(items: NewsFeedItem[], now: number): { bucket: Bucket; items: NewsFeedItem[] }[] {
  const groups = new Map<Bucket, NewsFeedItem[]>(BUCKETS.map((b) => [b, []]))
  for (const i of items) groups.get(bucketOf(i.date, now))!.push(i)
  return BUCKETS.flatMap((bucket) => {
    const list = groups.get(bucket)!
    return list.length ? [{ bucket, items: list }] : []
  })
}

/** Onglet « Patchs » et menu « Jeu » (`null` : tous). */
export function filterFeed(items: NewsFeedItem[], { patchesOnly, gameId }: { patchesOnly: boolean; gameId: string | null }): NewsFeedItem[] {
  return items.filter((i) => (!patchesOnly || i.patch) && (!gameId || i.gameId === gameId))
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

/**
 * Jeux présents dans le relevé, pour le menu « Jeu » : par nom, avec leur nombre d'annonces parmi `counted` (l'onglet
 * affiché : dans « Patchs », seulement leurs patchs, 0 s'ils n'en ont pas).
 */
export function feedGames(items: NewsFeedItem[], counted: NewsFeedItem[] = items): { id: string; name: string; count: number }[] {
  const games = new Map<string, { id: string; name: string; count: number }>()
  for (const i of items) if (!games.has(i.gameId)) games.set(i.gameId, { id: i.gameId, name: i.gameName, count: 0 })
  for (const i of counted) {
    const g = games.get(i.gameId)
    if (g) g.count++
  }
  return [...games.values()].sort((a, b) => collator.compare(a.name, b.name))
}
