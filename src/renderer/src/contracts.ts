// Contrats entre App.tsx et les écrans. Chaque écran exporte un composant nommé qui reçoit exactement ces props.
import type { RefObject } from 'react'
import type { Account, Friend, FriendPlatform, FriendsResult, Game, ScanReport, Settings } from '@shared/types'

export type View = 'library' | 'profile' | 'stats' | 'settings'
export type SettingsSection = 'accounts' | 'library' | 'interface' | 'advanced' | 'about'
export type LoginPlatform = 'steam' | 'discord' | 'psn'

/** Préférences d'interface, propres à ce PC (localStorage `pg.ui`). */
export interface UiPrefs {
  friendsPanel: 'open' | 'hidden'
  coverSize: 'S' | 'M' | 'L'
  reduceMotion: boolean
  transparency: boolean
  /** « Effets visuels » : relief des jaquettes, reflets, fond aux couleurs du jeu, parallaxe. */
  visualFx: boolean
}

export const COVER_MIN: Record<UiPrefs['coverSize'], number> = { S: 136, M: 164, L: 200 }

/** components/Rail.tsx → `export function Rail` */
export interface RailProps {
  view: View
  onView: (v: View) => void
  accounts: Account[]
  demo: boolean
  accountMenuOpen: boolean
  onToggleAccountMenu: () => void
}

/** components/TopBar.tsx → `export function TopBar` */
export interface TopBarProps {
  /** Recherche globale : filtre la bibliothèque (bascule sur Bibliothèque quand on tape). */
  query: string
  onQueryChange: (q: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  friends: Friend[]
  friendsOpen: boolean
  onToggleFriends: () => void
}

/** components/AccountMenu.tsx → `export function AccountMenu` (popover ancré au bas de la barre latérale) */
export interface AccountMenuProps {
  open: boolean
  accounts: Account[]
  onClose: () => void
  onProfile: () => void
  onAccounts: () => void
  onSettings: () => void
  onLogin: () => void
}

/** components/library/Library.tsx → `export function Library` */
export interface LibraryProps {
  games: Game[]
  friends: Friend[]
  scanning: boolean
  report: ScanReport[]
  demo: boolean
  /** Texte de la recherche du haut (déjà appliqué par Library au filtrage). */
  query: string
  onClearQuery: () => void
  launchingId: string | null
  onLaunch: (g: Game) => void
  onOpen: (g: Game) => void
  onFavorite: (g: Game) => void
  onRescan: () => void
  onEnableDemo: () => void
}

/** components/GameSheet.tsx → `export function GameSheet` (tiroir à droite ; `game === null` = fermé) */
export interface GameSheetProps {
  game: Game | null
  friends: Friend[]
  launching: boolean
  onClose: () => void
  onLaunch: (g: Game) => void
  onFavorite: (g: Game) => void
  onOpenFolder: (g: Game) => void
}

/** components/friends/FriendsPanel.tsx → `export function FriendsPanel` */
export interface FriendsPanelProps {
  result: FriendsResult
  accounts: Account[]
  games: Game[]
  demo: boolean
  /** Un serveur Discord est renseigné (ses membres s'affichent même sans compte). */
  discordConfigured: boolean
  loading: boolean
  onRefresh: () => void
  onHide: () => void
  onOpenAccounts: () => void
}

/** components/Profile.tsx → `export function Profile` */
export interface ProfileProps {
  games: Game[]
  accounts: Account[]
  friends: FriendsResult
  launchingId: string | null
  onOpenGame: (g: Game) => void
  onLaunch: (g: Game) => void
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
}
