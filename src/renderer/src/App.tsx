import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { identity } from '@shared/profile'
import { cleanName } from '@shared/text'
import type { Account, Friend, FriendPlatform, FriendsResult, Game, ScanReport, Settings, SteamLibrary } from '@shared/types'
import { AccountMenu } from './components/AccountMenu'
import { Ambient } from './components/Ambient'
import { FriendsPage } from './components/friends/FriendsPage'
import { countInGame } from './components/friends/friendView'
import { FriendAlerts } from './components/FriendAlerts'
import { GameSheet } from './components/GameSheet'
import { Home } from './components/home/Home'
import { Library } from './components/library/Library'
import { Login } from './components/Login'
import { Profile } from './components/Profile'
import { SettingsView } from './components/settings/SettingsView'
import { Setup } from './components/setup/Setup'
import { RecapHost } from './components/stats/Recap'
import { Cs2RecapHost } from './components/cs2/Cs2Recap'
import { Stats } from './components/stats/Stats'
import { TopBar } from './components/TopBar'
import type { SearchItem } from './components/search/SearchResults'
import type { IconName } from './components/ui/Icon'
import { KIND_LABEL } from './components/ui/StoreTag'
import { TopSlot } from './components/TopTabs'
// Avant WhatsNew : lit pg.lastVersion et prépare le retour d'une mise à jour avant le premier rendu.
import { gameRunning, launchBusy } from './update/session'
import './update/stage'
import { UpdateStage } from './update/UpdateStage'
import { UpdateNotice } from './components/UpdateNotice'
import { LaunchDock } from './launch/LaunchDock'
import { LaunchStage } from './launch/LaunchStage'
import { bindLaunchIpc, resetLaunches, setLaunchDemo, startLaunch, useFrozenGames, useLaunchPending } from './launch/store'
import { bindSteamUpdates } from './ready/store'
import { WhatsNew } from './components/WhatsNew'
import { errorMessage, ToastProvider, useToast } from './components/ui/Toasts'
import { COVER_MIN, type LoginPlatform, type SettingsSection, type UiPrefs, type View } from './contracts'
import { closeTarget, takeMorphSource, useSystemReducedMotion, useSystemReducedTransparency, useWindowActivity, withViewTransition } from './motion'
import './styles/shell.css'
import './styles/transitions.css'

const api = window.launcher

const DEFAULT_UI: UiPrefs = { coverSize: 'M', reduceMotion: false, transparency: true, visualFx: true }

const SETUP_KEY = 'pg.setup'

/** Titre de la barre du haut ; la bibliothèque, les stats et les paramètres y posent leurs onglets à la place. */

function setupDone(): boolean {
  try {
    return localStorage.getItem(SETUP_KEY) !== null
  } catch {
    return true
  }
}

function loadUi(): UiPrefs {
  try {
    return { ...DEFAULT_UI, ...JSON.parse(localStorage.getItem('pg.ui') ?? '{}') }
  } catch {
    return DEFAULT_UI
  }
}

export default function App(): React.JSX.Element {
  const [ui, setUi] = useState<UiPrefs>(loadUi)
  // Écran de démarrage (choix des favoris) : une fois après l'entrée, puis à la demande. `first` = premier passage.
  // `replay` : rejoué depuis les paramètres (« Revoir l'accueil de Player X »), le scan est relancé au départ.
  const [setup, setSetup] = useState<SetupState>(() => ({ open: !setupDone(), first: !setupDone() }))
  const systemReduced = useSystemReducedMotion()
  const systemOpaque = useSystemReducedTransparency()
  useWindowActivity()
  const updateUi = useCallback((patch: Partial<UiPrefs>) => {
    setUi((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem('pg.ui', JSON.stringify(next))
      } catch {
        /* stockage indisponible : la préférence vaut pour la session */
      }
      return next
    })
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('reduce-motion', ui.reduceMotion)
    // Sans transparence (Paramètres ou Windows) : couleurs pleines, aucun flou.
    root.classList.toggle('no-blur', !ui.transparency || systemOpaque)
    root.style.setProperty('--cover-min', `${COVER_MIN[ui.coverSize]}px`)
    // Seul interrupteur des effets riches (CSS :root[data-fx='on'], JS fxOn()).
    root.dataset.fx = ui.visualFx && !ui.reduceMotion && !systemReduced ? 'on' : 'off'
  }, [ui, systemReduced, systemOpaque])

  return (
    <ToastProvider>
      <Shell ui={ui} updateUi={updateUi} setup={setup} setSetup={setSetup} />
      <UpdateStage />
      <LaunchStage />
    </ToastProvider>
  )
}

