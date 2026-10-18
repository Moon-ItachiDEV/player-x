import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import type { FriendPlatform, Game, Settings } from '@shared/types'
import * as db from './db'
import { cancelLogin, loginDiscord, loginSteam } from './services/auth'
import { applyArtwork, updateArtwork } from './services/artwork'
import { DEMO_FRIENDS, DEMO_GAMES, demoGames } from './services/demo'
import { connectPsn, getAllFriends } from './services/friends'
import { getScanReport, launch, scanAllGames } from './services/games'
import { getAccounts, getSettings, removeAccount, saveSettings } from './services/settings'

try {
  process.loadEnvFile(join(app.getAppPath(), '.env'))
} catch {
  /* .env facultatif */
}

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
      contextIsolation: true
    }
  })
  // Les liens externes s'ouvrent dans le navigateur, pas dans l'appli.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

let scanned = false

function notifyGamesChanged(): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('games:changed')
}

async function games(refresh = false): Promise<Game[]> {
  if (getSettings().demoMode) {
    // Historique fictif, remplacé par le vrai dès qu'on lance ou met en favori un jeu de démo.
    const saved = new Map(db.listGames().map((g) => [g.id, g]))
    return applyArtwork(demoGames()).map((g) => {
      const s = saved.get(g.id)
      if (!s) return g
      return { ...g, favorite: s.favorite, lastPlayed: s.lastPlayed ?? g.lastPlayed, launches: (g.launches ?? 0) + (s.launches ?? 0) }
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
  }
  return db.listGames()
}

function registerIpc(): void {
  ipcMain.handle('games:list', (_e, refresh?: boolean) => games(refresh))
  ipcMain.handle('games:launch', async (_e, id: string) => {
    const game = (await games()).find((g) => g.id === id)
    if (!game) throw new Error('Jeu introuvable.')
    if (getSettings().demoMode && !db.listGames().some((g) => g.id === id)) db.replaceGames([...db.listGames(), game])
    db.recordLaunch(id)
    if (!getSettings().demoMode) await launch(game)
  })
  ipcMain.handle('games:report', () => getScanReport())
  ipcMain.handle('games:open-folder', async (_e, id: string) => {
    // Le chemin vient de la base, jamais du renderer.
    const dir = (await games()).find((g) => g.id === id)?.installDir
    if (!dir) throw new Error('Dossier d’installation inconnu.')
    const err = await shell.openPath(dir)
    if (err) throw new Error(err)
  })
  ipcMain.handle('games:favorite', async (_e, id: string) => {
    if (getSettings().demoMode && !db.listGames().some((g) => g.id === id)) {
      // En démo, les jeux fictifs sont ajoutés en base pour garder favoris et sessions.
      db.replaceGames([...db.listGames(), ...(await games()).filter((g) => g.id === id)])
    }
    db.toggleFavorite(id)
    return games()
  })
  ipcMain.handle('friends:list', async () => {
    if (getSettings().demoMode) return { friends: DEMO_FRIENDS, errors: {} }
    return getAllFriends()
  })
  ipcMain.handle('accounts:list', () => getAccounts())
  ipcMain.handle('accounts:login', (_e, platform: 'steam' | 'discord') => (platform === 'steam' ? loginSteam() : loginDiscord()))
  ipcMain.handle('accounts:psn', () => connectPsn())
  ipcMain.handle('accounts:cancel', () => cancelLogin())
  ipcMain.handle('accounts:logout', (_e, platform: FriendPlatform) => removeAccount(platform))
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_e, patch: Partial<Settings>) => saveSettings(patch))
  ipcMain.handle('shell:open', (_e, url: string) => {
    if (url.startsWith('https://')) return shell.openExternal(url)
  })
}

app.whenReady().then(async () => {
  await db.initDb()
  registerIpc()
  createWindow()
  // En démo aussi, on récupère les vraies jaquettes des jeux fictifs.
  if (getSettings().demoMode) updateArtwork(DEMO_GAMES).then((changed) => changed && notifyGamesChanged())
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
