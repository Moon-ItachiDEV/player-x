import type { LaunchOpts, LaunchStatus } from './launch'

export type Store = 'steam' | 'epic' | 'ea'

/** D'où vient la dernière partie d'un jeu. */
export type PlayedSource = 'launch' | 'session' | 'steam'

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
  /** Dernière partie : la plus récente entre le dernier lancement depuis Player X, la dernière fois où Player X l'a vu tourner, et Steam. */
  lastPlayed?: number
  /** D'où vient `lastPlayed`. */
  lastPlayedSource?: PlayedSource
  /** Nombre de lancements depuis Player X. */
  launches?: number
  favorite?: boolean
  /** Temps de jeu en minutes : compteur Steam pour les jeux Steam, sinon mesuré par Player X. */
  playtime?: number
  playtimeSource?: 'steam' | 'local'
  /** Le jeu tourne en ce moment sur ce PC. */
  running?: boolean
  /** Début de la partie en cours (premier relevé qui l'a vu), quand `running`. */
  runningSince?: number
  /** Patch publié sur Steam ces 7 derniers jours et pas encore vu dans la fiche : badge « Nouveau patch ». */
  newPatch?: { id: string; title: string; at: number }
  /** Dernières notes de patch publiées sur Steam (date de publication, pas celle du téléchargement), quel que soit leur âge et même déjà vues. Absent si les actus sont coupées, sans page Steam, ou si aucune des dernières annonces n'est un patch. */
  lastPatch?: { id: string; title: string; at: number }
  /** Jeu du compte Steam qui n'est pas installé sur ce PC : « Installer » à la place de « Jouer ». */
  notInstalled?: boolean
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
  /** Quand un jeu lancé depuis Player X démarre : Player X reste ouvert derrière (`stay`) ou se réduit (`minimize`). */
  launchWindow: LaunchWindowMode
  /** Actus des jeux : annonces officielles publiées sur Steam dans la fiche, et badge « Nouveau patch ». */
  gameNews: boolean
  /** La croix range Player X dans la zone de notification (près de l'horloge) au lieu de le fermer. */
  closeToTray: boolean
  /** Lancé caché dans la zone de notification à l'ouverture de la session Windows. */
  startWithWindows: boolean
  /** Bilan de session Battlefield 6 : tes stats relevées au lancement du jeu, puis comparées après la partie. */
  bf6Recap: boolean
  /** Counter-Strike 2 : ton match en direct et son bilan, envoyés par le jeu lui-même (Game State Integration de Valve). */
  cs2Live: boolean
  /** À la fermeture de CS2, Player X s'ouvre de lui-même sur le dernier bilan (sinon une notification Windows). */
  cs2RecapOpen: boolean
  /** Mises à jour : `stable` (versions pour tout le monde) ou `beta` (aussi les versions de test, publiées en préversion). */
  updateChannel: UpdateChannel
  /** Overlay CS2 (bêta) : coupé, ou un des trois styles à essayer en jeu. Proposé seulement sur le canal Bêta. */
  cs2Overlay: Cs2OverlayStyle
}

/** `a` : façon Apple (matériaux, ressorts, sheet) ; `b` : verre ; `c` : finition du style Player X. */
export type Cs2OverlayStyle = 'off' | 'a' | 'b' | 'c'

/** Ce que l'overlay doit faire : son style, masqué par Alt+X, ou un aperçu en cours (chiffres d'exemple). */
export interface Cs2OverlayConfig {
  style: Cs2OverlayStyle
  hidden: boolean
  /** Aperçu lancé depuis Paramètres : l'overlay passe ses pièces avec des chiffres d'exemple. */
  previewAt?: number
}

export type UpdateChannel = 'stable' | 'beta'

/** Démarrage avec Windows : `unavailable` hors de la version installée sur Windows, `blocked` si Windows l'a désactivé (Gestionnaire des tâches). */
export type StartupState = 'on' | 'off' | 'blocked' | 'unavailable'

