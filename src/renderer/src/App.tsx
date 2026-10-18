import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Account, FriendPlatform, FriendsResult, Game, ScanReport, Settings } from '@shared/types'
import { AccountMenu } from './components/AccountMenu'
import { Ambient } from './components/Ambient'
import { FriendsPanel } from './components/friends/FriendsPanel'
import { GameSheet } from './components/GameSheet'
import { Library } from './components/library/Library'
import { Login } from './components/Login'
import { Profile } from './components/Profile'
import { Rail } from './components/Rail'
import { SettingsView } from './components/settings/SettingsView'
import { Setup } from './components/setup/Setup'
import { TopBar } from './components/TopBar'
import { UpdateNotice } from './components/UpdateNotice'
import { errorMessage, ToastProvider, useToast } from './components/ui/Toasts'
import { COVER_MIN, type LoginPlatform, type SettingsSection, type UiPrefs, type View } from './contracts'
import { closeTarget, takeMorphSource, useSystemReducedMotion, useWindowActivity, withViewTransition } from './motion'
import './styles/shell.css'
import './styles/transitions.css'

const api = window.launcher

const DEFAULT_UI: UiPrefs = { friendsPanel: 'open', coverSize: 'M', reduceMotion: false, transparency: true, visualFx: true }

const SETUP_KEY = 'pg.setup'

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
  // Remonté ici : les toasts ne laissent la place du panneau d'amis que quand la coque est affichée.
  const [entered, setEntered] = useState(false)
  // Écran de démarrage (choix des favoris) : une fois après l'entrée, puis à la demande. `first` = premier passage.
  const [setup, setSetup] = useState<{ open: boolean; first: boolean }>(() => ({ open: !setupDone(), first: !setupDone() }))
  const systemReduced = useSystemReducedMotion()
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
    root.classList.toggle('no-blur', !ui.transparency)
    root.style.setProperty('--cover-min', `${COVER_MIN[ui.coverSize]}px`)
    // Seul interrupteur des effets riches (CSS :root[data-fx='on'], JS fxOn()).
    root.dataset.fx = ui.visualFx && !ui.reduceMotion && !systemReduced ? 'on' : 'off'
  }, [ui, systemReduced])

  return (
    <ToastProvider right={entered && !setup.open && ui.friendsPanel === 'open' ? 'var(--friends-w)' : '0px'}>
      <Shell ui={ui} updateUi={updateUi} entered={entered} setEntered={setEntered} setup={setup} setSetup={setSetup} />
    </ToastProvider>
  )
}

interface ShellProps {
  ui: UiPrefs
  updateUi: (p: Partial<UiPrefs>) => void
  entered: boolean
  setEntered: (v: boolean) => void
  setup: { open: boolean; first: boolean }
  setSetup: (v: { open: boolean; first: boolean }) => void
}

