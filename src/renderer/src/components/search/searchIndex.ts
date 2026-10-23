// Recherche globale (Ctrl K) : jeux, amis, membres du serveur Discord, pages et actions de l'appli.
// Fonctions pures, testées à part (npm run test:search).
import { norm } from '@shared/text'

export type SearchKind = 'game' | 'friend' | 'member' | 'page'

export interface SearchEntry {
  /** Unique dans toute la liste (`game:steam:730`, `page:settings:accounts`…). */
  id: string
  kind: SearchKind
  label: string
  /** Ligne d'appoint à droite (plateforme, statut, emplacement). */
  hint?: string
  /** Autres mots qui trouvent cette entrée (« version » pour À propos…). */
  keywords?: string[]
}

export interface SearchGroup<T extends SearchEntry = SearchEntry> {
  kind: SearchKind
  title: string
  items: T[]
}

const GROUPS: { kind: SearchKind; title: string; max: number }[] = [
  { kind: 'game', title: 'Jeux', max: 5 },
  { kind: 'friend', title: 'Amis', max: 4 },
  { kind: 'member', title: 'Membres du serveur', max: 3 },
  { kind: 'page', title: 'Aller à', max: 5 }
]

/**
 * Proximité d'un texte avec la requête : 0 commence par, 1 un mot commence par, 2 contient, 3 mot-clé ; -1 rien.
 * Une ou deux lettres ne trouvent que les débuts de mot. Tolérant aux accents et à la ponctuation ; repli sur une simple sous-chaîne si la requête n'a que des symboles.
 */
export function score(entry: SearchEntry, query: string): number {
  const q = query.trim()
  if (!q) return -1
  const key = norm(q)
  if (!key) return entry.label.toLowerCase().includes(q.toLowerCase()) ? 2 : -1
  const whole = norm(entry.label)
  if (whole.startsWith(key)) return 0
  const words = entry.label
    .split(/[\s\-–:›·/]+/)
    .map(norm)
    .filter(Boolean)
  if (words.some((w) => w.startsWith(key))) return 1
  // Une ou deux lettres : seulement les débuts, sinon presque tout correspondrait (« ro » dans Trophées, Profil…).
  if (key.length < 3) return -1
  if (whole.includes(key)) return 2
  if (entry.keywords?.some((k) => norm(k).startsWith(key))) return 3
  return -1
}

/** Résultats groupés, les plus proches d'abord (ordre d'origine à égalité : jeux récents en tête). */
export function searchAll<T extends SearchEntry>(entries: T[], query: string): SearchGroup<T>[] {
  const scored = entries.map((e, i) => ({ e, i, s: score(e, query) })).filter((x) => x.s >= 0)
  scored.sort((a, b) => a.s - b.s || a.i - b.i)
  return GROUPS.map((g) => ({
    kind: g.kind,
    title: g.title,
    items: scored
      .filter((x) => x.e.kind === g.kind)
      .slice(0, g.max)
      .map((x) => x.e)
  })).filter((g) => g.items.length > 0)
}

/** Nombre total de jeux trouvés (au-delà des 5 montrés), pour « Voir les N jeux dans la Bibliothèque ». */
export function countGames(entries: SearchEntry[], query: string): number {
  return entries.filter((e) => e.kind === 'game' && score(e, query) >= 0).length
}