export type FriendAlertMode = 'all' | 'games' | 'off'
export type LaunchWindowMode = 'stay' | 'minimize'

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
  /** Membres du serveur Discord masqués (bots connus, « Masquer »). */
  hidden?: HiddenMember[]
}

/** Membre d'un serveur Discord retiré des listes : bot connu, ou masqué avec « Masquer ». */
export interface HiddenMember {
  name: string
  reason: 'bot' | 'user'
  /** Présent dans le widget lors de la dernière récupération. */
  online: boolean
  avatarUrl?: string
}

export interface ScanReport {
  store: Store
  found: number
  /** Dossiers et sources examinés, pour comprendre un scan vide. */
  checked: string[]
  error?: string
}

/** Pourquoi une mise à jour a échoué. Absent sur les erreurs de vérification de version (« Rechercher une mise à jour »). */
export type UpdateErrorCode = 'unsigned' | 'verify' | 'network' | 'other'

/** État des mises à jour automatiques (GitHub Releases, via electron-updater). */
export type UpdateState =
  /** Version de développement ou non installée : pas de mise à jour automatique. */
  | { state: 'disabled' }
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'none'; checkedAt: number }
  | {
      state: 'downloading'
      version: string
      percent: number
      /** Octets reçus / à recevoir (en téléchargement différentiel : seulement ce qui change). */
      transferred?: number
      total?: number
      /** Moyenne d'electron-updater depuis le début du téléchargement. */
      bytesPerSecond?: number
    }
  /** Téléchargée, signature en cours de vérification : rien ne s'installe, même à la fermeture. */
  | {
      state: 'verifying'
      version: string
      step: 'signature' | 'hash' | 'check'
      hashed?: number
      total?: number
      /** SHA-512 de l'installeur, 128 caractères hexadécimaux. Présent à partir de l'étape « check ». */
      fingerprint?: string
    }
  /** Téléchargée et signée : s'installe au prochain redémarrage (ou tout de suite via installUpdate). */
  | {
      state: 'ready'
      version: string
      fingerprint?: string
      size?: number
      downloadMs?: number
    }
  /** installUpdate accepté : Player X se ferme à quitAt (Date.now() du processus principal). */
  | { state: 'installing'; version: string; quitAt: number }
  | { state: 'error'; message: string; code?: UpdateErrorCode; version?: string }

export interface InstallResult {
  ok: boolean
  /** Si ok : le moment où le processus principal appelle quitAndInstall. */
  quitAt?: number
}

/** Dernière mise à jour installée sur ce PC, écrite par le processus principal au premier démarrage de la nouvelle version. */
export interface LastUpdate {
  from: string
  to: string
  fingerprint?: string
  size?: number
  downloadMs?: number
  installedAt: number
  /** true : redémarrage depuis Player X (« Redémarrer ») ; false : installée à la fermeture de Player X. */
  relaunch: boolean
  /** installedAt − quitAt, seulement après un redémarrage et si ≤ 180 s. */
  backMs?: number
  /** true seulement au lancement qui l'a installée. */
  thisBoot: boolean
}

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

/** Une carte ou un mode joué pendant une session. */
export interface Bf6RecapPlace {
  name: string
  image?: string
  matches: number
  wins: number
}

/**
 * Bilan d'une session de Battlefield 6. gametools.network ne donne que des totaux : c'est la différence entre
 * tes stats relevées au lancement du jeu et celles relues après la partie. Gardé sur ce PC.
 */
