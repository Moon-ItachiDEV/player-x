import { net } from 'electron'
import type { Game, GameNews, NewsPost } from '@shared/types'
import { getKv, setKv } from '../db'
import { steamAppIds } from './artwork'
import { cleanRawNews, isPatchPost, toNewsPost, type RawNews } from './newsFormat'
import { getSettings } from './settings'

// Actus des jeux : les annonces officielles publiées sur Steam (notes de patch comprises), via ISteamNews/GetNewsForApp.
// API publique, sans clé. Les jeux EA et Epic passent par l'appid Steam trouvé pour leurs jaquettes (artwork.ts).
// Deux lectures :
//  - la fiche d'un jeu : ses dernières annonces complètes, à l'ouverture (gardées 30 min en mémoire) ;
//  - le badge « Nouveau patch » : les titres des dernières annonces de chaque jeu, au plus toutes les 6 h.

const API = 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/'
const TIMEOUT_MS = 15_000
const POSTS_COUNT = 8
const POSTS_MAX_AGE = 30 * 60_000
const INDEX_MAX_AGE = 6 * 3600_000
/** Un relevé qui n'a pas été refait depuis (jeu désinstallé) est oublié. */
const INDEX_FORGET_MS = 30 * 24 * 3600_000
/** Un patch plus ancien n'a plus de badge, même jamais vu. */
const PATCH_FRESH_MS = 7 * 24 * 3600_000
/** Premier relevé des badges peu après le démarrage, puis toutes les heures (seuls les jeux relevés il y a plus de 6 h sont redemandés). */
const FIRST_RUN_MS = 45_000
const RUN_EVERY_MS = 3600_000
const PARALLEL = 4

const NETWORK_ERROR = 'Connexion à Steam impossible : vérifie ta connexion internet.'
const SERVICE_ERROR = 'Steam ne répond pas pour le moment. Réessaie dans quelques minutes.'

class UserError extends Error {}

/** Ce que le badge sait d'un jeu (par appid) : sa dernière annonce et son dernier patch. */
interface IndexEntry {
  at: number
  /** Date de la plus récente annonce (0 : aucune). */
  latest: number
  patch?: { id: string; title: string; date: number }
}
type NewsIndex = Record<string, IndexEntry>

const INDEX_KEY = 'newsIndex'

/** appid → annonces complètes lues pour la fiche. */
const posts = new Map<string, { at: number; posts: NewsPost[] }>()
let onChange: () => void = () => {}

/** Comme le reste du mode démo, ce qui a été vu dans les fiches de démo vit à part. */
function seenKey(): string {
  return getSettings().demoMode ? 'demoNewsSeen' : 'newsSeen'
}

function seenMap(): Record<string, number> {
  return getKv<Record<string, number>>(seenKey(), {})
}

// ---------- lecture de l'API ----------

async function fetchNews(appId: string, count: number, maxlength: number): Promise<RawNews[]> {
  const url = `${API}?appid=${appId}&count=${count}&maxlength=${maxlength}&feeds=steam_community_announcements&format=json`
  let res: Response
  try {
    res = await net.fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new UserError(NETWORK_ERROR)
  }
  if (!res.ok) throw new UserError(SERVICE_ERROR)
  let body: { appnews?: { newsitems?: unknown } }
  try {
    body = (await res.json()) as typeof body
  } catch {
    throw new UserError(SERVICE_ERROR)
  }
  const items = body?.appnews?.newsitems
  return (Array.isArray(items) ? items : [])
    .map(cleanRawNews)
    .filter((n): n is RawNews => !!n)
    .sort((a, b) => b.date - a.date)
}

function entryFrom(items: RawNews[], at: number): IndexEntry {
  const patch = items.find((n) => isPatchPost(n.title, n.tags))
  return { at, latest: items[0]?.date ?? 0, ...(patch ? { patch: { id: patch.gid, title: patch.title, date: patch.date } } : {}) }
}

/** Range les relevés ; prévient l'interface si un badge peut avoir changé. */
function updateIndex(updates: NewsIndex): void {
  const now = Date.now()
  const index = getKv<NewsIndex>(INDEX_KEY, {})
  const changed = Object.entries(updates).some(([id, e]) => index[id]?.patch?.id !== e.patch?.id || index[id]?.latest !== e.latest)
  const next = Object.fromEntries(Object.entries({ ...index, ...updates }).filter(([, e]) => now - e.at < INDEX_FORGET_MS))
  setKv(INDEX_KEY, next)
  if (changed) onChange()
}

