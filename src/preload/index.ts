import { contextBridge, ipcRenderer } from 'electron'
import type { LaunchStatus } from '@shared/launch'
import type { Bf6RecapEvent, FriendAlert, LauncherApi, UpdateState } from '@shared/types'

declare const __APP_VERSION__: string

const api: LauncherApi = {
  getGames: (refresh) => ipcRenderer.invoke('games:list', refresh),
  launchGame: (id, opts) => ipcRenderer.invoke('games:launch', id, opts),
  cancelLaunch: (launchId) => ipcRenderer.invoke('launch:cancel', launchId),
  listLaunches: () => ipcRenderer.invoke('launch:list'),
  onLaunchStatus: (cb) => {
    const listener = (_e: unknown, s: LaunchStatus): void => cb(s)
    ipcRenderer.on('launch:status', listener)
    return () => ipcRenderer.removeListener('launch:status', listener)
  },
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
  installUpdate: (opts) => ipcRenderer.invoke('update:install', opts),
  getLastUpdate: () => ipcRenderer.invoke('update:last'),
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
  bf6History: (account) => ipcRenderer.invoke('bf6:history', account),
  bf6Recaps: () => ipcRenderer.invoke('bf6:recaps'),
  bf6RecapSeen: (id) => ipcRenderer.invoke('bf6:recap-seen', id),
  onBf6Recap: (cb) => {
    const listener = (_e: unknown, e: Bf6RecapEvent): void => cb(e)
    ipcRenderer.on('bf6:recap', listener)
    return () => ipcRenderer.removeListener('bf6:recap', listener)
  },
  onBf6RecapState: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on('bf6:recap-state', listener)
    return () => ipcRenderer.removeListener('bf6:recap-state', listener)
  },
  onFriendAlert: (cb) => {
    const listener = (_e: unknown, alerts: FriendAlert[]): void => cb(alerts)
    ipcRenderer.on('friends:alert', listener)
    return () => ipcRenderer.removeListener('friends:alert', listener)
  },
  onShowFriends: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on('friends:show', listener)
    return () => ipcRenderer.removeListener('friends:show', listener)
  },
  testFriendAlert: () => ipcRenderer.invoke('friends:test-alert'),
  getGameNews: (id, refresh) => ipcRenderer.invoke('news:game', id, refresh),
  markNewsSeen: (id) => ipcRenderer.invoke('news:seen', id),
  getSteamLibrary: (refresh) => ipcRenderer.invoke('steam:library', refresh),
  installGame: (id) => ipcRenderer.invoke('steam:install', id),
  getStartupState: () => ipcRenderer.invoke('app:startup'),
  platform: process.platform,
  version: __APP_VERSION__
}

contextBridge.exposeInMainWorld('launcher', api)