export interface Bf6Recap {
  id: string
  account: { name: string; platform: Bf6Platform }
  /** Lancement et fermeture du jeu, vus par Player X. */
  startedAt: number
  endedAt: number
  /** Le jeu tournait déjà quand le suivi a commencé (ouverture de Player X) : seules les parties d'après comptent. */
  partial?: boolean
  kills: number
  deaths: number
  assists: number
  revives: number
  matches: number
  wins: number
  losses: number
  /** Temps passé en partie (hors menus), selon les stats du jeu. */
  secondsPlayed: number
  killDeath: number
  killsPerMinute: number
  /** Éliminations en véhicule (comprises dans `kills`). */
  vehicleKills: number
  /** Tes moyennes juste avant la session, pour la situer. */
  average: { killDeath: number; killsPerMinute: number; winPercent: number }
  /** L'arme avec le plus d'éliminations pendant la session. */
  weapon?: { name: string; image?: string; kills: number }
  /** La classe la plus jouée. */
  role?: { name: string; kills: number; seconds: number }
  /** Les plus jouées d'abord. */
  maps: Bf6RecapPlace[]
  modes: Bf6RecapPlace[]
  /** Déjà ouvert dans Player X. */
  seen?: boolean
  /** Exemple (Paramètres, Stats) : chiffres fictifs, jamais enregistrés. */
  sample?: boolean
}

export interface Bf6RecapState {
  /** Réglage « Bilan Battlefield 6 ». */
  enabled: boolean
  /** Session suivie : jeu en cours (sans `endedAt`), ou terminé et bilan pas encore prêt. */
  pending: { startedAt: number; endedAt?: number } | null
  /** Les plus récents d'abord. Vide en mode démo. */
  recaps: Bf6Recap[]
}

/** `ready` : bilan prêt, Player X au premier plan ; `open` : clic sur la notification Windows ; `updated` : chiffres complétés. */
export interface Bf6RecapEvent {
  recap: Bf6Recap
  reason: 'ready' | 'open' | 'updated'
}

// ---------- Counter-Strike 2 : match en direct et bilan (Game State Integration) ----------

export type Cs2Side = 'CT' | 'T'

/** Comment un round s'est terminé (map.round_wins de CS2). */
export type Cs2RoundEnd = 'elimination' | 'bomb' | 'defuse' | 'time' | 'hostage' | 'other'

/** Un round de la frise du bilan. */
export interface Cs2Round {
  n: number
  /** Camp qui gagne le round. */
  winner: Cs2Side
  end: Cs2RoundEnd
  /** Ton camp pendant ce round : absent si Player X ne t'a pas vu jouer ce round (match rejoint en cours). */
  side?: Cs2Side
  /** Tes éliminations du round, s'il a été suivi. */
  kills?: number
}

/** Match en cours, tel que CS2 l'envoie. Seulement tes chiffres : en partie, le jeu ne donne pas ceux des autres. */
export interface Cs2Live {
  /** Nom technique de la carte (de_mirage) et du mode (competitive) : libellés dans @shared/cs2. */
  map: string
  mode: string
  phase: 'warmup' | 'live' | 'intermission' | 'gameover'
  /** Phase du round : temps d'achat, en jeu, fin du round. */
  roundPhase?: 'freezetime' | 'live' | 'over'
  /** Round en cours (à partir de 1). */
  round: number
  /** Frise des rounds terminés (vide pour un mode sans rounds). */
  rounds: Cs2Round[]
  /** Dégâts par round et % de headshots sur les rounds terminés que Player X a suivis. */
  adr?: number
  hsPct?: number
  side?: Cs2Side
  /** Rounds gagnés par ton camp et par l'autre (absents tant que ton camp est inconnu). */
  score?: { us: number; them: number }
  kills: number
  deaths: number
  assists: number
  mvps: number
  /** Points du tableau des scores. */
  points: number
  /** Tes points de vie : absents quand tu es mort et que tu regardes un autre joueur. */
  health?: number
  money?: number
  /** Ce que tu as fait dans le round en cours. */
  roundKills: number
  /** Début du suivi (fin de l'échauffement, ou arrivée en cours de match). */
  startedAt: number
  /** Le match avait commencé avant que Player X le voie. */
  partial?: boolean
}

