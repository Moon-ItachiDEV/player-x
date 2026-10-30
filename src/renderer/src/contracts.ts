// Contrats entre App.tsx et les écrans. Chaque écran exporte un composant nommé qui reçoit exactement ces props.
import type { RefObject } from 'react'
import type { LaunchVia } from '@shared/launch'
import type { Identity } from '@shared/profile'
import type { Account, DiscordChannel, Friend, FriendPlatform, FriendsResult, Game, ScanReport, Settings, SteamLibrary } from '@shared/types'
import type { SearchItem } from './components/search/SearchResults'

export type View = 'home' | 'library' | 'friends' | 'profile' | 'stats' | 'settings'
export type SettingsSection = 'accounts' | 'library' | 'interface' | 'overlay' | 'advanced' | 'about'
export type LoginPlatform = 'steam' | 'discord' | 'psn'

/** Préférences d'interface, propres à ce PC (localStorage `pg.ui`). */
export interface UiPrefs {
  coverSize: 'S' | 'M' | 'L'
  reduceMotion: boolean
  transparency: boolean
  /** « Effets visuels » : relief des jaquettes, reflets, fond aux couleurs du jeu, parallaxe. */
  visualFx: boolean
}

export const COVER_MIN: Record<UiPrefs['coverSize'], number> = { S: 136, M: 164, L: 200 }

/**
 * Lance un jeu (launch/store.ts startLaunch). `from` : l'image cliquée, d'où part la jaquette de la mise à feu.
 * Pendant l'attente, ramène la carte du lancement devant au lieu de renvoyer le lien.
 */
export type LaunchFn = (g: Game, from?: HTMLElement | null, via?: LaunchVia) => void

/** components/friends/SideFriends.tsx → `export function SideFriends` (liste d'amis de la page Amis) */
export interface SideFriendsProps {
  result: FriendsResult
  accounts: Account[]
  games: Game[]
  demo: boolean
  /** Un serveur Discord est renseigné (ses membres s'affichent même sans compte). */
  discordConfigured: boolean
  loading: boolean
  onRefresh: () => void
  onOpenAccounts: () => void
  /** « Masquer » un membre du serveur Discord ; false si Player X a refusé (le membre reste affiché). */
  onHideMember: (f: Friend) => Promise<boolean>
  /** Ouvre Paramètres › Comptes › Membres masqués. */
  onManageHidden: () => void
  /** Texte de recherche au départ (ami choisi dans la recherche globale). */
  initialQuery?: string
  /** Ami choisi dans la recherche globale (`steam:…`) : sélectionné et montré à l'arrivée. */
  initialFriendId?: string
  /** Ouvre la fiche d'un jeu de la bibliothèque (carte « Joue à »). */
  onOpenGame: (g: Game) => void
}

