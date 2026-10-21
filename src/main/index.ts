import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, Menu, powerMonitor, session, shell } from 'electron'
import type { LaunchStatus } from '@shared/launch'
import { lastPlayedOf, type PlayedDates } from '@shared/played'
import { cleanName, isBf6Name } from '@shared/text'
import type { Friend, FriendPlatform, FriendsResult, Game, Settings, SteamLibrary } from '@shared/types'
import * as db from './db'
import { handle } from './ipc'
import { getAchievementsOverview, getGameAchievements, startAchievementsWatcher } from './services/achievements'
import { demoAchievements, demoAchievementsOverview } from './services/achievementsDemo'
import { checkFriends, demoFriendAlert, resetFriendAlerts, testFriendAlert } from './services/alerts'
import { cancelLogin, loginDiscord, loginSteam } from './services/auth'
import { applyArtwork, updateArtwork } from './services/artwork'
import { bf6RecapState, markBf6RecapSeen, setBf6Running, startBf6Recaps, syncBf6Recaps } from './services/bf6Recap'
import { DEMO_FRIENDS, DEMO_GAMES, demoGames, demoNotInstalled } from './services/demo'
import { hideMembers, withMemberHidden } from './services/discordMembers'
import { connectPsn, getAllFriends, resetPsn } from './services/friends'
import { getScanReport, handoff, launchTarget, scanAllGames } from './services/games'
import { createLaunches, sanitizeOpts, type LaunchDeps, type Launches, type LaunchWindow, type Timers } from './services/launches'
import { createWatcher } from './services/launchWatch'
import { newMatches } from './services/launchWatchParse'
import { getGameNews, markAllNewsSeen, markNewsSeen, newsFeed, refreshNewsIndex, startNewsWatcher, withNews } from './services/news'
import { getAccounts, getMemberPrefs, getSettings, publicSettings, removeAccount, saveMemberPrefs, saveSettings } from './services/settings'
import { getBf6Art, getBf6History, getBf6Stats, getBf6Tracked, searchBf6, setBf6Tracked, startBf6Recorder } from './services/stats'
import { installSteamGame, ownedSteamGame, startSteamLibrary, steamLibrary } from './services/steamLibrary'
import {
  exeNamesFor,
  isRunning,
  lastPollOk,
  matchedNames,
  nudgePlaytime,
  onPlaytimeChange,
  pollNow,
  runningSince,
  snapshotPids,
  startPlaytimeTracker,
  storeWasRunning,
  withPlaytime
} from './services/playtime'
import { attachWindow, onHideToTray, setTrayPlaying, startHidden, startTray, startupState, syncStartup } from './services/tray'
import { initUpdater, takeRelaunchBounds } from './services/updater'
import type { LaunchSim } from './launchSim'

// .env : clés de développement seulement, jamais lu par la version installée.
if (!app.isPackaged) {
  try {
    process.loadEnvFile(join(app.getAppPath(), '.env'))
  } catch {
    /* .env facultatif */
  }
}

/** Serveur Vite de `npm run dev` : ignoré par la version installée. */
const devUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL

function createWindow(): void {
  // Après « Redémarrer » pour une mise à jour, la fenêtre revient où elle était (si elle tient encore sur un écran).
  const b = takeRelaunchBounds()
  const win = new BrowserWindow({
    ...(b ? { x: b.x, y: b.y, width: b.width, height: b.height } : { width: 1440, height: 900 }),
    // Agrandie avant la mise à jour : montrée directement agrandie, sans passer par sa taille normale.
    // Lancée avec Windows : cachée près de l'horloge jusqu'au premier clic sur l'icône.
    show: !b?.maximized && !startHidden,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#06101c',
    title: 'Player X',
    icon: join(app.getAppPath(), 'resources', 'icon.png'),
    autoHideMenuBar: true,
    // Barre de titre intégrée à l'interface ; Windows garde ses boutons natifs (réduire, agrandir, fermer).
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const }
      : { titleBarStyle: 'hidden' as const, titleBarOverlay: { color: '#09192a', symbolColor: '#a6bdd9', height: 48 } }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      devTools: !app.isPackaged
    }
  })
  if (b?.maximized) {
    win.maximize()
    win.focus()
  }
  attachWindow(win)
  // Les liens externes s'ouvrent dans le navigateur, pas dans l'appli.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  if (devUrl) win.loadURL(devUrl)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