/** Issue du match pour toi. `done` : mode sans équipes (match à mort…) ; `left` : quitté avant la fin. */
export type Cs2Result = 'win' | 'loss' | 'tie' | 'left' | 'done'

/** Bilan d'un match de Counter-Strike 2, gardé sur ce PC. */
export interface Cs2Recap {
  id: string
  /** Ton compte Steam (provider.steamid) : deux comptes sur un même PC ne se mélangent pas. */
  steamId: string
  map: string
  mode: string
  startedAt: number
  endedAt: number
  result: Cs2Result
  score?: { us: number; them: number }
  kills: number
  deaths: number
  assists: number
  mvps: number
  points: number
  /** Sur les rounds suivis seulement (`roundsTracked`) : un match rejoint en cours n'a pas ses premiers rounds. */
  headshots: number
  damage: number
  /** Éliminations comptées dans les rounds suivis : la base du % de headshots. */
  trackedKills: number
  roundsTracked: number
  /** Rounds à 3, 4 et 5 éliminations. */
  multi: { k3: number; k4: number; k5: number }
  /** Round avec le plus d'éliminations. */
  best?: { n: number; kills: number; damage: number }
  /** Frise des rounds, du premier au dernier. Vide pour un mode sans rounds. */
  rounds: Cs2Round[]
  /** Mode joué en rounds (compétitif, occasionnel, wingman) : sinon pas d'ADR ni de frise. */
  hasRounds: boolean
  partial?: boolean
  seen?: boolean
  /** Exemple (Paramètres, fiche) : chiffres fictifs, jamais enregistrés. */
  sample?: boolean
}

/** État de la liaison avec CS2. */
export type Cs2Config =
  /** Réglage coupé : fichier retiré. */
  | 'off'
  /** Fichier en place, CS2 le lira (ou le lit déjà). */
  | 'ready'
  /** Fichier écrit pendant que CS2 tournait : il ne le lit qu'à son démarrage. */
  | 'restart'
  /** CS2 n'est pas dans la bibliothèque de ce PC. */
  | 'missing'
  /** Windows a refusé l'écriture du fichier dans le dossier du jeu. */
  | 'blocked'
  /** Aucun port local libre pour recevoir les envois du jeu. */
  | 'no-port'

export interface Cs2State {
  enabled: boolean
  /** Mode démo : ni ton vrai match ni tes vrais bilans (seulement des exemples). */
  demo: boolean
  config: Cs2Config
  /** CS2 a envoyé quelque chose il y a moins d'une minute. */
  connected: boolean
  /** Match en cours, s'il y en a un. Toujours null en mode démo. */
  live: Cs2Live | null
  /** Les plus récents d'abord. Vide en mode démo. */
  recaps: Cs2Recap[]
}

/** `ready` : bilan prêt, Player X au premier plan ; `open` : clic sur la notification Windows ; `updated` : liste changée. */
export interface Cs2RecapEvent {
  recap: Cs2Recap
  reason: 'ready' | 'open' | 'updated'
}

// ---------- Actus des jeux (annonces officielles publiées sur Steam) ----------

/** Morceau de texte d'une actu, avec sa mise en forme. */
export interface NewsSpan {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  /** Lien https, ouvert dans le navigateur. */
  href?: string
}

/** Bloc d'une actu, déjà lu dans le processus principal : l'interface n'affiche que du texte, jamais de HTML venu d'internet. */
export type NewsBlock =
  | { type: 'heading'; level: 1 | 2 | 3; spans: NewsSpan[] }
  | { type: 'paragraph'; spans: NewsSpan[] }
  /** `depth` : 0 pour un point de premier niveau, 1 pour un sous-point… */
  | { type: 'list'; ordered: boolean; items: { spans: NewsSpan[]; depth: number }[] }
  | { type: 'quote'; spans: NewsSpan[] }
  | { type: 'image'; src: string }
  /** Vidéo YouTube : un lien, jamais de lecteur intégré. */
  | { type: 'video'; url: string }
  | { type: 'rule' }

