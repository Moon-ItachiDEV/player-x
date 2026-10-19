import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, Menu, session, shell } from 'electron'
import type { Friend, FriendPlatform, Game, Settings } from '@shared/types'
import * as db from './db'
import { handle } from './ipc'
import { checkFriends, demoFriendAlert, resetFriendAlerts, testFriendAlert } from './services/alerts'
import { cancelLogin, loginDiscord, loginSteam } from './services/auth'
import { applyArtwork, updateArtwork } from './services/artwork'
import { DEMO_FRIENDS, DEMO_GAMES, demoGames } from './services/demo'
import { connectPsn, getAllFriends, resetPsn } from './services/friends'
import { getScanReport, launch, scanAllGames } from './services/games'
import { getAccounts, getSettings, publicSettings, removeAccount, saveSettings } from './services/settings'
import { getBf6Art, getBf6History, getBf6Stats, getBf6Tracked, searchBf6, setBf6Tracked, startBf6Recorder } from './services/stats'
import { nudgePlaytime, startPlaytimeTracker, withPlaytime } from './services/playtime'
import { initUpdater } from './services/updater'

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
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0b0d14',
    title: 'Player X',
    icon: join(app.getAppPath(), 'resources', 'icon.png'),
    autoHideMenuBar: true,
    // Barre de titre intégrée à l'interface ; Windows garde ses boutons natifs (réduire, agrandir, fermer).
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const }
      : { titleBarStyle: 'hidden' as const, titleBarOverlay: { color: '#0b0d14', symbolColor: '#a3a8bd', height: 48 } }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      devTools: !app.isPackaged
    }
  })
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

function notifyGamesChanged(): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('games:changed')
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

async function games(refresh = false): Promise<Game[]> {
  if (getSettings().demoMode) {
    const state = demoState()
    return applyArtwork(demoGames()).map((g) => {
      const l = state.launches[g.id]
      return {
        ...g,
        favorite: state.favorites ? state.favorites.includes(g.id) : g.favorite,
        lastPlayed: l?.last ?? g.lastPlayed,
        launches: (g.launches ?? 0) + (l?.count ?? 0)
      }
    })
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
  return withPlaytime(db.listGames())
}

function registerIpc(): void {
  handle('games:list', (_e, refresh?: boolean) => games(refresh))
  handle('games:launch', async (_e, id: string) => {
    const game = (await games()).find((g) => g.id === id)
    if (!game) throw new Error('Jeu introuvable.')
    if (getSettings().demoMode) {
      const state = demoState()
      const count = (state.launches[id]?.count ?? 0) + 1
      db.setKv('demoState', { ...state, launches: { ...state.launches, [id]: { count, last: Date.now() } } })
      return
    }
    // La session n'est comptée qu'une fois le jeu vraiment lancé.
    await launch(game)
    db.recordLaunch(id)
    nudgePlaytime()
  })
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
  handle('friends:list', async () => {
    if (getSettings().demoMode) {
      demoFriendAlert(DEMO_FRIENDS)
      return { friends: DEMO_FRIENDS, errors: {} }
    }
    const result = await getAllFriends()
    checkFriends(result)
    lastFriends = result.friends
    return result
  })
  handle('friends:test-alert', () => testFriendAlert(getSettings().demoMode ? DEMO_FRIENDS : lastFriends))
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
    if (next.demoMode !== wasDemo) {
      resetFriendAlerts()
      // Au retour du mode démo, on rescanne la vraie bibliothèque.
      scanned = false
      // Jaquettes des jeux fictifs, aussi quand la démo s'active en cours de session.
      if (next.demoMode) updateArtwork(DEMO_GAMES).then((changed) => changed && notifyGamesChanged())
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
  handle('shell:open', (_e, url: unknown) => {
    if (typeof url === 'string' && url.startsWith('https://')) return shell.openExternal(url)
  })
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
  registerIpc()
  initUpdater()
  startPlaytimeTracker(notifyGamesChanged)
  startBf6Recorder()
  createWindow()
  // En démo aussi, on récupère les vraies jaquettes des jeux fictifs.
  if (getSettings().demoMode) updateArtwork(DEMO_GAMES).then((changed) => changed && notifyGamesChanged())
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