let scanned = false
/** Dernière liste d'amis réelle, pour l'alerte d'essai. */
let lastFriends: Friend[] = []
/** Dernière liste réelle avant le retrait des membres Discord masqués : « Masquer » / « Afficher » la refiltre sans redemander à Discord. */
let lastRaw: FriendsResult = { friends: [], errors: {} }

function notifyGamesChanged(): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('games:changed')
  updateRunning()
}

/** Jeux en cours dans la vraie bibliothèque : menu de l'icône près de l'horloge, début et fin d'une session Battlefield 6. */
function updateRunning(): void {
  const running = withPlaytime(db.listGames()).filter((g) => g.running)
  // La démo reste dans la fenêtre : rien dans le menu de l'icône.
  setTrayPlaying(getSettings().demoMode ? [] : running.map((g) => cleanName(g.name)))
  // Fin vue sans relevé fiable (mise en veille, PowerShell en panne) : le bilan attend le prochain relevé réussi.
  setBf6Running(running.some((g) => isBf6Name(g.name)), lastPollOk())
}

// Favoris et lancements du mode démo : gardés à part pour ne jamais toucher la vraie bibliothèque.
interface DemoState {
  /** Absent tant qu'on n'a rien changé : on garde les favoris fictifs. */
  favorites?: string[]
  launches: Record<string, { count: number; last: number }>
}

function demoState(): DemoState {
  return { launches: {}, ...db.getKv<Partial<DemoState>>('demoState', {}) }
}

/** Lancement en mode démo : seul le compteur de démo change, jamais la vraie bibliothèque. */
function recordDemoLaunch(id: string): void {
  const state = demoState()
  const count = (state.launches[id]?.count ?? 0) + 1
  db.setKv('demoState', { ...state, launches: { ...state.launches, [id]: { count, last: Date.now() } } })
}

/** Lancements de jeux (services/launches.ts). Créé avant l'IPC, au démarrage. */
let launches: Launches
/** Simulateur de lancement (`npm run dev` avec PX_LAUNCH_SIM) : toujours null dans la version installée. */
let launchSim: LaunchSim | null = null

async function games(refresh = false): Promise<Game[]> {
  if (getSettings().demoMode) {
    const state = demoState()
    return withNews(
      applyArtwork(demoGames()).map((g) => {
        const l = state.launches[g.id]
        // Dernière partie : la date fictive (avec sa source) ou un lancement de démo, le plus récent des deux.
        const dates: PlayedDates = g.lastPlayed && g.lastPlayedSource ? { [g.lastPlayedSource]: g.lastPlayed } : {}
        if (l?.last) dates.launch = Math.max(dates.launch ?? 0, l.last)
        const played = lastPlayedOf(dates)
        return {
          ...g,
          favorite: state.favorites ? state.favorites.includes(g.id) : g.favorite,
          lastPlayed: played?.at,
          lastPlayedSource: played?.source,
          launches: (g.launches ?? 0) + (l?.count ?? 0),
          // Développement : « En jeu » d'après le faux relevé du simulateur de lancement.
          ...(launchSim?.isRunning(g.id) ? { running: true, runningSince: launchSim.runningSince(g.id) } : {})
        }
      })
    )
  }
  if (refresh || !scanned) {
    const found = applyArtwork(await scanAllGames())
    db.replaceGames(found)
    scanned = true
    // Les jaquettes manquantes arrivent en arrière-plan : la bibliothèque s'affiche tout de suite.
    updateArtwork(found).then((changed) => {
      if (!changed) return
      db.replaceGames(applyArtwork(db.listGames()))
      notifyGamesChanged()
    })
    // Le mode démo a pu s'activer pendant le scan : on rend alors la bibliothèque de démo.
    if (getSettings().demoMode) return games()
  }
  return withNews(withPlaytime(db.listGames()))
}

/** La bibliothèque déjà connue (vraie ou de démo), sans relancer de scan : pour les actus des jeux. */
function knownGames(): Game[] {
  return getSettings().demoMode ? demoGames() : db.listGames()
}

/** Un jeu de la bibliothèque, ou un jeu du compte Steam pas installé sur ce PC (sa fiche s'ouvre aussi). */
function findGame(id: unknown): Game | undefined {
  if (typeof id !== 'string') return undefined
  const installed = knownGames().find((g) => g.id === id)
  if (installed) return installed
  return (getSettings().demoMode ? demoNotInstalled().find((g) => g.id === id) : ownedSteamGame(id)) ?? undefined
}