/** Une annonce officielle d'un jeu sur Steam. */
export interface NewsPost {
  id: string
  title: string
  /** Page de l'annonce sur Steam (https). */
  url: string
  date: number
  author?: string
  /** Notes de patch : marquées comme telles sur Steam, ou titre de mise à jour (« Update 1.2.0 », « Hotfix »…). */
  patch: boolean
  /** Début du texte, sans mise en forme. */
  excerpt: string
  /** Première image de l'annonce. */
  image?: string
  blocks: NewsBlock[]
}

export interface GameNews {
  /** Appid Steam du jeu ; null si le jeu n'est pas sur Steam (pas d'actus). */
  appId: string | null
  /** Les plus récentes d'abord. */
  posts: NewsPost[]
  /** Date de la plus récente actu déjà vue dans la fiche, avant cette ouverture (0 : jamais). */
  seenAt: number
}

/** Une annonce de la page Actus des jeux (relevé des titres, sans le texte). */
export interface NewsFeedItem {
  /** gid Steam de l'annonce. */
  id: string
  gameId: string
  gameName: string
  title: string
  url: string
  date: number
  patch: boolean
  /** Moins de 7 jours et pas encore vue (même règle que le badge « Nouveau patch »). */
  isNew: boolean
}

export interface NewsFeed {
  /** Les plus récentes d'abord, 200 au plus. */
  items: NewsFeedItem[]
  /** Jeux suivis : ceux de la bibliothèque qui ont une page Steam. */
  tracked: number
  /** Dernier relevé utilisé (0 : jamais). */
  checkedAt: number
  /** Premier relevé pas encore fait ou en cours. */
  pending: boolean
  /** Dernier passage : aucune réponse de Steam. */
  offline: boolean
}

// ---------- Jeux du compte Steam (installés ou non) ----------

/**
 * Pourquoi la liste des jeux Steam manque, ou `ready`.
 * `private` : les « détails des jeux » du profil Steam ne sont pas publics ; `key-refused` : clé Web API refusée par Steam.
 */
export type SteamLibraryState = 'ready' | 'loading' | 'no-account' | 'no-key' | 'key-refused' | 'private' | 'offline'

export interface SteamLibrary {
  state: SteamLibraryState
  /** Jeux du compte Steam qui ne sont pas installés sur ce PC, avec le temps de jeu et la dernière partie selon Steam. */
  notInstalled: Game[]
  /** Nombre de jeux du compte, installés ou non (0 tant que la liste manque). */
  owned: number
}

// ---------- Succès Steam ----------

export interface Achievement {
  /** Nom technique chez Steam (apiname), unique dans le jeu. */
  id: string
  name: string
  /** Absente pour certains succès cachés : Steam ne la donne qu'une fois le succès débloqué. */
  description?: string
  hidden: boolean
  /** Icône en couleur (débloqué) et en gris (pas encore). */
  icon?: string
  iconGray?: string
  /** Date du déblocage ; absente tant que le succès n'est pas débloqué. */
  unlockedAt?: number
  /** Part des joueurs Steam du jeu qui l'ont débloqué (0 à 100). */
  percent?: number
}

/**
 * Pourquoi un jeu n'a pas de liste de succès, ou `ready`.
 * `not-steam` : jeu Epic ou EA (pas d'API publique) ; `none` : le jeu n'a pas de succès ;
 * `private` : les « détails des jeux » du profil Steam ne sont pas publics ; `key-refused` : clé Web API refusée.
 */
export type AchievementsState = 'ready' | 'not-steam' | 'none' | 'no-account' | 'no-key' | 'key-refused' | 'private'

export interface GameAchievements {
  state: AchievementsState
  /** Dans l'ordre du jeu. */
  list: Achievement[]
  unlocked: number
  total: number
}

