// Contrats entre App.tsx et les écrans. Chaque écran exporte un composant nommé qui reçoit exactement ces props.
import type { RefObject } from 'react'
import type { LaunchVia } from '@shared/launch'
import type { Account, Friend, FriendPlatform, FriendsResult, Game, ScanReport, Settings } from '@shared/types'

export type View = 'home' | 'library' | 'profile' | 'stats' | 'settings'
export type SettingsSection = 'accounts' | 'library' | 'interface' | 'advanced' | 'about'
export type LoginPlatform = 'steam' | 'discord' | 'psn'

/** Préférences d'interface, propres à ce PC (localStorage `pg.ui`). */
export interface UiPrefs {
  /** Liste d'amis du menu latéral : dépliée ou repliée sur son en-tête. */
  friendsPanel: 'open' | 'hidden'
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

/** components/FavRail.tsx → `export function FavRail` (rail des jeux favoris, tout à gauche) */
export interface FavRailProps {
  games: Game[]
  /** Clic : lance le jeu. */
  onLaunch: LaunchFn
  /** Clic droit ou touche Menu : ouvre la fiche. */
  onOpen: (g: Game) => void
  /** « + » : rouvre le choix des favoris. */
  onEditFavorites: () => void
}

/** components/Sidebar.tsx → `export function Sidebar` (salutation, navigation, amis, paramètres) */
export interface SidebarProps {
  view: View
  onView: (v: View) => void
  gamesCount: number
  accounts: Account[]
  demo: boolean
  accountMenuOpen: boolean
  onToggleAccountMenu: () => void
  friends: SideFriendsProps
}

/** components/friends/SideFriends.tsx → `export function SideFriends` (liste d'amis du menu latéral) */
export interface SideFriendsProps {
  result: FriendsResult
  accounts: Account[]
  games: Game[]
  demo: boolean
  /** Un serveur Discord est renseigné (ses membres s'affichent même sans compte). */
  discordConfigured: boolean
  loading: boolean
  /** Liste dépliée (préférence `friendsPanel`). */
  open: boolean
  onToggleOpen: () => void
  onRefresh: () => void
  onOpenAccounts: () => void
}

/** components/TopBar.tsx → `export function TopBar` */
export interface TopBarProps {
  /** Titre de la page ; absent quand la page pose ses onglets dans la barre (TopTabs). */
  title?: string
  /** Recherche globale : filtre la bibliothèque (bascule sur Bibliothèque quand on tape). */
  query: string
  onQueryChange: (q: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  /** Reçoit l'élément où les pages posent leurs onglets. */
  slotRef: (el: HTMLElement | null) => void
}

/** components/AccountMenu.tsx → `export function AccountMenu` (popover ancré sous la salutation du menu latéral) */
export interface AccountMenuProps {
  open: boolean
  accounts: Account[]
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
  scanning: boolean
  report: ScanReport[]
  demo: boolean
  onLaunch: LaunchFn
  onOpen: (g: Game) => void
  onFavorite: (g: Game) => void
  onRescan: () => void
  onEnableDemo: () => void
  onShowLibrary: () => void
}

/** components/library/Library.tsx → `export function Library` */
export interface LibraryProps {
  games: Game[]
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
  onEnableDemo: () => void
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
  /** Raccourci « Tes stats Battlefield 6 » (fiche de Battlefield 6 seulement). */
  onOpenStats: () => void
  /** Actus des jeux activées (Paramètres › Bibliothèque) : section « Actus » et bandeau du nouveau patch. */
  news: boolean
}

/** components/Profile.tsx → `export function Profile` */
export interface ProfileProps {
  games: Game[]
  accounts: Account[]
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
}

/** components/settings/SettingsView.tsx → `export function SettingsView` */
export interface SettingsProps {
  section: SettingsSection
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
  loginPending: LoginPlatform | null
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
  onDemo: () => void
}

/**
 * components/setup/Setup.tsx → `export function Setup` (plein écran, hors coque, comme Login).
 * Montré une fois après l'entrée (localStorage `pg.setup` absent), et rouvert depuis Paramètres › Bibliothèque.
 * Étapes : analyse du PC (rapport du scan), choix des favoris parmi les jeux détectés, puis la bibliothèque.
 */
export interface SetupProps {
  /** true au premier lancement (commence par l'analyse) ; false quand on le rouvre depuis les paramètres (va droit au choix). */
  firstRun: boolean
  games: Game[]
  report: ScanReport[]
  scanning: boolean
  demo: boolean
  /** Rescanne le PC (même action que « Relancer le scan »). */
  onRescan: () => void
  onEnableDemo: () => void
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
