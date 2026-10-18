import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Account, FriendPlatform, FriendsResult, Game, ScanReport, Settings } from '@shared/types'
import { AccountMenu } from './components/AccountMenu'
import { FriendsPanel } from './components/friends/FriendsPanel'
import { GameSheet } from './components/GameSheet'
import { Library } from './components/library/Library'
import { Login } from './components/Login'
import { Profile } from './components/Profile'
import { Rail } from './components/Rail'
import { SettingsView } from './components/settings/SettingsView'
import { TopBar } from './components/TopBar'
import { errorMessage, ToastProvider, useToast } from './components/ui/Toasts'
import { COVER_MIN, type LoginPlatform, type SettingsSection, type UiPrefs, type View } from './contracts'
import './styles/shell.css'

const api = window.launcher

const DEFAULT_UI: UiPrefs = { friendsPanel: 'open', coverSize: 'M', reduceMotion: false, transparency: true }

function loadUi(): UiPrefs {
  try {
    return { ...DEFAULT_UI, ...JSON.parse(localStorage.getItem('pg.ui') ?? '{}') }
  } catch {
    return DEFAULT_UI
  }
}

export default function App(): React.JSX.Element {
  const [ui, setUi] = useState<UiPrefs>(loadUi)
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
  }, [ui])

  return (
    <ToastProvider right={ui.friendsPanel === 'open' ? 'var(--friends-w)' : '0px'}>
      <Shell ui={ui} updateUi={updateUi} />
    </ToastProvider>
  )
}

function Shell({ ui, updateUi }: { ui: UiPrefs; updateUi: (p: Partial<UiPrefs>) => void }): React.JSX.Element {
  const notify = useToast()
  const [ready, setReady] = useState(false)
  const [entered, setEntered] = useState(false)
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

  const loadGames = useCallback(
    async (refresh = false) => {
      setScanning(true)
      try {
        const list = await api.getGames(refresh)
        setGames(list)
        if (refresh) notify(`Bibliothèque à jour · ${list.length} jeu${list.length > 1 ? 'x' : ''}`, { kind: 'success', id: 'scan' })
      } catch (e) {
        notify(errorMessage(e), { kind: 'error' })
      } finally {
        setScanning(false)
        setLastScanAt(Date.now())
        setReport(await api.getScanReport())
      }
    },
    [notify]
  )

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true)
    try {
      setFriends(await api.getFriends())
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
  }, [loadGames])

  useEffect(() => {
    if (!entered) return
    loadFriends()
    const timer = setInterval(loadFriends, 60_000)
    return () => clearInterval(timer)
  }, [entered, accounts, settings?.demoMode, settings?.discordGuildId, settings?.steamApiKey, settings?.psnNpsso, loadFriends])

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
    if ('demoMode' in patch) setGames(await api.getGames())
  }, [])

  const login = useCallback(
    async (platform: LoginPlatform) => {
      setLoginError(null)
      setLoginPending(platform)
      notify(platform === 'psn' ? 'Connexion à PlayStation…' : 'Termine la connexion dans ton navigateur…', { kind: 'loading', id: 'login' })
      try {
        const account = platform === 'psn' ? await api.connectPsn() : await api.login(platform)
        setAccounts(await api.getAccounts())
        setEntered(true)
        notify(`Connecté en tant que ${account.name}`, { kind: 'success', id: 'login', avatarUrl: account.avatarUrl })
      } catch (e) {
        const msg = errorMessage(e)
        setLoginError(msg === 'Connexion annulée.' ? null : msg)
        notify(msg, { kind: msg === 'Connexion annulée.' ? 'info' : 'error', id: 'login' })
      } finally {
        setLoginPending(null)
      }
    },
    [notify]
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
      setLaunchingId(game.id)
      try {
        await api.launchGame(game.id)
        notify(settings?.demoMode ? `Mode démo : ${game.name} serait lancé` : `Lancement de ${game.name}…`, { kind: 'info' })
        setGames(await api.getGames())
      } catch (e) {
        notify(`Impossible de lancer ${game.name} : ${errorMessage(e)}`, { kind: 'error' })
      } finally {
        setTimeout(() => setLaunchingId((id) => (id === game.id ? null : id)), 1500)
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
  }, [saveSettings])

  const goSettings = (s: SettingsSection): void => {
    setSection(s)
    setView('settings')
    setAccountMenu(false)
  }

  const openGame = useMemo(() => games.find((g) => g.id === openGameId) ?? null, [games, openGameId])

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
            onOpen={(g) => setOpenGameId(g.id)}
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
            onOpenGame={(g) => setOpenGameId(g.id)}
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
        onClose={() => setOpenGameId(null)}
        onLaunch={launch}
        onFavorite={toggleFavorite}
        onOpenFolder={openFolder}
      />
    </div>
  )
}
