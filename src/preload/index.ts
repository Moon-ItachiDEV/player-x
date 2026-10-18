import { contextBridge, ipcRenderer } from 'electron'
import type { LauncherApi, UpdateState } from '@shared/types'

declare const __APP_VERSION__: string

const api: LauncherApi = {
  getGames: (refresh) => ipcRenderer.invoke('games:list', refresh),
  launchGame: (id) => ipcRenderer.invoke('games:launch', id),
  toggleFavorite: (id) => ipcRenderer.invoke('games:favorite', id),
  setFavorites: (ids) => ipcRenderer.invoke('games:set-favorites', ids),
  getScanReport: () => ipcRenderer.invoke('games:report'),
  onGamesChanged: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on('games:changed', listener)
    return () => ipcRenderer.removeListener('games:changed', listener)
  },
  getFriends: () => ipcRenderer.invoke('friends:list'),
  getAccounts: () => ipcRenderer.invoke('accounts:list'),
  login: (platform) => ipcRenderer.invoke('accounts:login', platform),
  connectPsn: () => ipcRenderer.invoke('accounts:psn'),
  logout: (platform) => ipcRenderer.invoke('accounts:logout', platform),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  openGameFolder: (id) => ipcRenderer.invoke('games:open-folder', id),
  cancelLogin: () => ipcRenderer.invoke('accounts:cancel'),
  getUpdateState: () => ipcRenderer.invoke('update:get'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateState: (cb) => {
    const listener = (_e: unknown, s: UpdateState): void => cb(s)
    ipcRenderer.on('update:state', listener)
    return () => ipcRenderer.removeListener('update:state', listener)
  },
  bf6Search: (name) => ipcRenderer.invoke('bf6:search', name),
  bf6Stats: (account, refresh) => ipcRenderer.invoke('bf6:stats', account, refresh),
  bf6Art: () => ipcRenderer.invoke('bf6:art'),
  bf6GetTracked: () => ipcRenderer.invoke('bf6:tracked'),
  bf6SetTracked: (tracked) => ipcRenderer.invoke('bf6:set-tracked', tracked),
  platform: process.platform,
  version: __APP_VERSION__
}

contextBridge.exposeInMainWorld('launcher', api)