// ---------- fiche d'un jeu ----------

export async function getGameNews(game: Game, refresh = false): Promise<GameNews> {
  const appId = steamAppIds([game]).get(game.id) ?? null
  const seenAt = seenMap()[game.id] ?? 0
  if (!appId) return { appId: null, posts: [], seenAt }
  const cached = posts.get(appId)
  if (cached && !refresh && Date.now() - cached.at < POSTS_MAX_AGE) return { appId, posts: cached.posts, seenAt }
  let raw: RawNews[]
  try {
    raw = await fetchNews(appId, POSTS_COUNT, 0)
  } catch (e) {
    // Hors ligne : la dernière lecture vaut mieux que rien.
    if (cached) return { appId, posts: cached.posts, seenAt }
    throw new UserError(e instanceof UserError ? e.message : SERVICE_ERROR)
  }
  const now = Date.now()
  const list = raw.map(toNewsPost)
  posts.set(appId, { at: now, posts: list })
  // Le badge suit ce qu'on vient de lire.
  updateIndex({ [appId]: entryFrom(raw, now) })
  return { appId, posts: list, seenAt }
}

/** Les actus de ce jeu ont été vues : plus de badge jusqu'à la prochaine annonce. */
export function markNewsSeen(game: Game): void {
  const appId = steamAppIds([game]).get(game.id)
  if (!appId) return
  const latest = Math.max(getKv<NewsIndex>(INDEX_KEY, {})[appId]?.latest ?? 0, posts.get(appId)?.posts[0]?.date ?? 0)
  const key = seenKey()
  const seen = getKv<Record<string, number>>(key, {})
  if (!latest || (seen[game.id] ?? 0) >= latest) return
  setKv(key, { ...seen, [game.id]: latest })
  onChange()
}

// ---------- badges « Nouveau patch » ----------

/** Ajoute le badge aux jeux dont le dernier patch date de moins de 7 jours et n'a pas été vu dans la fiche. */
export function withNews(games: Game[]): Game[] {
  if (!getSettings().gameNews) return games
  const index = getKv<NewsIndex>(INDEX_KEY, {})
  const seen = seenMap()
  const ids = steamAppIds(games)
  const now = Date.now()
  return games.map((g) => {
    const appId = ids.get(g.id)
    const patch = appId ? index[appId]?.patch : undefined
    if (!patch || now - patch.date > PATCH_FRESH_MS || patch.date <= (seen[g.id] ?? 0)) return g
    return { ...g, newPatch: { id: patch.id, title: patch.title, at: patch.date } }
  })
}

let refreshing = false

/** Relève les dernières annonces des jeux qui n'ont pas été relevés depuis 6 h. */
export async function refreshNewsIndex(games: Game[]): Promise<void> {
  if (refreshing || !getSettings().gameNews) return
  refreshing = true
  try {
    const index = getKv<NewsIndex>(INDEX_KEY, {})
    const now = Date.now()
    const stale = [...new Set(steamAppIds(games).values())].filter((id) => !index[id] || now - index[id].at > INDEX_MAX_AGE)
    const updates: NewsIndex = {}
    for (let i = 0; i < stale.length; i += PARALLEL) {
      await Promise.all(
        stale.slice(i, i + PARALLEL).map(async (appId) => {
          try {
            // Titres seulement : le texte des annonces n'est lu qu'à l'ouverture de la fiche.
            updates[appId] = entryFrom(await fetchNews(appId, 5, 1), Date.now())
          } catch {
            /* hors ligne ou Steam indisponible : au prochain passage */
          }
        })
      )
    }
    if (Object.keys(updates).length) updateIndex(updates)
  } finally {
    refreshing = false
  }
}

/** `listGames` : la bibliothèque affichée (vraie ou de démo). `notify` : les badges ont pu changer. */
export function startNewsWatcher(listGames: () => Game[], notify: () => void): void {
  onChange = notify
  const run = (): void => {
    Promise.resolve()
      .then(() => refreshNewsIndex(listGames()))
      .catch(() => {})
  }
  setTimeout(run, FIRST_RUN_MS)
  setInterval(run, RUN_EVERY_MS)
}
