import { contextBridge, ipcRenderer } from 'electron'
import type { LauncherApi } from '@shared/types'

const api: LauncherApi = {
  getGames: (refresh) => ipcRenderer.invoke('games:list', refresh),
  launchGame: (id) => ipcRenderer.invoke('games:launch', id),
  toggleFavorite: (id) => ipcRenderer.invoke('games:favorite', id),
  getScanReport: () => ipcRenderer.invoke('games:report'),
  getFriends: () => ipcRenderer.invoke('friends:list'),
  getAccounts: () => ipcRenderer.invoke('accounts:list'),
  login: (platform) => ipcRenderer.invoke('accounts:login', platform),
  connectPsn: () => ipcRenderer.invoke('accounts:psn'),
  logout: (platform) => ipcRenderer.invoke('accounts:logout', platform),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  platform: process.platform
}

contextBridge.exposeInMainWorld('launcher', api)