interface SetupState {
  open: boolean
  first: boolean
  replay?: boolean
}

interface ShellProps {
  ui: UiPrefs
  updateUi: (p: Partial<UiPrefs>) => void
  setup: SetupState
  setSetup: (v: SetupState) => void
}

function Shell({ ui, updateUi, setup, setSetup }: ShellProps): React.JSX.Element {
  const notify = useToast()
  const [ready, setReady] = useState(false)
  const [entered, setEntered] = useState(false)
  const [view, setView] = useState<View>('home')
  const [section, setSection] = useState<SettingsSection>('accounts')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [steamLib, setSteamLib] = useState<SteamLibrary | null>(null)
  const [scanning, setScanning] = useState(false)
  const [report, setReport] = useState<ScanReport[]>([])
  const [lastScanAt, setLastScanAt] = useState<number | null>(null)
  const [friends, setFriends] = useState<FriendsResult>({ friends: [], errors: {} })
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [query, setQuery] = useState('')
  // Ami choisi dans la recherche globale : la page Amis s'ouvre filtrée sur lui (n force un nouvel affichage).
  const [friendsQuery, setFriendsQuery] = useState<{ text: string; n: number; id?: string }>({ text: '', n: 0 })
  const [openGameId, setOpenGameId] = useState<string | null>(null)
  // Paramètres : bloc à montrer en arrivant (« Gérer » des membres masqués).
  const [settingsFocus, setSettingsFocus] = useState<'hidden-members' | null>(null)
  const [accountMenu, setAccountMenu] = useState(false)
  // Emplacement des onglets de page dans la barre du haut (TopTabs).
  const [tabSlot, setTabSlot] = useState<HTMLElement | null>(null)
  const [loginPending, setLoginPending] = useState<LoginPlatform | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // Seule la dernière connexion lancée met à jour l'état et le toast « login ».
  const loginSeq = useRef(0)
  // Change à chaque bascule du mode démo : un scan lancé avant ne doit pas remplacer la nouvelle bibliothèque.
  const libraryEpoch = useRef(0)

  // Jeux du compte Steam pas installés sur ce PC : relus avec la bibliothèque, et quand le compte Steam ou la clé changent.
  const loadSteamLib = useCallback(async (refresh = false) => {
    try {
      setSteamLib(await api.getSteamLibrary(refresh))
    } catch {
      /* la liste affichée reste la précédente */
    }
  }, [])

  const loadGames = useCallback(
    async (refresh = false) => {
      const epoch = libraryEpoch.current
      setScanning(true)
      try {
        const list = await api.getGames(refresh)
        if (epoch !== libraryEpoch.current) return
        setGames(list)
        if (refresh) {
          // Un jeu peut être passé de « Non installés » à la bibliothèque.
          loadSteamLib()
          notify(`Bibliothèque à jour · ${list.length} jeu${list.length > 1 ? 'x' : ''}`, { kind: 'success', id: 'scan' })
        }
      } catch (e) {
        notify(errorMessage(e), { kind: 'error' })
      } finally {
        // Un scan devenu obsolète (bascule du mode démo) ne touche plus à l'état affiché.
        if (epoch === libraryEpoch.current) {
          setScanning(false)
          setLastScanAt(Date.now())
          setReport(await api.getScanReport())
        }
      }
    },
    [notify, loadSteamLib]
  )

  // « Masquer » / « Afficher » un membre du serveur Discord : la liste relue revient tout de suite.
  const setMemberHidden = useCallback(
    async (name: string, hidden: boolean): Promise<boolean> => {
      try {
        setFriends(await api.setMemberHidden(name, hidden))
        return true
      } catch (e) {
        notify(errorMessage(e), { kind: 'error' })
        return false
      }
    },
    [notify]
  )
  const hideMember = useCallback(
    async (f: Friend): Promise<boolean> => {
      const ok = await setMemberHidden(f.name, true)
      if (ok)
        notify(`${f.name} ne s'affiche plus dans Player X`, {
          id: 'member-hidden',
          action: { label: 'Annuler', onClick: () => void setMemberHidden(f.name, false) }
        })
      return ok
    },
    [notify, setMemberHidden]
  )
  const showMember = useCallback(
    async (name: string) => {
      if (await setMemberHidden(name, false)) notify(`${name} s'affiche de nouveau`, { kind: 'success', id: 'member-hidden' })
    },
    [notify, setMemberHidden]
  )

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true)
    try {
      setFriends(await api.getFriends())
      // Le pseudo ou l'avatar d'un compte peut être mis à jour pendant la récupération des amis.
      const next = await api.getAccounts()
      setAccounts((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    } finally {
      setFriendsLoading(false)
    }
  }, [])

  // Démarrage : paramètres + comptes, puis les jeux (même avant d'entrer, pour la mosaïque de connexion).
  useEffect(() => {
    Promise.all([api.getSettings(), api.getAccounts()]).then(([s, a]) => {
      setSettings(s)
      setAccounts(a)
      setEntered(a.length > 0 || s.demoMode)
      setReady(true)
    })
    loadGames()
    return api.onGamesChanged(() => {
      api
        .getGames()
        .then(setGames)
        .catch(() => {})
      loadSteamLib()
    })
  }, [loadGames, loadSteamLib, setEntered])

  // Lancements : événements du processus principal, puis ceux déjà en cours (rechargement de l'interface).
  useEffect(() => bindLaunchIpc(), [])
  // Prêt à jouer : mises à jour Steam en attente ou en cours (pastilles des jaquettes, bouton Jouer).
  useEffect(() => bindSteamUpdates(), [])
  useEffect(() => setLaunchDemo(!!settings?.demoMode), [settings?.demoMode])
  const pending = useLaunchPending()
  // Les écrans voient la dernière partie d'avant le clic tant que le lancement attend (rien ne bouge).
  const shownGames = useFrozenGames(games)
  const anyRunning = games.some((g) => g.running)

  // Un jeu en cours (ou un vrai lancement) coupe l'aperçu de l'animation de mise à jour (rien n'anime pendant une partie).
  useEffect(() => {
    launchBusy.set(pending.real && !anyRunning)
    gameRunning.set(anyRunning || pending.real)
  }, [anyRunning, pending.real])
  // Pendant un lancement, les boucles d'ambiance s'arrêtent (base.css :root[data-launching]).
  useEffect(() => {
    const root = document.documentElement
    if (pending.any) root.dataset.launching = ''
    else delete root.dataset.launching
  }, [pending.any])

  // Les comptes comptent par identité : un pseudo ou un avatar mis à jour ne relance pas toute la récupération.
  const accountsKey = accounts.map((a) => `${a.platform}:${a.id}`).join('|')
  useEffect(() => {
    if (!entered) return
    loadFriends()
    const timer = setInterval(loadFriends, 60_000)
    return () => clearInterval(timer)
  }, [entered, accountsKey, settings?.demoMode, settings?.discordGuildId, settings?.steamApiKey, settings?.psnNpsso, loadFriends])

  useEffect(() => {
    if (entered) loadSteamLib()
  }, [entered, accountsKey, settings?.demoMode, settings?.steamApiKey, loadSteamLib])

  // Une liste Steam lue avant un scan peut encore contenir un jeu qui vient d'être installé.
  const notInstalled = useMemo(() => {
    const here = new Set(games.map((g) => g.id))
    return (steamLib?.notInstalled ?? []).filter((g) => !here.has(g.id))
  }, [games, steamLib])

  // Clic sur une notification Windows d'un ami (ou sur une alerte) : la page Amis s'ouvre.
  const showFriends = useCallback(() => {
    setView('friends')
    setAccountMenu(false)
  }, [])
  useEffect(() => api.onShowFriends(showFriends), [showFriends])

  // Ctrl+F / Ctrl+K : recherche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'k')) {
        // Une fenêtre modale ouverte (Quoi de neuf…) garde le focus : la recherche est derrière son voile.
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = await api.saveSettings(patch)
    setSettings(next)
    if ('demoMode' in patch) {
      // Le processus principal a arrêté de suivre les lancements de l'autre bibliothèque.
      setLaunchDemo(next.demoMode)
      resetLaunches()
      libraryEpoch.current++
      setGames(await api.getGames())
      // Un scan encore en cours appartient à l'ancienne bibliothèque : il ne doit plus bloquer l'écran.
      setScanning(false)
      setReport(await api.getScanReport())
    }
    return next
  }, [])

  const login = useCallback(
    async (platform: LoginPlatform) => {
      const seq = ++loginSeq.current
      const latest = (): boolean => seq === loginSeq.current
      setLoginError(null)
      setLoginPending(platform)
      notify(platform === 'psn' ? 'Connexion à PlayStation…' : 'Termine la connexion dans ton navigateur…', { kind: 'loading', id: 'login' })
      try {
        const account = platform === 'psn' ? await api.connectPsn() : await api.login(platform)
        setAccounts(await api.getAccounts())
        setEntered(true)
        if (latest()) notify(`Connecté en tant que ${account.name}`, { kind: 'success', id: 'login', avatarUrl: account.avatarUrl })
      } catch (e) {
        if (!latest()) return
        const msg = errorMessage(e)
        setLoginError(msg === 'Connexion annulée.' ? null : msg)
        notify(msg, { kind: msg === 'Connexion annulée.' ? 'info' : 'error', id: 'login' })
      } finally {
        if (latest()) setLoginPending(null)
      }
    },
    [notify, setEntered]
  )

  const logout = useCallback(
    async (platform: FriendPlatform) => {
      setAccounts(await api.logout(platform))
      // Le jeton NPSSO est effacé avec le compte PlayStation : Avancé doit l'afficher vide.
      if (platform === 'psn') setSettings(await api.getSettings())
      notify(`${platform === 'psn' ? 'PlayStation' : platform === 'steam' ? 'Steam' : 'Discord'} déconnecté`, { kind: 'success' })
    },
    [notify]
  )

  const install = useCallback(
    async (game: Game) => {
      const name = cleanName(game.name)
      try {
        await api.installGame(game.id)
        notify(
          settings?.demoMode
            ? `Mode démo : Steam installerait ${name}`
            : `Steam s'ouvre pour installer ${name}. Le jeu rejoindra ta bibliothèque une fois téléchargé.`,
          { kind: 'info' }
        )
      } catch (e) {
        notify(`Impossible d'installer ${name} : ${errorMessage(e)}`, { kind: 'error' })
      }
    },
    [notify, settings?.demoMode]
  )

  const toggleFavorite = useCallback(async (game: Game) => setGames(await api.toggleFavorite(game.id)), [])

  const openFolder = useCallback(
    async (game: Game) => {
      try {
        await api.openGameFolder(game.id)
      } catch (e) {
        notify(errorMessage(e), { kind: 'error' })
      }
    },
    [notify]
  )

  /** Ferme l'écran de démarrage : vers l'accueil après un choix ou au premier passage, sinon on reste où on était. */
  const closeSetup = useCallback(
    (toHome: boolean) => {
      try {
        localStorage.setItem(SETUP_KEY, '1')
      } catch {
        /* stockage indisponible : l'écran reviendra au prochain lancement */
      }
      setSetup({ open: false, first: false })
      if (toHome) setView('home')
      // Retour aux Paramètres : le focus revient sur le bouton qui a ouvert l'écran.
      else requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-open-setup]')?.focus())
    },
    [setSetup]
  )

  const finishSetup = useCallback(
    async (ids: string[]) => {
      try {
        const list = await api.setFavorites(ids)
        setGames(list)
        closeSetup(true)
        // Compté sur ce qui a vraiment été enregistré (des jeux ont pu disparaître entre-temps).
        const saved = list.filter((g) => g.favorite).length
        if (saved) notify(`${saved} favori${saved > 1 ? 's' : ''} enregistré${saved > 1 ? 's' : ''}`, { kind: 'success' })
      } catch (e) {
        notify(errorMessage(e), { kind: 'error' })
      }
    },
    [closeSetup, notify]
  )

  const goSettings = (s: SettingsSection): void => {
    setSection(s)
    setView('settings')
    setAccountMenu(false)
  }

  const openGame = useMemo(
    () => shownGames.find((g) => g.id === openGameId) ?? notInstalled.find((g) => g.id === openGameId) ?? null,
    [shownGames, notInstalled, openGameId]
  )

  // Ouverture et fermeture de la fiche : la jaquette (ou le visuel) d'origine se transforme en en-tête.
  const openSheet = useCallback((g: Game) => {
    withViewTransition(
      () => setOpenGameId(g.id),
      { kind: 'open', source: takeMorphSource(g.id) }
    )
  }, [])

  // Succès rare débloqué (relevé en arrière-plan) : carte dorée, « Voir » ouvre la fiche du jeu.
  const gamesRef = useRef(games)
  gamesRef.current = games
  useEffect(
    () =>
      api.onRareAchievements((list) => {
        for (const a of list) {
          const pct = `${(a.percent < 10 ? Math.round(a.percent * 10) / 10 : Math.round(a.percent)).toString().replace('.', ',')} %`
          const game = gamesRef.current.find((g) => g.id === a.gameId)
          notify(`Succès rare débloqué : ${a.name} (${a.gameName}, ${pct} des joueurs)`, {
            kind: 'trophy',
            id: `rare:${a.gameId}:${a.id}`,
            ...(game ? { action: { label: 'Voir', onClick: () => openSheet(game) } } : {})
          })
        }
      }),
    [notify, openSheet]
  )
  // Prêt à jouer : Steam a fini la mise à jour (ou le téléchargement) d'un jeu. « Jouer » le lance tout de suite.
  useEffect(
    () =>
      api.onGameReady((e) => {
        const game = gamesRef.current.find((g) => g.id === e.gameId && !g.notInstalled)
        notify(`${e.name} est prêt`, {
          kind: 'success',
          id: `ready:${e.gameId}`,
          ...(game ? { action: { label: 'Jouer', onClick: () => startLaunch(game) } } : {})
        })
      }),
    [notify]
  )
  const closeSheet = useCallback(() => {
    withViewTransition(
      () => setOpenGameId(null),
      { kind: 'close', source: openGameId ? closeTarget(openGameId) : null }
    )
  }, [openGameId])

  // Recherche globale (Ctrl K) : ce que la liste propose. Les actions sont résolues au choix (searchPick).
  const searchItems = useMemo<SearchItem[]>(() => {
    const games: SearchItem[] = [...shownGames]
      .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
      .map((g) => ({ id: `game:${g.id}`, kind: 'game', label: g.name, hint: KIND_LABEL[g.store], art: 'cover', game: g, launchable: true }))
    // Jeux du compte Steam absents de ce PC : après les installés, la fiche propose de les installer.
    const missing: SearchItem[] = notInstalled.map((g) => ({
      id: `game:${g.id}`,
      kind: 'game',
      label: g.name,
      hint: `${KIND_LABEL[g.store]} · Pas installé`,
      art: 'cover',
      game: g,
      launchable: false
    }))
    const people: SearchItem[] = friends.friends.map((f) => ({
      id: `friend:${f.id}`,
      kind: f.platform === 'discord' ? 'member' : 'friend',
      label: f.name,
      hint: [
        f.status === 'in-game' ? 'En jeu' : f.status === 'online' ? 'En ligne' : f.status === 'away' ? 'Absent' : 'Hors ligne',
        f.game,
        f.platform === 'discord' ? '' : KIND_LABEL[f.platform]
      ]
        .filter(Boolean)
        .join(' · '),
      art: 'avatar',
      avatarUrl: f.avatarUrl,
      status: f.status
    }))
    const page = (id: string, label: string, icon: IconName, keywords?: string[]): SearchItem => ({
      id: `page:${id}`,
      kind: 'page',
      label,
      art: 'icon',
      icon,
      keywords
    })
    const pages: SearchItem[] = [
      page('home', 'Accueil', 'home'),
      page('library', 'Bibliothèque', 'grid', ['jeux']),
      page('friends', 'Amis', 'users', ['discord', 'membres', 'serveur', 'playstation']),
      page('stats', 'Stats de jeu', 'chart', ['temps de jeu', 'heures']),
      page('profile', 'Profil', 'user'),
      page('settings:accounts', 'Paramètres › Comptes', 'settings', ['steam', 'discord', 'playstation', 'psn', 'connexion', 'membres masqués']),
      page('settings:library', 'Paramètres › Bibliothèque', 'settings', ['scan', 'favoris', 'actus']),
      page('settings:interface', 'Paramètres › Interface', 'settings', ['jaquettes', 'animations', 'notifications', 'bilans', 'jeu prêt', 'mise à jour steam']),
      page('settings:overlay', 'Paramètres › Overlay', 'settings', ['cs2', 'counter-strike', 'premium']),
      page('settings:advanced', 'Paramètres › Avancé', 'settings', ['démo', 'démarrer avec windows']),
      page('settings:about', 'Paramètres › À propos', 'settings', ['version', 'mise à jour', 'nouveautés', 'bêta']),
      page('action:rescan', 'Relancer le scan', 'refresh', ['rechercher les jeux', 'scanner']),
      page('action:favorites', 'Choisir mes jeux favoris', 'star', ['favoris', 'rail']),
      page('action:replay', "Revoir l'accueil de Player X", 'gamepad', ['première connexion', 'bienvenue', 'scan'])
    ]
    return [...games, ...missing, ...people, ...pages]
  }, [shownGames, notInstalled, friends.friends, settings?.gameNews])

  // Le filtre posé par la recherche globale ne sert qu'une fois : il s'efface en quittant la page Amis.
  useEffect(() => {
    if (view !== 'friends') setFriendsQuery((q) => (q.text ? { text: '', n: q.n } : q))
  }, [view])

  if (!ready || !settings) return <div className="boot" />
  const me = identity(accounts, settings)

  if (!entered) {
    return (
      <Login
        games={games}
        pending={loginPending}
        error={loginError}
        onSteam={() => login('steam')}
        onCancel={() => api.cancelLogin()}
        onSkip={() => setEntered(true)}
      />
    )
  }

  if (setup.open) {
    return (
      <Setup
        firstRun={setup.first}
        replay={setup.replay}
        games={games}
        report={report}
        scanning={scanning}
        demo={settings.demoMode}
        onRescan={() => loadGames(true)}
        settings={settings}
        onSaveSettings={saveSettings}
        onDone={finishSetup}
        onSkip={() => closeSetup(setup.first)}
      />
    )
  }

  const go = (v: View): void => {
    setView(v)
    setAccountMenu(false)
  }

  const searchPick = (item: SearchItem | null, launch: boolean): void => {
    if (!item) return go('library')
    const [kind, ...rest] = item.id.split(':')
    const key = rest.join(':')
    if (kind === 'game') {
      const g = shownGames.find((x) => x.id === key)
      const missing = notInstalled.find((x) => x.id === key)
      if (g) launch ? startLaunch(g) : openSheet(g)
      else if (missing) openSheet(missing)
    } else if (kind === 'friend') {
      setFriendsQuery((q) => ({ text: item.label, n: q.n + 1, id: key }))
      go('friends')
    } else if (key.startsWith('settings:')) goSettings(key.slice('settings:'.length) as SettingsSection)
    else if (key === 'action:rescan') loadGames(true)
    else if (key === 'action:favorites') setSetup({ open: true, first: false })
    else if (key === 'action:replay') setSetup({ open: true, first: true, replay: true })
    else go(key as View)
  }

  const friendsProps = {
    result: friends,
    accounts,
    games,
    demo: settings.demoMode,
    discordConfigured: !!settings.discordGuildId,
    loading: friendsLoading,
    onRefresh: loadFriends,
    onOpenAccounts: () => goSettings('accounts'),
    onHideMember: hideMember,
    onManageHidden: () => {
      setSettingsFocus('hidden-members')
      goSettings('accounts')
    },
    initialQuery: friendsQuery.text,
    initialFriendId: friendsQuery.id,
    onOpenGame: openSheet
  }
  const friendsInGame = countInGame(friends.friends, games)

  return (
    <div className="shell">
      <TopBar
        query={query}
        onQueryChange={setQuery}
        searchRef={searchRef}
        search={{ items: searchItems, onPick: searchPick }}
        onLibraryView={view === 'library'}
        view={view}
        onView={go}
        friendsInGame={friendsInGame}
        accounts={accounts}
        me={me}
        accountMenuOpen={accountMenu}
        onToggleAccountMenu={() => setAccountMenu((o) => !o)}
      />
      <Ambient />
      <TopSlot.Provider value={tabSlot}>
        <main className={`content view-${view}`} key={view}>
          {/* Réglages propres à la page (choix du jeu de Stats…), posés par les pages (TopSlot) en haut du contenu. */}
          <div ref={setTabSlot} className="page-bar" />
          {view === 'home' && (
            <Home
              games={shownGames}
              friends={friends.friends}
              channels={friends.discordChannels}
              scanning={scanning}
              report={report}
              demo={settings.demoMode}
              onLaunch={startLaunch}
              onOpen={openSheet}
              onFavorite={toggleFavorite}
              onRescan={() => loadGames(true)}
              onShowLibrary={() => go('library')}
              onShowFriends={showFriends}
            />
          )}
          {view === 'library' && (
            <Library
              games={shownGames}
              notInstalled={notInstalled}
              onInstall={install}
              scanning={scanning}
              report={report}
              demo={settings.demoMode}
              query={query}
              onClearQuery={() => setQuery('')}
              onLaunch={startLaunch}
              onOpen={openSheet}
              onFavorite={toggleFavorite}
              onRescan={() => loadGames(true)}
              coverSize={ui.coverSize}
              onCoverSize={(coverSize) => updateUi({ coverSize })}
            />
          )}
          {view === 'friends' && <FriendsPage key={friendsQuery.n} {...friendsProps} />}
          {view === 'profile' && (
            <Profile
              games={shownGames}
              accounts={accounts}
              me={me}
              onSaveProfile={async (patch) => void (await saveSettings(patch))}
              friends={friends}
              onOpenGame={openSheet}
              onLaunch={startLaunch}
              onManageAccounts={() => goSettings('accounts')}
              onShowFriends={showFriends}
            />
          )}
          {view === 'stats' && <Stats games={games} onOpenSettings={goSettings} />}
          {view === 'settings' && (
            <SettingsView
              section={section}
              games={games}
              onSection={setSection}
              settings={settings}
              accounts={accounts}
              friends={friends}
              report={report}
              scanning={scanning}
              lastScanAt={lastScanAt}
              gamesCount={games.length}
              ui={ui}
              onUiChange={updateUi}
              onSaveSettings={saveSettings}
              onLogin={login}
              onLogout={logout}
              onRescan={() => loadGames(true)}
              onOpenSetup={() => setSetup({ open: true, first: false })}
              onReplaySetup={() => setSetup({ open: true, first: true, replay: true })}
              steamLibrary={steamLib}
              onRefreshSteamLibrary={() => loadSteamLib(true)}
              loginPending={loginPending}
              onShowMember={showMember}
              focus={settingsFocus}
              onFocused={() => setSettingsFocus(null)}
            />
          )}
        </main>
      </TopSlot.Provider>
      <AccountMenu
        open={accountMenu}
        accounts={accounts}
        me={me}
        onClose={() => setAccountMenu(false)}
        onProfile={() => go('profile')}
        onAccounts={() => goSettings('accounts')}
        onSettings={() => goSettings('accounts')}
        onLogin={() => {
          setAccountMenu(false)
          login('steam')
        }}
      />
      <GameSheet
        game={openGame}
        friends={friends.friends}
        onClose={closeSheet}
        onLaunch={startLaunch}
        onRescan={() => loadGames(true)}
        onFavorite={toggleFavorite}
        onOpenFolder={openFolder}
        onInstall={install}
        onOpenStats={() => {
          setOpenGameId(null)
          go('stats')
        }}
        news={settings.gameNews}
        from={view}
      />
      <FriendAlerts games={games} onShowFriends={showFriends} />
      <RecapHost
        games={games}
        onOpenStats={() => {
          setOpenGameId(null)
          go('stats')
        }}
      />
      <Cs2RecapHost games={games} />
      <UpdateNotice onOpenAbout={() => goSettings('about')} inGame={anyRunning} launching={pending.real && !anyRunning} />
      <LaunchDock onRescan={() => loadGames(true)} />
      <WhatsNew />
    </div>
  )
}
