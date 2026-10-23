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

/** Puce « Patchs seulement » et puces des jeux (`null` : tous). */
export function filterFeed(items: NewsFeedItem[], { patchesOnly, gameId }: { patchesOnly: boolean; gameId: string | null }): NewsFeedItem[] {
  return items.filter((i) => (!patchesOnly || i.patch) && (!gameId || i.gameId === gameId))
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

/**
 * Jeux présents dans le relevé, pour les puces et le menu « Autres jeux » : par nom, avec leur nombre d'annonces parmi
 * `counted` (la vue affichée : avec « Patchs seulement », seulement leurs patchs, 0 s'ils n'en ont pas).
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