const OWNED_ART_EVERY_MS = 10 * 60_000
let ownedArt: { at: number; run: Promise<void> | null } = { at: 0, run: null }

/** Jaquettes des jeux Steam non installés, en arrière-plan : une recherche à la fois, au plus toutes les 10 min. */
function fetchOwnedArtwork(list: Game[]): void {
  if (!list.length || ownedArt.run || Date.now() - ownedArt.at < OWNED_ART_EVERY_MS) return
  ownedArt = {
    at: Date.now(),
    run: updateArtwork(list)
      .then((changed) => void (changed && notifyGamesChanged()))
      .finally(() => (ownedArt.run = null))
  }
}

function registerIpc(): void {
  handle('games:list', (_e, refresh?: boolean) => games(refresh))
  // Ne rejette jamais pour un échec de lancement : la phase le dit (failed, already…), en français.
  handle('games:launch', (_e, id: unknown, opts: unknown) => launches.start(typeof id === 'string' ? id : '', sanitizeOpts(opts)))
  handle('launch:cancel', (_e, launchId: unknown) => {
    if (typeof launchId === 'string') launches.cancel(launchId)
  })
  handle('launch:list', () => launches.list())
  handle('games:report', () => getScanReport())
  handle('games:open-folder', async (_e, id: string) => {
    if (getSettings().demoMode) throw new Error('Mode démo : ce dossier n’existe pas sur ton PC.')
    // Le chemin vient de la base, jamais du renderer.
    const dir = (await games()).find((g) => g.id === id)?.installDir
    if (!dir) throw new Error('Dossier d’installation inconnu.')
    // shell.openPath exécute un fichier : on n'ouvre qu'un vrai dossier local (le chemin vient d'un manifeste).
    const isDir = await stat(dir).then((s) => s.isDirectory(), () => false)
    if (!isDir || /^[\\/]{2}/.test(dir)) throw new Error('Impossible d’ouvrir le dossier : il a peut-être été déplacé ou supprimé.')
    const err = await shell.openPath(dir)
    if (err) throw new Error('Impossible d’ouvrir le dossier : il a peut-être été déplacé ou supprimé.')
  })
  handle('games:favorite', async (_e, id: string) => {
    if (getSettings().demoMode) {
      const current = (await games()).filter((g) => g.favorite).map((g) => g.id)
      const favorites = current.includes(id) ? current.filter((f) => f !== id) : [...current, id]
      db.setKv('demoState', { ...demoState(), favorites })
    } else db.toggleFavorite(id)
    return games()
  })
  handle('games:set-favorites', async (_e, ids: string[]) => {
    // Seuls les identifiants de la bibliothèque actuelle sont gardés.
    const known = new Set((await games()).map((g) => g.id))
    const favorites = (Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && known.has(id))
    if (getSettings().demoMode) db.setKv('demoState', { ...demoState(), favorites })
    else db.setFavorites(favorites)
    return games()
  })
  // Membres Discord masqués (bots connus, « Masquer ») retirés ici : aucun écran ne les voit.
  handle('friends:list', async () => {
    if (getSettings().demoMode) {
      demoFriendAlert(DEMO_FRIENDS)
      return hideMembers({ friends: DEMO_FRIENDS, errors: {} }, getMemberPrefs(true))
    }
    const raw = await getAllFriends()
    lastRaw = raw
    // Filtré après l'attente : un « Masquer » envoyé pendant la récupération compte déjà.
    const result = hideMembers(raw, getMemberPrefs(false))
    checkFriends(result)
    lastFriends = raw.friends
    return result
  })
  handle('friends:hide-member', (_e, name: unknown, hidden: unknown) => {
    const clean = typeof name === 'string' ? name.trim() : ''
    if (!clean || clean.length > 128 || typeof hidden !== 'boolean') throw new Error('Membre inconnu.')
    const demo = getSettings().demoMode
    saveMemberPrefs(demo, withMemberHidden(getMemberPrefs(demo), clean, hidden))
    return hideMembers(demo ? { friends: DEMO_FRIENDS, errors: {} } : lastRaw, getMemberPrefs(demo))
  })
  handle('friends:test-alert', () => testFriendAlert(getSettings().demoMode ? DEMO_FRIENDS : lastFriends))
  // Actus des jeux : l'appid Steam est retrouvé ici, à partir de la bibliothèque, jamais reçu de l'interface.
  handle('news:game', async (_e, id: unknown, refresh?: unknown) => {
    if (!getSettings().gameNews) throw new Error('Les actus des jeux sont désactivées dans Paramètres.')
    const game = findGame(id)
    if (!game) throw new Error('Jeu introuvable.')
    return getGameNews(game, refresh === true)
  })
  handle('news:seen', (_e, id: unknown, upTo?: unknown) => {
    const game = findGame(id)
    if (game) markNewsSeen(game, typeof upTo === 'number' ? upTo : undefined, knownGames().filter((g) => g.id !== game.id))
  })
  handle('news:seen-all', () => markAllNewsSeen(knownGames()))
  // Page Actus des jeux : construite à partir du relevé, sans réseau.
  handle('news:feed', () => newsFeed(knownGames()))
  handle('news:refresh', async () => {
    // 60 s : « Actualiser » redemande vraiment à Steam (avec 15 min, le bouton ne faisait rien juste après un relevé).
    if (getSettings().gameNews) await refreshNewsIndex(knownGames(), { maxAge: 60_000 })
    return newsFeed(knownGames())
  })
  // Jeux du compte Steam pas installés sur ce PC (Bibliothèque › Non installés).
  handle('steam:library', async (_e, refresh?: unknown): Promise<SteamLibrary> => {
    let lib: SteamLibrary
    if (getSettings().demoMode) {
      const notInstalled = demoNotInstalled()
      lib = { state: 'ready', notInstalled, owned: DEMO_GAMES.filter((g) => g.store === 'steam').length + notInstalled.length }
    } else lib = await steamLibrary(db.listGames(), refresh === true)
    fetchOwnedArtwork(lib.notInstalled)
    return { ...lib, notInstalled: applyArtwork(lib.notInstalled) }
  })
  // Succès Steam : comme les actus, le jeu est retrouvé ici à partir de son identifiant.
  handle('achievements:game', async (_e, id: unknown, refresh?: unknown) => {
    const game = findGame(id)
    if (!game) throw new Error('Jeu introuvable.')
    return getSettings().demoMode ? demoAchievements(game) : getGameAchievements(game, refresh === true)
  })
  handle('achievements:overview', (_e, refresh?: unknown) => (getSettings().demoMode ? demoAchievementsOverview() : getAchievementsOverview(refresh === true)))
  handle('steam:install', async (_e, id: unknown) => {
    const game = findGame(id)
    if (!game?.notInstalled) throw new Error('Ce jeu n’est pas dans la liste de ton compte Steam.')
    // Mode démo : rien n'est installé pour de vrai.
    if (!getSettings().demoMode) await installSteamGame(game.storeId)
  })
  handle('accounts:list', () => getAccounts())
  handle('accounts:login', async (_e, platform: 'steam' | 'discord') => {
    const account = await (platform === 'steam' ? loginSteam() : loginDiscord())
    resetFriendAlerts(platform)
    return account
  })
  handle('accounts:psn', async () => {
    const account = await connectPsn()
    resetFriendAlerts('psn')
    return account
  })
  handle('accounts:cancel', () => cancelLogin())
  handle('accounts:logout', (_e, platform: FriendPlatform) => {
    resetFriendAlerts()
    // Le jeton NPSSO sert seulement à ce compte : on l'efface avec lui.
    if (platform === 'psn') {
      saveSettings({ psnNpsso: '' })
      resetPsn()
    }
    return removeAccount(platform)
  })
  // Les clés et jetons ne quittent jamais le processus principal : l'interface ne voit que leurs 4 derniers caractères.
  handle('settings:get', () => publicSettings(getSettings()))
  handle('settings:save', (_e, patch: Partial<Settings>) => {
    const before = getSettings()
    const wasDemo = before.demoMode
    const next = saveSettings(patch)
    if (next.psnNpsso !== before.psnNpsso) resetPsn()
    if (next.startWithWindows !== before.startWithWindows) syncStartup()
    if (next.bf6Recap !== before.bf6Recap) syncBf6Recaps()
    if (next.gameNews !== before.gameNews) {
      // Badges retirés tout de suite, ou relevés dès la réactivation.
      notifyGamesChanged()
      if (next.gameNews) refreshNewsIndex(knownGames()).catch(() => {})
    }
    if (next.demoMode !== wasDemo) {
      updateRunning()
      resetFriendAlerts()
      // Les lancements en cours (vrais ou de démo) s'arrêtent sans carte : l'interface vide aussi les siens.
      launches.reset()
      // Au retour du mode démo, on rescanne la vraie bibliothèque.
      scanned = false
      // Jaquettes des jeux fictifs, aussi quand la démo s'active en cours de session.
      if (next.demoMode) updateArtwork(DEMO_GAMES).then((changed) => changed && notifyGamesChanged())
      // Actus de l'autre bibliothèque tout de suite, sans attendre le relevé de l'heure suivante.
      if (next.gameNews) refreshNewsIndex(knownGames()).catch(() => {})
    }
    return publicSettings(next)
  })
  // Stats Battlefield 6 : vraies données même en mode démo (jamais de stats inventées).
  handle('bf6:search', (_e, name: unknown) => searchBf6(name))
  handle('bf6:stats', (_e, account: unknown, refresh?: boolean) => getBf6Stats(account, refresh === true))
  handle('bf6:art', () => getBf6Art())
  handle('bf6:tracked', () => getBf6Tracked())
  handle('bf6:set-tracked', (_e, tracked: unknown) => setBf6Tracked(tracked))
  handle('bf6:history', (_e, account: unknown) => getBf6History(account))
  // Bilans de session : ton vrai compte seulement (rien en mode démo).
  handle('bf6:recaps', () => bf6RecapState())
  handle('bf6:recap-seen', (_e, id: unknown) => markBf6RecapSeen(id))
  handle('app:startup', () => startupState())
  handle('shell:open', (_e, url: unknown) => {
    if (typeof url === 'string' && url.startsWith('https://')) return shell.openExternal(url)
  })
}

