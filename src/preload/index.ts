import { contextBridge, ipcRenderer } from 'electron'
import type { LaunchStatus } from '@shared/launch'
import type { Bf6RecapEvent, Cs2Live, Cs2OverlayConfig, Cs2RecapEvent, FriendAlert, LauncherApi, UpdateState } from '@shared/types'

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
  setMemberHidden: (name, hidden) => ipcRenderer.invoke('friends:hide-member', name, hidden),
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
  cs2State: () => ipcRenderer.invoke('cs2:state'),
  cs2RecapSeen: (id) => ipcRenderer.invoke('cs2:recap-seen', id),
  onCs2Live: (cb) => {
    const listener = (_e: unknown, live: Cs2Live | null): void => cb(live)
    ipcRenderer.on('cs2:live', listener)
    return () => ipcRenderer.removeListener('cs2:live', listener)
  },
  onCs2State: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on('cs2:state', listener)
    return () => ipcRenderer.removeListener('cs2:state', listener)
  },
  onCs2Recap: (cb) => {
    const listener = (_e: unknown, e: Cs2RecapEvent): void => cb(e)
    ipcRenderer.on('cs2:recap', listener)
    return () => ipcRenderer.removeListener('cs2:recap', listener)
  },
  cs2OverlayConfig: () => ipcRenderer.invoke('cs2:overlay-config'),
  cs2OverlayPreview: () => ipcRenderer.invoke('cs2:overlay-preview'),
  onCs2OverlayConfig: (cb) => {
    const listener = (_e: unknown, c: Cs2OverlayConfig): void => cb(c)
    ipcRenderer.on('cs2:overlay-config', listener)
    return () => ipcRenderer.removeListener('cs2:overlay-config', listener)
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
  markNewsSeen: (id, upTo) => ipcRenderer.invoke('news:seen', id, upTo),
  getNewsFeed: () => ipcRenderer.invoke('news:feed'),
  refreshNewsFeed: () => ipcRenderer.invoke('news:refresh'),
  markAllNewsSeen: () => ipcRenderer.invoke('news:seen-all'),
  getSteamLibrary: (refresh) => ipcRenderer.invoke('steam:library', refresh),
  installGame: (id) => ipcRenderer.invoke('steam:install', id),
  getAchievements: (id, refresh) => ipcRenderer.invoke('achievements:game', id, refresh),
  getAchievementsOverview: (refresh) => ipcRenderer.invoke('achievements:overview', refresh),
  getStartupState: () => ipcRenderer.invoke('app:startup'),
  platform: process.platform,
  version: __APP_VERSION__
}

contextBridge.exposeInMainWorld('launcher', api)
