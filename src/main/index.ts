import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import type { FriendPlatform, Game, Settings } from '@shared/types'
import * as db from './db'
import { loginDiscord, loginSteam } from './services/auth'
import { DEMO_FRIENDS, DEMO_GAMES } from './services/demo'
import { connectPsn, getAllFriends } from './services/friends'
import { launch, scanAllGames } from './services/games'
import { getAccounts, getSettings, removeAccount, saveSettings } from './services/settings'

try {
  process.loadEnvFile(join(app.getAppPath(), '.env'))
} catch {
  /* .env facultatif */
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#07080f',
    title: 'Plateforme Gaming',
    autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true }
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

async function games(refresh = false): Promise<Game[]> {
  if (getSettings().demoMode) return DEMO_GAMES.map((g) => ({ ...g, ...db.listGames().find((d) => d.id === g.id) }))
  if (refresh || !scanned) {
    db.replaceGames(await scanAllGames())
    scanned = true
  }
  return db.listGames()
}

function registerIpc(): void {
  ipcMain.handle('games:list', (_e, refresh?: boolean) => games(refresh))
  ipcMain.handle('games:launch', async (_e, id: string) => {
    const game = (await games()).find((g) => g.id === id)
    if (!game) throw new Error('Jeu introuvable.')
    db.recordLaunch(id)
    if (!getSettings().demoMode) await launch(game)
  })
  ipcMain.handle('games:favorite', async (_e, id: string) => {
    if (getSettings().demoMode && !db.listGames().some((g) => g.id === id)) {
      // En démo, les jeux fictifs sont ajoutés en base pour garder favoris et sessions.
      db.replaceGames([...db.listGames(), ...DEMO_GAMES.filter((g) => g.id === id)])
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
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
