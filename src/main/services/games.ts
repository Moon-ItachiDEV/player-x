import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { shell } from 'electron'
import type { Game, ScanReport, Store } from '@shared/types'

const isWin = process.platform === 'win32'
const DRIVES = isWin ? ['C', 'D', 'E', 'F', 'G', 'H'] : []

function run(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => resolve(err ? null : stdout))
  })
}

async function regQuery(key: string, value: string): Promise<string | null> {
  if (!isWin) return null
  const out = await run('reg', ['query', key, '/v', value])
  return out?.match(new RegExp(`${value}\\s+REG_\\w+\\s+(.+)`))?.[1].trim() ?? null
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir)
  } catch {
    return []
  }
}

// ---------- Programmes installés (registre Windows) ----------
// Steam et l'EA app y déclarent chaque jeu : c'est le filet de sécurité quand les dossiers
// attendus ne sont pas là (bibliothèque sur un autre disque, installation personnalisée…).

interface UninstallEntry {
  key: string
  DisplayName?: string
  InstallLocation?: string
  Publisher?: string
  DisplayIcon?: string
  UninstallString?: string
}

let uninstallCache: Promise<UninstallEntry[]> | null = null

function uninstallEntries(): Promise<UninstallEntry[]> {
  if (!isWin) return Promise.resolve([])
  uninstallCache ??= (async () => {
    const roots = [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
    ]
    const entries: UninstallEntry[] = []
    for (const root of roots) {
      const out = await run('reg', ['query', root, '/s'])
      if (!out) continue
      let current: UninstallEntry | null = null
      for (const line of out.split(/\r?\n/)) {
        if (line.startsWith('HKEY_')) {
          current = { key: line.trim() }
          entries.push(current)
          continue
        }
        const m = line.match(/^\s+(DisplayName|InstallLocation|Publisher|DisplayIcon|UninstallString)\s+REG_\w+\s+(.*)$/)
        if (m && current) current[m[1] as 'DisplayName'] = m[2].trim()
      }
    }
    return entries
  })()
  return uninstallCache
}

// ---------- Steam ----------

// Outils et runtimes Steam qui ne sont pas des jeux.
const STEAM_NOT_GAMES = new Set(['228980', '1070560', '1391110', '1628350', '1493710', '2180100', '961940', '1580130'])

function vdfValue(text: string, key: string): string | undefined {
  return text.match(new RegExp(`"${key}"\\s+"([^"]*)"`, 'i'))?.[1]
}