/** Un succès débloqué, avec son jeu (page Trophées). */
export interface AchievementPick extends Achievement {
  gameId: string
  gameName: string
  unlockedAt: number
}

/** Où en est un jeu (page Trophées). */
export interface AchievementGame {
  gameId: string
  name: string
  unlocked: number
  total: number
  /** Dernier déblocage. */
  lastAt?: number
}

export type AchievementsOverviewState = 'ready' | 'scanning' | 'no-account' | 'no-key' | 'key-refused' | 'private' | 'offline'

export interface AchievementsOverview {
  state: AchievementsOverviewState
  /** Pendant le premier relevé : jeux lus sur combien. */
  progress?: { done: number; total: number }
  /** Jeux qui ont des succès, débloqués ou non. */
  games: AchievementGame[]
  /** Derniers succès débloqués, tous jeux confondus (les plus récents d'abord). */
  recent: AchievementPick[]
  /** Succès débloqués les plus rares (les plus rares d'abord). */
  rarest: AchievementPick[]
  unlocked: number
  total: number
  /** Jeux terminés à 100 %. */
  perfect: number
  /** Moyenne de complétion des jeux commencés (au moins un succès), comme sur le profil Steam. */
  average: number
  /** Niveau Steam et badges (absent si Steam ne les donne pas). */
  level?: { level: number; badges: number; xp: number; xpInLevel: number; xpForLevel: number }
  /** Date du dernier relevé complet (0 : jamais). */
  updatedAt: number
}

