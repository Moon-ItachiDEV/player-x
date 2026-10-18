export type Store = 'steam' | 'epic' | 'ea'

export interface Game {
  id: string // `${store}:${storeId}`
  store: Store
  storeId: string
  name: string
  installDir?: string
  /** Exécutable de secours quand le store ne fournit pas d'identifiant de lancement. */
  exePath?: string
  coverUrl?: string
  heroUrl?: string
  lastPlayed?: number
  /** Nombre de lancements depuis Plateforme Gaming. */
  launches?: number
  favorite?: boolean
}

export type FriendPlatform = 'steam' | 'discord' | 'psn'
export type FriendStatus = 'in-game' | 'online' | 'away' | 'offline'

export interface Friend {
  id: string // `${platform}:${platformId}`
  platform: FriendPlatform
  name: string
  avatarUrl?: string
  status: FriendStatus
  game?: string
  device?: string
}

export interface Account {
  platform: FriendPlatform
  id: string
  name: string
  avatarUrl?: string
}

export interface Settings {
  steamApiKey: string
  discordClientId: string
  discordClientSecret: string
  /** Serveur Discord dont le widget est activé : affiche ses membres en ligne. */
  discordGuildId: string
  /** Jeton NPSSO PlayStation (non officiel). */
  psnNpsso: string
  demoMode: boolean
}

export interface FriendsResult {
  friends: Friend[]
  errors: Partial<Record<FriendPlatform, string>>
}

export interface ScanReport {
  store: Store
  found: number
  /** Dossiers et sources examinés, pour comprendre un scan vide. */
  checked: string[]
  error?: string
}

export interface LauncherApi {
  getGames(refresh?: boolean): Promise<Game[]>
  launchGame(id: string): Promise<void>
  toggleFavorite(id: string): Promise<Game[]>
  getScanReport(): Promise<ScanReport[]>
  /** Prévient quand la bibliothèque change en arrière-plan (jaquettes récupérées…). Renvoie la fonction de désabonnement. */
  onGamesChanged(cb: () => void): () => void
  getFriends(): Promise<FriendsResult>
  getAccounts(): Promise<Account[]>
  login(platform: 'steam' | 'discord'): Promise<Account>
  connectPsn(): Promise<Account>
  logout(platform: FriendPlatform): Promise<Account[]>
  getSettings(): Promise<Settings>
  saveSettings(settings: Partial<Settings>): Promise<Settings>
  openExternal(url: string): Promise<void>
  /** Ouvre le dossier d'installation d'un jeu (le chemin est retrouvé côté processus principal). */
  openGameFolder(id: string): Promise<void>
  /** Abandonne une connexion Steam/Discord en attente (libère le port de retour). */
  cancelLogin(): Promise<void>
  platform: string
  version: string
}
