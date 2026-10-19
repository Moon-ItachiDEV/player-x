import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { net, powerMonitor } from 'electron'
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
let lastPoll = 0

/** Toutes les sessions s'arrêtent (mise en veille, ou trop longtemps sans relevé) : le temps passé n'est pas compté. */
function endAll(): boolean {
  if (!running.size) return false
  running.clear()
  return true
}

export interface RunningProcess {
  /** Nom sans « .exe », toujours lisible. */
  name: string
  /** Chemin complet : vide pour un processus protégé (anti-triche) ou lancé en administrateur. */
  path: string
}

// Sortie en UTF-8 (sinon PowerShell 5.1 écrit dans la page de code OEM et les chemins accentués ne correspondent plus).
const PS_COMMAND = '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Process | ForEach-Object { $_.ProcessName + [char]9 + $_.Path }'

/** Programmes en cours (Windows uniquement). */
function runningProcesses(): Promise<RunningProcess[]> {
  if (process.platform !== 'win32') return Promise.resolve([])
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PS_COMMAND],
      { windowsHide: true, timeout: 20_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout) =>
        resolve(
          err
            ? []
            : stdout
                .split(/\r?\n/)
                .filter(Boolean)
                .map((line) => {
                  const [name = '', path = ''] = line.split('\t')
                  return { name: name.trim(), path: path.trim() }
                })
        )
    )
  })
}

// ---------- exécutables de chaque jeu (pour les processus dont le chemin est illisible) ----------

/** Exécutables trop génériques pour désigner un jeu (installeurs, rapports de plantage, anti-triche, navigateurs intégrés…). */
const GENERIC_EXE =
  /^(unins\d*|uninstall.*|setup.*|install.*|vc_?redist.*|dxsetup|dotnet.*|directx.*|ue\dprereqsetup.*|.*crash.*|.*report.*|easyanticheat.*|eac.*|beservice.*|battleye.*|.*launcher.*|.*updater.*|.*helper.*|cef.*|.*webview.*|quicksfv|touchup|cleanup|activation.*|pbsvc|start_protected_game)$/i
const MAX_SCAN_ENTRIES = 3000

/** dossier → noms d'exécutables (minuscules, sans « .exe ») */
const exeCache = new Map<string, Set<string>>()

async function exeNames(dir: string): Promise<Set<string>> {
  const cached = exeCache.get(dir)
  if (cached) return cached
  const names = new Set<string>()
  exeCache.set(dir, names)
  let seen = 0
  const walk = async (d: string, depth: number): Promise<void> => {
    if (depth > 3 || seen > MAX_SCAN_ENTRIES) return
    let entries
    try {
      entries = await readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (++seen > MAX_SCAN_ENTRIES) return
      if (e.isDirectory()) await walk(join(d, e.name), depth + 1)
      else if (/\.exe$/i.test(e.name)) {
        const n = e.name.slice(0, -4).toLowerCase()
        if (!GENERIC_EXE.test(n)) names.add(n)
      }
    }
  }
  await walk(dir, 0)
  return names
}

const normPath = (p: string): string => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()

/** Dossiers trop courts (« C:\Games ») : on ne les rattache à aucun jeu pour éviter les faux positifs. */
const usableDir = (dir: string): boolean => normPath(dir).split('\\').filter(Boolean).length >= 3

type Matchable = Pick<Game, 'id' | 'installDir' | 'exePath'>

export function runningGameIds(procs: RunningProcess[], games: Matchable[], namesByGame: Map<string, Set<string>> = new Map()): Set<string> {
  const dirs = games
    .filter((g) => g.installDir && usableDir(g.installDir))
    .map((g) => ({ id: g.id, dir: normPath(g.installDir!) + '\\' }))
    // Le dossier le plus précis gagne si deux jeux sont imbriqués.
    .sort((a, b) => b.dir.length - a.dir.length)
  const exes = new Map(games.filter((g) => g.exePath).map((g) => [normPath(g.exePath!), g.id]))
  const byName = new Map<string, string>()
  for (const g of games) {
    if (g.exePath) byName.set(basename(normPath(g.exePath), '.exe'), g.id)
    for (const n of namesByGame.get(g.id) ?? []) if (!byName.has(n)) byName.set(n, g.id)
  }
  const found = new Set<string>()
  for (const proc of procs) {
    let id: string | undefined
    if (proc.path) {
      const p = normPath(proc.path)
      id = exes.get(p) ?? dirs.find((d) => p.startsWith(d.dir))?.id
    } else {
      // Chemin illisible (jeu protégé par un anti-triche ou lancé en administrateur) : on compare le nom de l'exécutable.
      id = byName.get(proc.name.toLowerCase())
    }
    if (id) found.add(id)
  }
  return found
}

async function gameExeNames(games: Matchable[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>()
  for (const g of games) if (g.installDir && usableDir(g.installDir)) out.set(g.id, await exeNames(g.installDir))
  return out
}

async function poll(): Promise<void> {
  if (polling) return
  polling = true
  try {
    const now = Date.now()
    // Un trou de plus de trois relevés (veille, PC figé) : les sessions en cours s'arrêtent au dernier relevé.
    let changed = lastPoll > 0 && now - lastPoll > POLL_MS * 3 ? endAll() : false
    lastPoll = now
    const games = listGames()
    const procs = await runningProcesses()
    const seen = runningGameIds(procs, games, procs.some((p) => !p.path) ? await gameExeNames(games) : undefined)
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
  powerMonitor.on('suspend', () => endAll() && onChange())
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