export interface LauncherApi {
  getGames(refresh?: boolean): Promise<Game[]>
  /**
   * Lance un jeu. Ne rejette jamais pour un échec de lancement : la phase le dit (`failed`, `already`…).
   * Répond une fois le lien transmis par Windows ; les phases suivantes arrivent par onLaunchStatus.
   */
  launchGame(id: string, opts: LaunchOpts): Promise<LaunchStatus>
  /** « Ne plus attendre » : Player X arrête de suivre ce lancement (rien n'est fermé). */
  cancelLaunch(launchId: string): Promise<void>
  /** Lancements en cours et terminés depuis moins de 15 min (rechargement de l'interface). */
  listLaunches(): Promise<LaunchStatus[]>
  /** Chaque changement de phase d'un lancement. Renvoie la fonction de désabonnement. */
  onLaunchStatus(cb: (s: LaunchStatus) => void): () => void
  toggleFavorite(id: string): Promise<Game[]>
  /** Remplace d'un coup la liste des favoris (écran de démarrage). Renvoie la bibliothèque à jour. */
  setFavorites(ids: string[]): Promise<Game[]>
  getScanReport(): Promise<ScanReport[]>
  /** Prévient quand la bibliothèque change en arrière-plan (jaquettes récupérées…). Renvoie la fonction de désabonnement. */
  onGamesChanged(cb: () => void): () => void
  getFriends(): Promise<FriendsResult>
  /** « Masquer » / « Afficher » un membre du serveur Discord ; renvoie la liste relue sans redemander à Discord. */
  setMemberHidden(name: string, hidden: boolean): Promise<FriendsResult>
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
  /** Redémarre l'appli pour installer la mise à jour téléchargée. `delayMs` (0 à 1500) laisse jouer l'animation ; sans argument : tout de suite. */
  installUpdate(opts?: { delayMs?: number }): Promise<InstallResult>
  /** Dernière mise à jour installée sur ce PC (null si aucune connue). */
  getLastUpdate(): Promise<LastUpdate | null>
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
  /** Bilans de session et session en cours. */
  bf6Recaps(): Promise<Bf6RecapState>
  /** Bilan ouvert : il n'est plus proposé. */
  bf6RecapSeen(id: string): Promise<void>
  /** Bilan prêt, complété, ou à ouvrir (clic sur la notification Windows). Renvoie la fonction de désabonnement. */
  onBf6Recap(cb: (e: Bf6RecapEvent) => void): () => void
  /** Session suivie commencée, terminée ou close : `bf6Recaps().pending` a changé. Renvoie la fonction de désabonnement. */
  onBf6RecapState(cb: () => void): () => void
  /** Counter-Strike 2 : liaison avec le jeu, match en cours et bilans. */
  cs2State(): Promise<Cs2State>
  /** Bilan CS2 ouvert : il n'est plus proposé. */
  cs2RecapSeen(id: string): Promise<void>
  /** Match CS2 en cours (au plus une fois par seconde), ou null à sa fin. Renvoie la fonction de désabonnement. */
  onCs2Live(cb: (live: Cs2Live | null) => void): () => void
  /** Liaison ou liste des bilans changée : relire `cs2State()`. Renvoie la fonction de désabonnement. */
  onCs2State(cb: () => void): () => void
  /** Bilan CS2 prêt, ou à ouvrir (clic sur la notification Windows). Renvoie la fonction de désabonnement. */
  onCs2Recap(cb: (e: Cs2RecapEvent) => void): () => void
  /** Overlay CS2 (bêta) : réglages de la fenêtre de l'overlay. */
  cs2OverlayConfig(): Promise<Cs2OverlayConfig>
  /** Paramètres : montre l'overlay quelques secondes avec des chiffres d'exemple, même sans CS2. */
  cs2OverlayPreview(): Promise<void>
  /** Page de l'overlay peinte : la fenêtre peut s'afficher. */
  cs2OverlayReady(): Promise<void>
  onCs2OverlayConfig(cb: (c: Cs2OverlayConfig) => void): () => void
  /** Alertes d'amis à afficher dans la fenêtre (quand elle est au premier plan ; sinon Windows les affiche). */
  onFriendAlert(cb: (alerts: FriendAlert[]) => void): () => void
  /** Clic sur une notification Windows : ouvrir le panneau d'amis. */
  onShowFriends(cb: () => void): () => void
  /** Envoie une alerte d'essai, dans la fenêtre et en notification Windows. */
  testFriendAlert(): Promise<void>
  /** Annonces officielles d'un jeu sur Steam (gardées 30 min, sauf `refresh`). */
  getGameNews(id: string, refresh?: boolean): Promise<GameNews>
  /** Les actus de ce jeu ont été vues dans sa fiche : son badge « Nouveau patch » disparaît. `upTo` : seulement jusqu'à cette date (une annonce lue). */
  markNewsSeen(id: string, upTo?: number): Promise<void>
  /** Page Actus des jeux : les dernières annonces de tous les jeux suivis, sans réseau. */
  getNewsFeed(): Promise<NewsFeed>
  /** « Actualiser » : redemande à Steam les annonces relevées il y a plus d'une minute, puis renvoie la page. */
  refreshNewsFeed(): Promise<NewsFeed>
  /** « Tout marquer comme lu » : plus aucun badge « Nouveau patch » jusqu'aux prochaines annonces. */
  markAllNewsSeen(): Promise<void>
  /** Jeux du compte Steam non installés sur ce PC (liste gardée 1 h, sauf `refresh`). */
  getSteamLibrary(refresh?: boolean): Promise<SteamLibrary>
  /** Ouvre l'installation d'un jeu Steam non installé ; il rejoint la bibliothèque une fois téléchargé. */
  installGame(id: string): Promise<void>
  /** Succès Steam d'un jeu, avec leur rareté (gardés 10 min, sauf `refresh`). */
  getAchievements(id: string, refresh?: boolean): Promise<GameAchievements>
  /** Page Trophées : tous les jeux Steam joués. Lance le relevé s'il a plus de 6 h (ou tout de suite avec `refresh`). */
  getAchievementsOverview(refresh?: boolean): Promise<AchievementsOverview>
  /** Démarrage avec Windows tel que Windows le voit (il peut l'avoir désactivé de son côté). */
  getStartupState(): Promise<StartupState>
  platform: string
  version: string
}