// ---------- lancement d'un jeu ----------

function emitLaunch(s: LaunchStatus): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue
    try {
      w.webContents.send('launch:status', s)
    } catch {
      /* page en plein rechargement : elle relira launch:list */
    }
  }
}

/**
 * Fenêtre principale vue par le lancement : lue, réduite, ou rouverte sans activation. Un « restore » qui ne vient pas de
 * showInactive ci-dessous est celui de l'utilisateur : Player X ne reviendra plus tout seul. Pareil quand la croix
 * range la fenêtre près de l'horloge.
 */
function launchWindow(): LaunchWindow {
  const win = (): BrowserWindow | undefined => BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
  let ownRestoreUntil = 0
  let onUser = (): void => {}
  app.on('browser-window-created', (_e, w) =>
    w.on('restore', () => {
      if (Date.now() < ownRestoreUntil) {
        ownRestoreUntil = 0
        return
      }
      onUser()
    })
  )
  onHideToTray(() => onUser())
  return {
    focused: () => win()?.isFocused() ?? true,
    // Rangée près de l'horloge : comme réduite, jamais réduite (Windows la remontrerait dans la barre des tâches) ni rouverte.
    minimized: () => {
      const w = win()
      return !!w && (w.isMinimized() || !w.isVisible())
    },
    maximized: () => win()?.isMaximized() ?? false,
    minimize: () => win()?.minimize(),
    showInactive: () => {
      const w = win()
      if (!w) return
      ownRestoreUntil = Date.now() + 1000
      w.showInactive()
    },
    onUserRestore: (cb) => {
      onUser = cb
    }
  }
}

