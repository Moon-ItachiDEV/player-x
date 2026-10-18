import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { shell } from 'electron'
import type { Game } from '@shared/types'

const isWin = process.platform === 'win32'

function regQuery(key: string, value: string): Promise<string | null> {
  if (!isWin) return Promise.resolve(null)
  return new Promise((resolve) => {
    execFile('reg', ['query', key, '/v', value], { windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null)
      const m = stdout.match(new RegExp(`${value}\\s+REG_\\w+\\s+(.+)`))
      resolve(m ? m[1].trim() : null)
    })
  })
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir)
  } catch {
    return []
  }
}

// ---------- Steam ----------

// Outils et runtimes Steam qui ne sont pas des jeux.
const STEAM_NOT_GAMES = new Set(['228980', '1070560', '1391110', '1628350', '1493710', '2180100', '961940', '1580130'])

async function steamRoot(): Promise<string | null> {
  const candidates = [
    (await regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath'))?.replace(/\//g, '\\'),
    'C:\\Program Files (x86)\\Steam',
    join(homedir(), '.steam', 'steam'),
    join(homedir(), '.local', 'share', 'Steam'),
    join(homedir(), 'Library', 'Application Support', 'Steam')
  ]
  return candidates.find((p) => p && existsSync(join(p, 'steamapps'))) ?? null
}

function vdfValue(text: string, key: string): string | undefined {
  return text.match(new RegExp(`"${key}"\\s+"([^"]*)"`, 'i'))?.[1]
}

export async function scanSteam(): Promise<Game[]> {
  const root = await steamRoot()
  if (!root) return []
  const libraries = new Set([root])
  try {
    const vdf = await readFile(join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8')
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libraries.add(m[1].replace(/\\\\/g, '\\'))
  } catch {
    /* pas de bibliothèque secondaire */
  }

  const games: Game[] = []
  for (const lib of libraries) {
    const appsDir = join(lib, 'steamapps')
    for (const file of await safeReaddir(appsDir)) {
      if (!/^appmanifest_\d+\.acf$/.test(file)) continue
      try {
        const acf = await readFile(join(appsDir, file), 'utf8')
        const appId = vdfValue(acf, 'appid')
        const name = vdfValue(acf, 'name')
        if (!appId || !name || STEAM_NOT_GAMES.has(appId) || /redistributable|proton|steam linux runtime/i.test(name)) continue
        games.push({
          id: `steam:${appId}`,
          store: 'steam',
          storeId: appId,
          name,
          installDir: join(appsDir, 'common', vdfValue(acf, 'installdir') ?? ''),
          coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
          heroUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_hero.jpg`
        })
      } catch {
        /* manifeste illisible, on l'ignore */
      }
    }
  }
  return games
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

export async function scanEpic(): Promise<Game[]> {
  const dir = join(process.env.ProgramData ?? 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')
  const games: Game[] = []
  for (const file of await safeReaddir(dir)) {
    if (!file.endsWith('.item')) continue
    try {
      const m = JSON.parse(await readFile(join(dir, file), 'utf8')) as EpicManifest
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
// Chaque jeu EA installé contient __Installer/installerdata.xml avec ses contentIDs.

async function eaRoots(): Promise<string[]> {
  const roots = new Set<string>()
  const custom = await regQuery('HKLM\\SOFTWARE\\Electronic Arts\\EA Desktop', 'InstallLocation')
  if (custom) roots.add(custom)
  for (const drive of ['C', 'D', 'E', 'F']) {
    roots.add(`${drive}:\\Program Files\\EA Games`)
    roots.add(`${drive}:\\Program Files (x86)\\Origin Games`)
    roots.add(`${drive}:\\EA Games`)
  }
  return [...roots].filter((r) => existsSync(r))
}

export async function scanEa(): Promise<Game[]> {
  if (!isWin) return []
  const games: Game[] = []
  for (const root of await eaRoots()) {
    for (const folder of await safeReaddir(root)) {
      const installDir = join(root, folder)
      try {
        const xml = await readFile(join(installDir, '__Installer', 'installerdata.xml'), 'utf8')
        const contentId = xml.match(/<contentID>([^<]+)<\/contentID>/)?.[1]
        if (!contentId) continue
        const title = xml.match(/<gameTitle locale="(?:fr_FR|en_US)">([^<]+)<\/gameTitle>/)?.[1]
        games.push({ id: `ea:${contentId}`, store: 'ea', storeId: contentId, name: title ?? folder, installDir })
      } catch {
        /* pas un jeu EA */
      }
    }
  }
  return games
}

export async function scanAllGames(): Promise<Game[]> {
  const results = await Promise.all([scanSteam(), scanEpic(), scanEa()])
  return results.flat().sort((a, b) => a.name.localeCompare(b.name))
}

// ---------- Lancement ----------
// On passe par le client officiel de chaque store (protocole URL) : il gère DRM, mises à jour et overlay.

export function launchUrl(game: Game): string {
  switch (game.store) {
    case 'steam':
      return `steam://rungameid/${game.storeId}`
    case 'epic':
      return `com.epicgames.launcher://apps/${encodeURIComponent(game.storeId)}?action=launch&silent=true`
    case 'ea':
      return `origin2://game/launch?offerIds=${encodeURIComponent(game.storeId)}&autoDownload=1`
  }
}

export async function launch(game: Game): Promise<void> {
  await shell.openExternal(launchUrl(game))
}