function steamGame(appId: string, name: string, installDir?: string): Game {
  return {
    id: `steam:${appId}`,
    store: 'steam',
    storeId: appId,
    name,
    installDir,
    coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
    heroUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_hero.jpg`
  }
}

export async function scanSteam(report: ScanReport): Promise<Game[]> {
  const regPath = (await regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath'))?.replace(/\//g, '\\')
  const candidates = [
    regPath,
    ...DRIVES.flatMap((d) => [
      `${d}:\\Program Files (x86)\\Steam`,
      `${d}:\\Program Files\\Steam`,
      `${d}:\\Steam`,
      `${d}:\\SteamLibrary`,
      `${d}:\\Games\\Steam`,
      `${d}:\\Jeux\\Steam`
    ]),
    join(homedir(), '.steam', 'steam'),
    join(homedir(), '.local', 'share', 'Steam'),
    join(homedir(), 'Library', 'Application Support', 'Steam')
  ].filter((p): p is string => !!p)

  // Clé normalisée : le registre donne « c:/program files (x86)/steam », le .vdf « C:\\Program Files (x86)\\Steam ».
  const libraries = new Map<string, string>()
  const addLibrary = (p: string): void => {
    const key = isWin ? p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase() : p
    if (!libraries.has(key)) libraries.set(key, p)
  }
  for (const root of candidates) {
    if (!existsSync(join(root, 'steamapps'))) continue
    addLibrary(root)
    try {
      const vdf = await readFile(join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8')
      for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) addLibrary(m[1].replace(/\\\\/g, '\\'))
    } catch {
      /* pas de bibliothèque secondaire */
    }
  }
  report.checked.push(regPath ? `Registre Steam : ${regPath}` : 'Registre Steam : introuvable')
  report.checked.push(libraries.size ? `Bibliothèques : ${[...libraries.values()].join(', ')}` : 'Aucune bibliothèque Steam trouvée')

  const games = new Map<string, Game>()
  for (const lib of libraries.values()) {
    const appsDir = join(lib, 'steamapps')
    for (const file of await safeReaddir(appsDir)) {
      if (!/^appmanifest_\d+\.acf$/i.test(file)) continue
      try {
        const acf = await readFile(join(appsDir, file), 'utf8')
        const appId = vdfValue(acf, 'appid')
        const name = vdfValue(acf, 'name')
        if (!appId || !name || STEAM_NOT_GAMES.has(appId) || /redistributable|proton|steam linux runtime/i.test(name)) continue
        games.set(appId, steamGame(appId, name, join(appsDir, 'common', vdfValue(acf, 'installdir') ?? '')))
      } catch {
        /* manifeste illisible, on l'ignore */
      }
    }
  }

  // Filet de sécurité : entrées « Steam App <id> » du registre.
  let fromRegistry = 0
  for (const e of await uninstallEntries()) {
    const appId = e.key.match(/Steam App (\d+)$/)?.[1]
    if (!appId || games.has(appId) || STEAM_NOT_GAMES.has(appId) || !e.DisplayName) continue
    games.set(appId, steamGame(appId, e.DisplayName, e.InstallLocation))
    fromRegistry++
  }
  if (isWin) report.checked.push(`Programmes installés : ${fromRegistry} jeu(x) Steam en plus`)
  return [...games.values()]
}

// ---------- Epic Games ----------

interface EpicManifest {
  DisplayName: string
  AppName: string
  InstallLocation: string
  CatalogNamespace: string
  CatalogItemId: string
  bIsIncompleteInstall?: boolean
  AppCategories?: string[]
}

export async function scanEpic(report: ScanReport): Promise<Game[]> {
  const dir = join(process.env.ProgramData ?? 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')
  report.checked.push(existsSync(dir) ? `Manifestes : ${dir}` : `Dossier absent : ${dir}`)
  const games: Game[] = []
  for (const file of await safeReaddir(dir)) {
    if (!file.endsWith('.item')) continue
    try {
      const m = JSON.parse((await readFile(join(dir, file), 'utf8')).replace(/^\uFEFF/, '')) as EpicManifest
      if (m.bIsIncompleteInstall) continue
      if (m.AppCategories && !m.AppCategories.includes('games')) continue
      games.push({
        id: `epic:${m.AppName}`,
        store: 'epic',
        // Format attendu par le protocole com.epicgames.launcher://apps/
        storeId: `${m.CatalogNamespace}:${m.CatalogItemId}:${m.AppName}`,
        name: m.DisplayName,
        installDir: m.InstallLocation
      })
    } catch {
      /* manifeste illisible */
    }
  }
  return games
}

// ---------- EA app (expérimental) ----------
// Chaque jeu EA installé contient normalement __Installer/installerdata.xml avec ses contentIDs.
// Pour trouver les dossiers, on croise plusieurs sources : dossiers par défaut, dossier choisi dans
// l'EA app, clés de registre « EA Games » / « Electronic Arts » et programmes installés.

const NOT_GAME_EXE = /unins|setup|crash|report|redist|vc_|dxsetup|touchup|cleanup|launcher|helper|activation/i

/** Exécutable le plus probable à la racine d'un dossier de jeu (le plus gros .exe hors outils). */
async function guessExe(dir: string): Promise<string | undefined> {
  let best: { path: string; size: number } | undefined
  for (const f of await safeReaddir(dir)) {
    if (!f.toLowerCase().endsWith('.exe') || NOT_GAME_EXE.test(f)) continue
    try {
      const { size } = await stat(join(dir, f))
      if (!best || size > best.size) best = { path: join(dir, f), size }
    } catch {
      /* fichier inaccessible */
    }
  }
  return best?.path
}

async function readEaGame(installDir: string, fallbackName: string, exePath?: string): Promise<Game | null> {
  try {
    const xml = await readFile(join(installDir, '__Installer', 'installerdata.xml'), 'utf8')
    const contentId = xml.match(/<contentID>([^<]+)<\/contentID>/)?.[1]
    const title = xml.match(/<gameTitle locale="(?:fr_FR|en_US)">([^<]+)<\/gameTitle>/)?.[1]
    if (contentId) return { id: `ea:${contentId}`, store: 'ea', storeId: contentId, name: title ?? fallbackName, installDir, exePath }
  } catch {
    /* pas de fichier d'installation EA */
  }
  // Sans contentID on lancera l'exécutable directement (l'EA app s'ouvrira si le jeu l'exige).
  const exe = exePath ?? (await guessExe(installDir))
  if (exe) return { id: `ea:${fallbackName.toLowerCase()}`, store: 'ea', storeId: '', name: fallbackName, installDir, exePath: exe }
  return null
}

/** Dossier d'installation choisi dans l'EA app (Paramètres > Téléchargement). */
async function eaAppInstallDirs(): Promise<string[]> {
  const dir = join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Electronic Arts', 'EA Desktop')
  const dirs: string[] = []
  for (const f of await safeReaddir(dir)) {
    if (!/^user.*\.ini$/i.test(f)) continue
    try {
      const ini = await readFile(join(dir, f), 'utf8')
      for (const m of ini.matchAll(/^user\.downloadinplacedir=(.+)$/gim)) dirs.push(m[1].trim().replace(/\\+$/, ''))
    } catch {
      /* fichier illisible */
    }
  }
  return dirs
}

/** Valeurs « Install Dir » sous les clés de registre des éditeurs EA. */
async function eaRegistryDirs(): Promise<{ name: string; dir: string }[]> {
  const found: { name: string; dir: string }[] = []
  for (const root of [
    'HKLM\\SOFTWARE\\WOW6432Node\\EA Games',
    'HKLM\\SOFTWARE\\WOW6432Node\\Electronic Arts',
    'HKLM\\SOFTWARE\\EA Games',
    'HKLM\\SOFTWARE\\Electronic Arts'
  ]) {
    const out = await run('reg', ['query', root, '/s'])
    if (!out) continue
    let key = ''
    for (const line of out.split(/\r?\n/)) {
      if (line.startsWith('HKEY_')) key = line.trim()
      const m = line.match(/^\s+(?:Install Dir|InstallDir|Install Location)\s+REG_\w+\s+(.+)$/i)
      if (m && key) found.push({ name: key.split('\\').pop() ?? key, dir: m[1].trim().replace(/[\\"]+$/, '') })
    }
  }
  return found.filter((f) => !/EA Desktop|EA app|Origin$/i.test(f.name))
}

export async function scanEa(report: ScanReport): Promise<Game[]> {
  if (!isWin) return []
  const games = new Map<string, Game>()
  const add = (g: Game | null): boolean => {
    if (!g || games.has(g.installDir!.toLowerCase()) || [...games.values()].some((x) => x.id === g.id)) return false
    games.set(g.installDir!.toLowerCase(), g)
    return true
  }

  const appDirs = await eaAppInstallDirs()
  const roots = [
    ...appDirs,
    ...DRIVES.flatMap((d) => [`${d}:\\Program Files\\EA Games`, `${d}:\\Program Files (x86)\\Origin Games`, `${d}:\\EA Games`, `${d}:\\Games\\EA Games`])
  ].filter((r, i, all) => existsSync(r) && all.findIndex((x) => x.toLowerCase() === r.toLowerCase()) === i)
  report.checked.push(appDirs.length ? `Dossier choisi dans l'EA app : ${appDirs.join(', ')}` : "Réglages de l'EA app : introuvables")
  report.checked.push(roots.length ? `Dossiers EA : ${roots.join(', ')}` : 'Aucun dossier EA Games trouvé')
  for (const root of roots) {
    for (const folder of await safeReaddir(root)) {
      if (folder.startsWith('.') || /^(_|EA app|EA Desktop)/i.test(folder)) continue
      add(await readEaGame(join(root, folder), folder))
    }
  }

  let fromRegistry = 0
  for (const { name, dir } of await eaRegistryDirs()) {
    if (existsSync(dir) && add(await readEaGame(dir, name))) fromRegistry++
  }
  report.checked.push(`Registre EA : ${fromRegistry} jeu(x) en plus`)

  let fromPrograms = 0
  for (const e of await uninstallEntries()) {
    if (!e.DisplayName || !e.InstallLocation) continue
    const isEa =
      /electronic arts/i.test(e.Publisher ?? '') ||
      /EAInstaller|EA Desktop|EADesktop|Origin/i.test(e.UninstallString ?? '') ||
      /EA Games|Origin Games/i.test(e.InstallLocation)
    if (!isEa || /\bEA app\b|EA Desktop|Origin$/i.test(e.DisplayName)) continue
    const dir = e.InstallLocation.replace(/[\\"]+$/, '')
    const exe = e.DisplayIcon?.replace(/^"|"?,\d+$|"$/g, '')
    if (add(await readEaGame(dir, e.DisplayName, exe?.toLowerCase().endsWith('.exe') ? exe : undefined))) fromPrograms++
  }
  report.checked.push(`Programmes installés : ${fromPrograms} jeu(x) EA en plus`)
  return [...games.values()]
}

// ---------- Scan complet ----------

let lastReport: ScanReport[] = []

export function getScanReport(): ScanReport[] {
  return lastReport
}

export async function scanAllGames(): Promise<Game[]> {
  uninstallCache = null
  const scanners: [Store, (r: ScanReport) => Promise<Game[]>][] = [
    ['steam', scanSteam],
    ['epic', scanEpic],
    ['ea', scanEa]
  ]
  // Un store en erreur ne doit pas vider toute la bibliothèque.
  const results = await Promise.all(
    scanners.map(async ([store, scan]) => {
      const report: ScanReport = { store, found: 0, checked: [] }
      try {
        const games = await scan(report)
        report.found = games.length
        return { games, report }
      } catch (e) {
        report.error = e instanceof Error ? e.message : String(e)
        return { games: [] as Game[], report }
      }
    })
  )
  lastReport = results.map((r) => r.report)
  console.log('[scan]', JSON.stringify(lastReport, null, 2))
  return results.flatMap((r) => r.games).sort((a, b) => a.name.localeCompare(b.name))
}

// ---------- Lancement ----------
// On passe par le client officiel de chaque store (protocole URL) : il gère DRM, mises à jour et overlay.

export function launchUrl(game: Game): string | null {
  switch (game.store) {
    case 'steam':
      return `steam://rungameid/${game.storeId}`
    case 'epic':
      return `com.epicgames.launcher://apps/${encodeURIComponent(game.storeId)}?action=launch&silent=true`
    case 'ea':
      return game.storeId ? `origin2://game/launch?offerIds=${encodeURIComponent(game.storeId)}&autoDownload=1` : null
  }
}

export async function launch(game: Game): Promise<void> {
  const url = launchUrl(game)
  if (url) return shell.openExternal(url)
  if (game.exePath) {
    const err = await shell.openPath(game.exePath)
    if (err) throw new Error(err)
    return
  }
  throw new Error(`Impossible de lancer ${game.name}.`)
}