function launchDeps(): LaunchDeps {
  const timers: Timers = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as NodeJS.Timeout) }
  // Journal de développement seulement : `[launch] …` dans le terminal de `npm run dev`.
  const log = app.isPackaged ? (): void => {} : (msg: string): void => console.log(`[launch] ${msg}`)
  return {
    platform: process.platform,
    now: Date.now,
    timers,
    findGame: async (id) => (await games()).find((g) => g.id === id),
    demo: () => getSettings().demoMode,
    target: launchTarget,
    handoff,
    handlerKnown: (url) => {
      try {
        return app.getApplicationNameForProtocol(url) !== ''
      } catch {
        return null
      }
    },
    recordLaunch: db.recordLaunch,
    recordDemoLaunch,
    tracker: {
      isRunning,
      runningSince,
      pollNow,
      lastPollOk,
      snapshotPids,
      storeWasRunning,
      exeNamesFor,
      matchedNames,
      nudge: nudgePlaytime,
      onChange: onPlaytimeChange
    },
    watcher: (onDown) => createWatcher({ now: Date.now, timers, log, onDown }),
    newMatches,
    window: launchWindow(),
    onBattery: () => powerMonitor.isOnBatteryPower(),
    settings: getSettings,
    emit: emitLaunch,
    gamesChanged: notifyGamesChanged,
    log
  }
}