/** components/TopBar.tsx → `export function TopBar` (direction « Écran console » : la seule navigation, en onglets texte) */
export interface TopBarProps {
  /** Recherche globale (Ctrl K) : le texte filtre aussi la Bibliothèque quand elle est affichée. */
  query: string
  onQueryChange: (q: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  /** Jeux, amis, membres du serveur, pages et actions proposés sous le champ ; null = « Voir dans la Bibliothèque ». */
  search: { items: SearchItem[]; onPick: (item: SearchItem | null, launch: boolean) => void }
  /** La Bibliothèque est affichée : la liste ne propose pas d'y aller. */
  onLibraryView: boolean
  /** Page affichée (onglet souligné) et changement de page. */
  view: View
  onView: (v: View) => void
  /** Amis en jeu : pastille de l'onglet « Amis ». */
  friendsInGame: number
  /** Bouton du compte (avatar, à droite) : ouvre le menu du compte. */
  accounts: Account[]
  /** Toi : pseudo et photo choisis dans Profil, sinon ceux du compte principal (shared/profile.ts). */
  me: Identity
  accountMenuOpen: boolean
  onToggleAccountMenu: () => void
}

/** components/AccountMenu.tsx → `export function AccountMenu` (popover ancré sous l'avatar de la barre du haut) */
export interface AccountMenuProps {
  open: boolean
  accounts: Account[]
  me: Identity
  onClose: () => void
  onProfile: () => void
  onAccounts: () => void
  onSettings: () => void
  onLogin: () => void
}

/** components/home/Home.tsx → `export function Home` (accueil : jeu à la une, « À reprendre ») */
export interface HomeProps {
  games: Game[]
  friends: Friend[]
  /** Salons vocaux publics du serveur Discord (widget) : bloc « Vocal » en haut de la colonne des amis. */
  channels?: DiscordChannel[]
  scanning: boolean
  report: ScanReport[]
  demo: boolean
  onLaunch: LaunchFn
  onOpen: (g: Game) => void
  onFavorite: (g: Game) => void
  onRescan: () => void
  onShowLibrary: () => void
  /** « Voir tous les amis » : page Amis. */
  onShowFriends: () => void
}

/** components/library/Library.tsx → `export function Library` */
export interface LibraryProps {
  games: Game[]
  /** Jeux du compte Steam pas installés sur ce PC : onglet « Non installés », et en fin de recherche. */
  notInstalled: Game[]
  onInstall: (g: Game) => void
  scanning: boolean
  report: ScanReport[]
  demo: boolean
  /** Texte de la recherche du haut (déjà appliqué par Library au filtrage). */
  query: string
  onClearQuery: () => void
  onLaunch: LaunchFn
  onOpen: (g: Game) => void
  onFavorite: (g: Game) => void
  onRescan: () => void
  /** Taille des jaquettes (menu « Taille »), partagée avec Paramètres › Interface. */
  coverSize: UiPrefs['coverSize']
  onCoverSize: (s: UiPrefs['coverSize']) => void
}

/** components/GameSheet.tsx → `export function GameSheet` (tiroir à droite ; `game === null` = fermé) */
export interface GameSheetProps {
  game: Game | null
  friends: Friend[]
  onClose: () => void
  onLaunch: LaunchFn
  /** « Réanalyser » (exécutable introuvable) : relance l'analyse de la bibliothèque. */
  onRescan?: () => void
  onFavorite: (g: Game) => void
  onOpenFolder: (g: Game) => void
  /** « Installer » d'un jeu Steam pas installé sur ce PC (`game.notInstalled`). */
  onInstall: (g: Game) => void
  /** Raccourci « Tes stats Battlefield 6 » (fiche de Battlefield 6 seulement). */
  onOpenStats: () => void
  /** Actus des jeux activées (Paramètres › Bibliothèque) : onglet « Actus », le premier de la fiche. */
  news: boolean
  /** Page d'où la fiche est ouverte (fil d'Ariane et bouton « Retour »). */
  from?: View
}

/** components/Profile.tsx → `export function Profile` */
export interface ProfileProps {
  games: Game[]
  accounts: Account[]
  me: Identity
  /** Pseudo et photo choisis : enregistrés dans les réglages (vides : ceux du compte principal). */
  onSaveProfile: (patch: { profileName?: string; profileAvatar?: string }) => Promise<void>
  friends: FriendsResult
  onOpenGame: (g: Game) => void
  onLaunch: LaunchFn
  onManageAccounts: () => void
  onShowFriends: () => void
}

/** components/stats/Stats.tsx → `export function Stats` (stats Battlefield 6 via gametools.network) */
export interface StatsProps {
  /** Pour le visuel de Battlefield 6 quand le jeu est dans la bibliothèque. */
  games: Game[]
  /** Stats à vie de CS2 sans clé ou sans compte Steam : ouvre la bonne section des Paramètres. */
  onOpenSettings: (section: SettingsSection) => void
}

/** components/settings/SettingsView.tsx → `export function SettingsView` */
export interface SettingsProps {
  section: SettingsSection
  /** Jeux de la bibliothèque (images des jeux dans Paramètres › Overlay). */
  games: Game[]
  onSection: (s: SettingsSection) => void
  settings: Settings
  accounts: Account[]
  friends: FriendsResult
  report: ScanReport[]
  scanning: boolean
  lastScanAt: number | null
  gamesCount: number
  ui: UiPrefs
  onUiChange: (patch: Partial<UiPrefs>) => void
  /** Enregistre immédiatement (pas de bouton global) et renvoie les paramètres enregistrés. */
  onSaveSettings: (patch: Partial<Settings>) => Promise<Settings>
  onLogin: (p: LoginPlatform) => void
  onLogout: (p: FriendPlatform) => Promise<void>
  onRescan: () => void
  /** Rouvre l'écran de démarrage (choix des jeux favoris). */
  onOpenSetup: () => void
  /** Rejoue tout l'accueil de la première connexion (bienvenue, analyse, favoris), sans rien effacer. */
  onReplaySetup: () => void
  /** Jeux du compte Steam pas installés (null avant la première lecture), et relecture immédiate. */
  steamLibrary: SteamLibrary | null
  onRefreshSteamLibrary: () => Promise<void>
  loginPending: LoginPlatform | null
  /** « Afficher » un membre masqué du serveur Discord. */
  onShowMember: (name: string) => Promise<void>
  /** Bloc à montrer et à focaliser en arrivant (« Gérer » de la liste d'amis). */
  focus: 'hidden-members' | null
  onFocused: () => void
}

/** components/Login.tsx → `export function Login` (plein écran, hors coque) */
export interface LoginProps {
  /** Jeux détectés localement, pour la mosaïque de jaquettes. */
  games: Game[]
  pending: LoginPlatform | null
  error: string | null
  onSteam: () => void
  onCancel: () => void
  onSkip: () => void
}

/**
 * components/setup/Setup.tsx → `export function Setup` (plein écran, hors coque, comme Login).
 * Montré une fois après l'entrée (localStorage `pg.setup` absent), et rouvert depuis Paramètres › Bibliothèque.
 * Étapes : analyse du PC (rapport du scan), choix des favoris parmi les jeux détectés, puis la bibliothèque.
 */
export interface SetupProps {
  /**
   * true au premier lancement ou quand on le rejoue depuis les paramètres (bienvenue, analyse, CS2, favoris, c'est prêt) ;
   * false quand on le rouvre pour les favoris (va droit au choix).
   */
  firstRun: boolean
  /** Rejoué depuis les paramètres : « Commencer » relance un scan normal. */
  replay?: boolean
  games: Game[]
  report: ScanReport[]
  scanning: boolean
  demo: boolean
  /** Rescanne le PC (même action que « Relancer le scan »). */
  onRescan: () => void
  /** Réglages CS2 de l'étape Counter-Strike 2 (les mêmes que dans Paramètres). */
  settings: Settings
  onSaveSettings: (patch: Partial<Settings>) => Promise<Settings>
  /** Enregistre la sélection (remplace les favoris) puis ferme l'écran. */
  onDone: (favoriteIds: string[]) => Promise<void>
  /** Ferme sans toucher aux favoris. */
  onSkip: () => void
}

/** components/UpdateNotice.tsx → `export function UpdateNotice` (bandeau discret quand une mise à jour est prête ; se rend `null` sinon) */
export interface UpdateNoticeProps {
  onOpenAbout: () => void
  /** Un jeu tourne : la carte devient une pastille immobile et le compte à rebours se met en pause. */
  inGame: boolean
  /** Un vrai jeu est en train de se lancer : même discrétion, compte « En pause pendant le lancement ». */
  launching?: boolean
}