function Shell({ ui, updateUi, entered, setEntered, setup, setSetup }: ShellProps): React.JSX.Element {
  const notify = useToast()
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>('library')
  const [section, setSection] = useState<SettingsSection>('accounts')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [scanning, setScanning] = useState(false)
  const [report, setReport] = useState<ScanReport[]>([])
  const [lastScanAt, setLastScanAt] = useState<number | null>(null)
  const [friends, setFriends] = useState<FriendsResult>({ friends: [], errors: {} })
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [openGameId, setOpenGameId] = useState<string | null>(null)
  const [launchingId, setLaunchingId] = useState<string | null>(null)
  const [accountMenu, setAccountMenu] = useState(false)
  const [loginPending, setLoginPending] = useState<LoginPlatform | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // Seule la dernière connexion lancée met à jour l'état et le toast « login ».
  const loginSeq = useRef(0)
  // Jeu en cours de lancement, lu sans attendre le rendu (double clic).
  const launchingRef = useRef<string | null>(null)
  // Change à chaque bascule du mode démo : un scan lancé avant ne doit pas remplacer la nouvelle bibliothèque.
  const libraryEpoch = useRef(0)

  const loadGames = useCallback(
    async (refresh = false) => {
      const epoch = libraryEpoch.current
      setScanning(true)
      try {
        const list = await api.getGames(refresh)
        if (epoch !== libraryEpoch.current) return
        setGames(list)
        if (refresh) notify(`Bibliothèque à jour · ${list.length} jeu${list.length > 1 ? 'x' : ''}`, { kind: 'success', id: 'scan' })
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
    [notify]
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
    return api.onGamesChanged(() => api.getGames().then(setGames))
  }, [loadGames, setEntered])

  // Les comptes comptent par identité : un pseudo ou un avatar mis à jour ne relance pas toute la récupération.
  const accountsKey = accounts.map((a) => `${a.platform}:${a.id}`).join('|')
  useEffect(() => {
    if (!entered) return
    loadFriends()
    const timer = setInterval(loadFriends, 60_000)
    return () => clearInterval(timer)
  }, [entered, accountsKey, settings?.demoMode, settings?.discordGuildId, settings?.steamApiKey, settings?.psnNpsso, loadFriends])

  // Ctrl+F / Ctrl+K : recherche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'k')) {
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
      notify(`${platform === 'psn' ? 'PlayStation' : platform === 'steam' ? 'Steam' : 'Discord'} déconnecté`, { kind: 'success' })
    },
    [notify]
  )

  const launch = useCallback(
    async (game: Game) => {
      // Déjà en cours de lancement : on ignore le second clic.
      if (launchingRef.current === game.id) return
      launchingRef.current = game.id
      setLaunchingId(game.id)
      try {
        await api.launchGame(game.id)
        notify(settings?.demoMode ? `Mode démo : ${game.name} serait lancé` : `Lancement de ${game.name}…`, { kind: 'info' })
        setGames(await api.getGames())
      } catch (e) {
        notify(`Impossible de lancer ${game.name} : ${errorMessage(e)}`, { kind: 'error' })
      } finally {
        setTimeout(() => {
          if (launchingRef.current === game.id) launchingRef.current = null
          setLaunchingId((id) => (id === game.id ? null : id))
        }, 1500)
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

  const enableDemo = useCallback(async () => {
    await saveSettings({ demoMode: true })
    setEntered(true)
  }, [saveSettings, setEntered])

  /** Ferme l'écran de démarrage : vers la bibliothèque après un choix ou au premier passage, sinon on reste où on était (Paramètres). */
  const closeSetup = useCallback(
    (toLibrary: boolean) => {
      try {
        localStorage.setItem(SETUP_KEY, '1')
      } catch {
        /* stockage indisponible : l'écran reviendra au prochain lancement */
      }
      setSetup({ open: false, first: false })
      if (toLibrary) setView('library')
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

  const openGame = useMemo(() => games.find((g) => g.id === openGameId) ?? null, [games, openGameId])

  // Ouverture et fermeture de la fiche : la jaquette (ou le visuel) d'origine se transforme en en-tête.
  const openSheet = useCallback((g: Game) => {
    withViewTransition(() => setOpenGameId(g.id), { kind: 'open', source: takeMorphSource(g.id) })
  }, [])
  const closeSheet = useCallback(() => {
    withViewTransition(() => setOpenGameId(null), { kind: 'close', source: openGameId ? closeTarget(openGameId) : null })
  }, [openGameId])

  if (!ready || !settings) return <div className="boot" />

  if (!entered) {
    return (
      <Login
        games={games}
        pending={loginPending}
        error={loginError}
        onSteam={() => login('steam')}
        onCancel={() => api.cancelLogin()}
        onSkip={() => setEntered(true)}
        onDemo={enableDemo}
      />
    )
  }

  if (setup.open) {
    return (
      <Setup
        firstRun={setup.first}
        games={games}
        report={report}
        scanning={scanning}
        demo={settings.demoMode}
        onRescan={() => loadGames(true)}
        onEnableDemo={enableDemo}
        onDone={finishSetup}
        onSkip={() => closeSetup(setup.first)}
      />
    )
  }

  const friendsOpen = ui.friendsPanel === 'open'

  return (
    <div className={`shell ${friendsOpen ? '' : 'friends-hidden'}`}>
      <Rail
        view={view}
        onView={(v) => {
          setView(v)
          setAccountMenu(false)
        }}
        accounts={accounts}
        demo={settings.demoMode}
        accountMenuOpen={accountMenu}
        onToggleAccountMenu={() => setAccountMenu((o) => !o)}
      />
      <TopBar
        query={query}
        onQueryChange={(q) => {
          setQuery(q)
          if (q && view !== 'library') setView('library')
        }}
        searchRef={searchRef}
        friends={friends.friends}
        friendsOpen={friendsOpen}
        onToggleFriends={() => updateUi({ friendsPanel: friendsOpen ? 'hidden' : 'open' })}
      />
      <Ambient />
      <main className="content" key={view}>
        {view === 'library' && (
          <Library
            games={games}
            friends={friends.friends}
            scanning={scanning}
            report={report}
            demo={settings.demoMode}
            query={query}
            onClearQuery={() => setQuery('')}
            launchingId={launchingId}
            onLaunch={launch}
            onOpen={openSheet}
            onFavorite={toggleFavorite}
            onRescan={() => loadGames(true)}
            onEnableDemo={enableDemo}
          />
        )}
        {view === 'profile' && (
          <Profile
            games={games}
            accounts={accounts}
            friends={friends}
            launchingId={launchingId}
            onOpenGame={openSheet}
            onLaunch={launch}
            onManageAccounts={() => goSettings('accounts')}
            onShowFriends={() => updateUi({ friendsPanel: 'open' })}
          />
        )}
        {view === 'settings' && (
          <SettingsView
            section={section}
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
            loginPending={loginPending}
          />
        )}
      </main>
      {friendsOpen && (
        <FriendsPanel
          result={friends}
          accounts={accounts}
          games={games}
          demo={settings.demoMode}
          discordConfigured={!!settings.discordGuildId}
          loading={friendsLoading}
          onRefresh={loadFriends}
          onHide={() => updateUi({ friendsPanel: 'hidden' })}
          onOpenAccounts={() => goSettings('accounts')}
        />
      )}
      <AccountMenu
        open={accountMenu}
        accounts={accounts}
        onClose={() => setAccountMenu(false)}
        onProfile={() => {
          setView('profile')
          setAccountMenu(false)
        }}
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
        launching={!!openGame && launchingId === openGame.id}
        onClose={closeSheet}
        onLaunch={launch}
        onFavorite={toggleFavorite}
        onOpenFolder={openFolder}
      />
      <UpdateNotice onOpenAbout={() => goSettings('about')} />
    </div>
  )
}