/** En développement, PX_LAUNCH_SIM branche le vrai orchestrateur sur un faux Windows (launchSim.ts, jamais dans l'installeur). */
async function startLaunches(): Promise<Launches> {
  const deps = launchDeps()
  const mode = app.isPackaged ? undefined : process.env.PX_LAUNCH_SIM
  if (mode) {
    try {
      const { createLaunchSim } = await import('./launchSim')
      launchSim = createLaunchSim(mode, deps, process.env.PX_LAUNCH_SIM_FAST === '1')
      launchSim.onChange(notifyGamesChanged)
      return launchSim.launches
    } catch (e) {
      console.error('[launch]', e)
    }
  }
  return createLaunches(deps)
}

/** Électron accorde par défaut caméra, micro, position… à la page : seul le presse-papiers sert à Player X. */
const ALLOWED_PERMISSIONS = new Set(['clipboard-read', 'clipboard-sanitized-write'])

function lockDown(): void {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))
  // Version installée : plus de « Recharger » ni d'outils de développement, mais le zoom (Ctrl +, Ctrl -, Ctrl 0) et F11 restent.
  if (app.isPackaged)
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([{ label: 'Affichage', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] }])
    )
}

// L'interface ne navigue jamais : aucune fenêtre ne doit quitter la page de Player X (lien, glisser-déposer, redirection).
// Seul le rechargement de la page elle-même passe (bouton « Recharger » après une erreur).
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (e) => {
    if (e.url !== contents.getURL()) e.preventDefault()
  })
  contents.on('will-redirect', (e) => e.preventDefault())
  contents.on('will-attach-webview', (e) => e.preventDefault())
})

// Notifications Windows : même identifiant que l'installeur, sinon elles ne s'affichent pas.
if (process.platform === 'win32') app.setAppUserModelId('dev.breezy.playerx')

// Une seule instance : deux Player X ouverts écraseraient chacun la base de l'autre (temps de jeu relevé chaque minute).
const firstInstance = app.requestSingleInstanceLock()
if (!firstInstance) app.quit()
app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
})

app.whenReady().then(async () => {
  if (!firstInstance) return
  await db.initDb()
  lockDown()
  launches = await startLaunches()
  // Avant le relevé du temps de jeu : à la mise en veille, les lancements s'arrêtent sans bruit avant qu'il ne coupe les sessions.
  powerMonitor.on('suspend', () => launches.suspend())
  app.on('will-quit', () => launches.shutdown())
  registerIpc()
  initUpdater()
  // Avant le suivi du temps de jeu : une session Battlefield 6 restée ouverte lit la dernière apparition du jeu.
  startBf6Recaps()
  startPlaytimeTracker(notifyGamesChanged)
  startBf6Recorder()
  startNewsWatcher(knownGames, notifyGamesChanged)
  // Développement seulement : PX_NEWS_SIM simule les annonces Steam (newsSim.ts, jamais dans l'installeur).
  if (!app.isPackaged && process.env.PX_NEWS_SIM) {
    const mode = process.env.PX_NEWS_SIM
    import('./services/newsSim')
      .then(({ startNewsSim }) => {
        startNewsSim(mode)
        return refreshNewsIndex(knownGames())
      })
      .catch((e) => console.warn('[news-sim]', e))
  }
  startAchievementsWatcher(() => getSettings().demoMode)
  // Un jeu installé avec « Installer » : nouveau scan, il passe des « Non installés » à la bibliothèque.
  startSteamLibrary(notifyGamesChanged, () => {
    games(true)
      .then(notifyGamesChanged)
      .catch(() => {})
  })
  startTray()
  updateRunning()
  // Développement seulement : PX_BF6_SIM simule une partie de Battlefield 6 (bf6Sim.ts, jamais dans l'installeur).
  if (!app.isPackaged && process.env.PX_BF6_SIM) {
    const mode = process.env.PX_BF6_SIM
    import('./services/bf6Sim').then(({ startBf6Sim }) => startBf6Sim(mode)).catch((e) => console.warn('[bf6-sim]', e))
  }
  createWindow()
  // En démo aussi, on récupère les vraies jaquettes des jeux fictifs.
  if (getSettings().demoMode) updateArtwork(DEMO_GAMES).then((changed) => changed && notifyGamesChanged())
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
