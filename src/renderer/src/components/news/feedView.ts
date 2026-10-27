// Présentation du relevé des actus : rangée « Mises à jour de tes jeux » de l'accueil et page Actus des jeux.
// Module pur, sans React : testé sous Node seul (npm run test:news).
import { cleanName } from '@shared/text'
import type { NewsFeedItem } from '@shared/types'

/** Rangée de l'accueil : au plus tant de patchs… */
export const HOME_MAX = 10
/** … de moins de 60 jours. */
export const HOME_MAX_AGE = 60 * 24 * 3600_000

/** Rangée de l'accueil : les patchs récents seulement, dans l'ordre du relevé (les plus récents d'abord). */
export function homeFeed(items: NewsFeedItem[], now: number): NewsFeedItem[] {
  return items.filter((i) => i.patch && now - i.date < HOME_MAX_AGE).slice(0, HOME_MAX)
}

/** Onglet « Patchs » et jeu choisi (`null` : tous). */
export function filterFeed(items: NewsFeedItem[], { patchesOnly, gameId }: { patchesOnly: boolean; gameId: string | null }): NewsFeedItem[] {
  return items.filter((i) => (!patchesOnly || i.patch) && (!gameId || i.gameId === gameId))
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

/**
 * Jeux présents dans le relevé, par nom, avec leur nombre d'annonces parmi `counted` (la vue affichée : dans l'onglet
 * « Patchs », seulement leurs patchs, 0 s'ils n'en ont pas).
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

// ---------- « Tes jeux » : les annonces rangées par jeu ----------

/** Annonces montrées sous chaque jeu ; au-delà, « Voir les N patchs » ouvre la vue du jeu. */
export const GAME_LINES = 3

export interface FeedGroup {
  gameId: string
  gameName: string
  /** Ses annonces de la vue, les plus récentes d'abord. */
  items: NewsFeedItem[]
  /** Date de sa plus récente annonce. */
  latest: number
  /** Annonces pas encore lues (moins de 7 jours). */
  unread: number
}

/** Un jeu une seule fois, ses annonces dessous : le jeu qui a publié le plus récemment d'abord (à égalité, l'ordre du relevé). */
export function groupByGame(items: NewsFeedItem[]): FeedGroup[] {
  const groups = new Map<string, FeedGroup>()
  for (const i of items) {
    let g = groups.get(i.gameId)
    if (!g) {
      g = { gameId: i.gameId, gameName: i.gameName, items: [], latest: i.date, unread: 0 }
      groups.set(i.gameId, g)
    }
    g.items.push(i)
    g.latest = Math.max(g.latest, i.date)
    if (i.isNew) g.unread++
  }
  const list = [...groups.values()]
  for (const g of list) g.items.sort((a, b) => b.date - a.date)
  return list.sort((a, b) => b.latest - a.latest)
}

/** Une tuile de la liste : les annonces du jeu dans la vue, sans celle de la une ; `total` la compte. */
export interface ListGroup extends FeedGroup {
  /** Toutes ses annonces de la vue, celle de la une comprise : ce que montrera la vue du jeu (« Voir les N patchs »). */
  total: number
}

/**
 * La liste sous l'écran du haut : `shown[0]` est à la une, elle n'est pas répétée. Les jeux sont rangés par leur plus
 * récente annonce restante ; un jeu qui n'avait que l'annonce à la une disparaît de la liste.
 */
export function listGroups(shown: NewsFeedItem[]): ListGroup[] {
  const totals = new Map<string, number>()
  for (const i of shown) totals.set(i.gameId, (totals.get(i.gameId) ?? 0) + 1)
  return groupByGame(shown.slice(1)).map((g) => ({ ...g, total: totals.get(g.gameId) ?? g.items.length }))
}

// ---------- titre sans le nom du jeu ----------

const MARKS = /[™®©]/g
/** Ce qui sépare le nom du jeu du reste : « EA SPORTS FC™ 27 | Title Update », « Age of Empires IV – Update 17.0 ». */
const SEPARATOR = /^\s*[:|·•,–—-]/
/** Une suite plutôt qu'une annonce : « Hades II », « Hades 2 » (une version, elle, a un point : « Dota 2 7.40b »). */
const SEQUEL = /^(?:[IVX]+|\d{1,2})(?![\w.])/

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]")

/** Le nom complet, puis le nom sans son sous-titre (« Age of Empires IV: Anniversary Edition » → « Age of Empires IV »). */
function nameForms(gameName: string): string[] {
  const full = cleanName(gameName).replace(MARKS, '').trim()
  const base = full.split(/\s*(?::|\s[-–—]\s)\s*/)[0].trim()
  return [...new Set([full, base])].filter((n) => n.length >= 2)
}

/**
 * Titre d'une annonce sous le nom de son jeu, sans le répéter : « Counter-Strike 2 Release Notes » → « Release Notes »,
 * « EA SPORTS FC™ 27 | Title Update v1.1 » → « Title Update v1.1 ». Le titre entier reste quand le nom n'est pas au début,
 * quand il ne reste rien, quand c'est une suite (« Hades II … ») ou quand le titre est une phrase qui commence par le nom
 * (« Valheim is coming to consoles »). Le titre entier sert toujours pour les lecteurs d'écran.
 */
export function shortTitle(title: string, gameName: string): string {
  for (const name of nameForms(gameName)) {
    const words = name.split(/\s+/).map(escape)
    const m = new RegExp(`^\\s*${words.join('[™®©]*\\s+')}[™®©]*`, 'i').exec(title)
    if (!m) continue
    const after = title.slice(m[0].length)
    // Le nom continue (« Civilization VII » pour « Civilization VI ») : ce n'est pas lui.
    if (after && !/^[\s:|·•,–—-]/.test(after)) continue
    const separated = SEPARATOR.test(after)
    const rest = after.replace(/^[\s:|·•,–—-]+/, '').trim()
    if (!/[\p{L}\p{N}]/u.test(rest)) return title
    if (!separated && SEQUEL.test(rest)) return title
    // Sans séparateur, une suite en minuscule fait phrase avec le nom (« Valheim is coming… », « Portal 2 is 15 years old ») : titre entier.
    if (!separated && /^\p{Ll}/u.test(rest)) return title
    return rest.charAt(0).toUpperCase() + rest.slice(1)
  }
  return title
}

// ---------- nom du jeu ----------

/** « de Counter-Strike 2 », « d'ELDEN RING » : élision devant une voyelle, accentuée ou non (pas devant le y). */
export function ofGame(name: string): string {
  return /^[aeiouàâäéèêëîïôöùûü]/i.test(name) ? `d'${name}` : `de ${name}`
}

/** Au-delà de tant de caractères (après cleanName), le nom à la une passe à la taille au-dessous. */
export const LONG_NAME = 24

/** Taille du nom à la une : 'm' pour un nom long (« Age of Empires IV: Anniversary Edition »), sinon 'l'. */
export function heroNameSize(gameName: string): 'l' | 'm' {
  return cleanName(gameName).length > LONG_NAME ? 'm' : 'l'
}
