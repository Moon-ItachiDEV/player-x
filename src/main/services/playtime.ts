import { execFile } from 'node:child_process'
import { net } from 'electron'
import type { Game } from '@shared/types'
import { getKv, listGames, openSession, playtimeByGame, setKv, touchSessions } from '../db'
import { getAccounts, getSettings } from './settings'

// Temps de jeu : toutes les minutes, on regarde quels programmes tournent et on les rattache au dossier
// d'installation d'un jeu. Ça marche aussi pour un jeu lancé hors de Player X, tant que Player X est ouvert.
// Pour les jeux Steam, le compteur de Steam (tout l'historique) prend le relais quand la clé Web API est là.

const POLL_MS = 60_000
/** Après un lancement depuis Player X : vérifications rapprochées, le temps que le jeu démarre. */
const NUDGE_MS = [20_000, 45_000]
const STEAM_MAX_AGE = 3600_000
const TIMEOUT_MS = 15_000

/** Jeu en cours → session ouverte dans la base. */
const running = new Map<string, number>()
let onChange: () => void = () => {}
let polling = false

/** Chemins des exécutables en cours (Windows uniquement). */
function processPaths(): Promise<string[]> {
  if (process.platform !== 'win32') return Promise.resolve([])
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Get-Process | Where-Object Path | ForEach-Object Path'],
      { windowsHide: true, timeout: 20_000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => resolve(err ? [] : stdout.split(/\r?\n/).filter(Boolean))
    )
  })
}

const normPath = (p: string): string => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()

/** Dossiers trop courts (« C:\Games ») : on ne les rattache à aucun jeu pour éviter les faux positifs. */
const usableDir = (dir: string): boolean => normPath(dir).split('\\').filter(Boolean).length >= 3

export function runningGameIds(paths: string[], games: Pick<Game, 'id' | 'installDir' | 'exePath'>[]): Set<string> {
  const dirs = games
    .filter((g) => g.installDir && usableDir(g.installDir))
    .map((g) => ({ id: g.id, dir: normPath(g.installDir!) + '\\' }))
    // Le dossier le plus précis gagne si deux jeux sont imbriqués.
    .sort((a, b) => b.dir.length - a.dir.length)
  const exes = new Map(games.filter((g) => g.exePath).map((g) => [normPath(g.exePath!), g.id]))
  const found = new Set<string>()
  for (const raw of paths) {
    const p = normPath(raw)
    const id = exes.get(p) ?? dirs.find((d) => p.startsWith(d.dir))?.id
    if (id) found.add(id)
  }
  return found
}

async function poll(): Promise<void> {
  if (polling) return
  polling = true
  try {
    const now = Date.now()
    const seen = runningGameIds(await processPaths(), listGames())
    let changed = false
    for (const id of [...running.keys()]) {
      if (seen.has(id)) continue
      // Session terminée : sa fin reste la dernière fois où le jeu a été vu.
      running.delete(id)
      changed = true
    }
    touchSessions([...running.values()], now)
    for (const id of seen) {
      if (running.has(id)) continue
      running.set(id, openSession(id, now))
      changed = true
    }
    if (changed) onChange()
  } finally {
    polling = false
  }
}

export function startPlaytimeTracker(notify: () => void): void {
  onChange = notify
  if (process.platform !== 'win32') return
  setTimeout(poll, 5_000)
  setInterval(poll, POLL_MS)
}

/** Un jeu vient d'être lancé depuis Player X. */
export function nudgePlaytime(): void {
  if (process.platform !== 'win32') return
  for (const ms of NUDGE_MS) setTimeout(poll, ms)
}

// ---------- compteur Steam ----------

interface SteamPlaytime {
  at: number
  steamId: string
  /** appid → minutes */
  minutes: Record<string, number>
}

let steamLoading = false

async function refreshSteamPlaytime(key: string, steamId: string): Promise<void> {
  if (steamLoading) return
  steamLoading = true
  try {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(key)}&steamid=${steamId}&include_played_free_games=1&include_appinfo=0`
    const res = await net.fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return
    const body = (await res.json()) as { response?: { games?: { appid: number; playtime_forever?: number }[] } }
    // Détails de jeu privés : réponse vide, on garde le temps mesuré par Player X.
    const minutes = Object.fromEntries((body.response?.games ?? []).map((g) => [String(g.appid), g.playtime_forever ?? 0]))
    setKv('steamPlaytime', { at: Date.now(), steamId, minutes } satisfies SteamPlaytime)
    onChange()
  } catch {
    /* hors ligne : on réessaie au prochain affichage */
  } finally {
    steamLoading = false
  }
}

function steamMinutes(): Record<string, number> {
  const key = getSettings().steamApiKey
  const steamId = getAccounts().find((a) => a.platform === 'steam')?.id
  if (!key || !steamId) return {}
  const cached = getKv<SteamPlaytime | null>('steamPlaytime', null)
  const mine = cached?.steamId === steamId ? cached : null
  if (!mine || Date.now() - mine.at > STEAM_MAX_AGE) void refreshSteamPlaytime(key, steamId)
  return mine?.minutes ?? {}
}

/** Ajoute le temps de jeu et l'état « en jeu » à la vraie bibliothèque. */
export function withPlaytime(games: Game[]): Game[] {
  const local = playtimeByGame()
  const steam = steamMinutes()
  return games.map((g) => {
    const mine = local.get(g.id) ?? 0
    const fromSteam = g.store === 'steam' ? steam[g.storeId] : undefined
    // Le compteur Steam peut avoir une heure de retard sur une session en cours : on garde le plus grand.
    const useSteam = fromSteam !== undefined && fromSteam >= mine
    const playtime = useSteam ? fromSteam : mine
    return {
      ...g,
      ...(playtime > 0 ? { playtime, playtimeSource: useSteam ? ('steam' as const) : ('local' as const) } : {}),
      ...(running.has(g.id) ? { running: true } : {})
    }
  })
}
