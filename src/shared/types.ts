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
  /** Temps de jeu en minutes : compteur Steam pour les jeux Steam, sinon mesuré par Player X. */
  playtime?: number
  playtimeSource?: 'steam' | 'local'
  /** Le jeu tourne en ce moment sur ce PC. */
  running?: boolean
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
  /** Présence illisible cette fois-ci (PSN) : le statut affiché n'est pas fiable. */
  presenceUnknown?: boolean
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
  /** Alertes quand un ami Steam ou PlayStation se connecte (`all`) ou seulement quand il lance un jeu (`games`). */
  friendAlerts: FriendAlertMode
}

export type FriendAlertMode = 'all' | 'games' | 'off'

/** Un ami vient de se connecter ou de lancer un jeu. */
export interface FriendAlert {
  key: string
  friend: Friend
  kind: 'online' | 'in-game'
  at: number
  /** Alerte d'essai (Paramètres) ou du mode démo. */
  sample?: boolean
}

export interface FriendsResult {
  friends: Friend[]
  errors: Partial<Record<FriendPlatform, string>>
  /** Plateformes interrogées (compte relié ou serveur configuré). */
  queried?: FriendPlatform[]
}

export interface ScanReport {
  store: Store
  found: number
  /** Dossiers et sources examinés, pour comprendre un scan vide. */
  checked: string[]
  error?: string
}

/** État des mises à jour automatiques (GitHub Releases, via electron-updater). */
export type UpdateState =
  /** Version de développement ou non installée : pas de mise à jour automatique. */
  | { state: 'disabled' }
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'none'; checkedAt: number }
  | { state: 'downloading'; version: string; percent: number }
  /** Téléchargée : s'installe au prochain redémarrage (ou tout de suite via installUpdate). */
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

// ---------- Statistiques Battlefield 6 (gametools.network, non officiel) ----------

/** Plateforme d'un compte Battlefield, telle que l'attend gametools.network. */
export type Bf6Platform = 'ea' | 'pc' | 'steam' | 'psn' | 'xbox'

/** Un compte Battlefield 6 (le même pseudo peut exister sur plusieurs plateformes). */
export interface Bf6Account {
  name: string
  platform: Bf6Platform
  personaId?: string
  nucleusId?: string
}

/** Résultat d'une recherche de pseudo : le compte et ses éliminations quand elles ont pu être lues. */
export interface Bf6Match extends Bf6Account {
  kills: number | null
}

/** Une ligne de détail (arme, véhicule, classe, mode, carte). Les champs absents ne sont pas fournis par l'API. */
export interface Bf6Row {
  id: string
  name: string
  image?: string
  kills?: number
  deaths?: number
  killDeath?: number
  kpm?: number
  accuracy?: number
  headshots?: number
  matches?: number
  wins?: number
  winPercent?: number
  secondsPlayed?: number
}

export interface Bf6Stats {
  account: Bf6Account
  avatarUrl?: string
  kills: number
  deaths: number
  killDeath: number
  killsPerMinute: number
  wins: number
  losses: number
  /** En %, 0 à 100. */
  winPercent: number
  accuracy: number
  headshots: number
  assists: number
  revives: number
  matches: number
  secondsPlayed: number
  bestClass?: string
  weapons: Bf6Row[]
  vehicles: Bf6Row[]
  classes: Bf6Row[]
  modes: Bf6Row[]
  maps: Bf6Row[]
}

export interface Bf6Snapshot {
  stats: Bf6Stats
  fetchedAt: number
  /** Données gardées d'une lecture précédente (le service n'a pas répondu). */
  stale?: string
}

/** Visuels du jeu (catalogue Steam), chargés à l'exécution : rien n'est livré avec l'appli. */
export interface Bf6Art {
  heroUrl?: string
  coverUrl?: string
  logoUrl?: string
}

/** Relevé quotidien des totaux d'un compte, pour la courbe de progression (gardé sur ce PC). */
export interface Bf6Point {
  at: number
  kills: number
  deaths: number
  wins: number
  losses: number
  matches: number
  secondsPlayed: number
  killsPerMinute: number
  accuracy: number
}

/** Ton compte et les joueurs que tu suis pour le classement. */
export interface Bf6Tracked {
  me: Bf6Account | null
  rivals: Bf6Account[]
}

export interface LauncherApi {
  getGames(refresh?: boolean): Promise<Game[]>
  launchGame(id: string): Promise<void>
  toggleFavorite(id: string): Promise<Game[]>
  /** Remplace d'un coup la liste des favoris (écran de démarrage). Renvoie la bibliothèque à jour. */
  setFavorites(ids: string[]): Promise<Game[]>
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
  getUpdateState(): Promise<UpdateState>
  /** Lance une vérification et renvoie l'état obtenu juste après. */
  checkForUpdates(): Promise<UpdateState>
  /** Redémarre l'appli pour installer la mise à jour téléchargée. */
  installUpdate(): Promise<void>
  /** Prévient à chaque changement d'état. Renvoie la fonction de désabonnement. */
  onUpdateState(cb: (s: UpdateState) => void): () => void
  /** Cherche un pseudo Battlefield 6 sur toutes les plateformes. */
  bf6Search(name: string): Promise<Bf6Match[]>
  /** Stats d'un compte : gardées 10 min, sauf `refresh`. */
  bf6Stats(account: Bf6Account, refresh?: boolean): Promise<Bf6Snapshot>
  bf6Art(): Promise<Bf6Art>
  bf6GetTracked(): Promise<Bf6Tracked>
  bf6SetTracked(tracked: Bf6Tracked): Promise<Bf6Tracked>
  /** Relevés quotidiens d'un compte suivi, du plus ancien au plus récent. */
  bf6History(account: Bf6Account): Promise<Bf6Point[]>
  /** Alertes d'amis à afficher dans la fenêtre (quand elle est au premier plan ; sinon Windows les affiche). */
  onFriendAlert(cb: (alerts: FriendAlert[]) => void): () => void
  /** Clic sur une notification Windows : ouvrir le panneau d'amis. */
  onShowFriends(cb: () => void): () => void
  /** Envoie une alerte d'essai, dans la fenêtre et en notification Windows. */
  testFriendAlert(): Promise<void>
  platform: string
  version: string
}
