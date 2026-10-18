import { useCallback, useEffect, useState } from 'react'
import type { Account, FriendsResult, Game, ScanReport, Settings } from '@shared/types'
import { FriendsPanel } from './components/FriendsPanel'
import { Library } from './components/Library'
import { Login } from './components/Login'
import { SettingsView } from './components/SettingsView'
import { Sidebar, type View } from './components/Sidebar'

const api = window.launcher

export default function App(): React.JSX.Element {
  const [ready, setReady] = useState(false)
  const [entered, setEntered] = useState(false)
  const [view, setView] = useState<View>('library')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanReport, setScanReport] = useState<ScanReport[]>([])
  const [friends, setFriends] = useState<FriendsResult>({ friends: [], errors: {} })
  const [toast, setToast] = useState<string | null>(null)

  const notify = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500)
  }, [])

  const loadGames = useCallback(async (refresh = false) => {
    setScanning(true)
    try {
      setGames(await api.getGames(refresh))
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e))
    } finally {
      setScanReport(await api.getScanReport())
      setScanning(false)
    }
  }, [notify])

  const loadFriends = useCallback(async () => setFriends(await api.getFriends()), [])

  useEffect(() => {
    Promise.all([api.getSettings(), api.getAccounts()]).then(([s, a]) => {
      setSettings(s)
      setAccounts(a)
      setEntered(a.length > 0 || s.demoMode)
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!entered) return
    loadGames()
    loadFriends()
    const timer = setInterval(loadFriends, 60_000)
    return () => clearInterval(timer)
  }, [entered, accounts, settings?.demoMode, settings?.discordGuildId, loadGames, loadFriends])

  const login = async (platform: 'steam' | 'discord' | 'psn'): Promise<void> => {
    try {
      notify(platform === 'psn' ? 'Connexion PlayStation…' : 'Termine la connexion dans ton navigateur…')
      const account = platform === 'psn' ? await api.connectPsn() : await api.login(platform)
      setAccounts(await api.getAccounts())
      setEntered(true)
      notify(`Connecté en tant que ${account.name}`)
    } catch (e) {
      notify(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))
    }
  }

  const saveSettings = async (patch: Partial<Settings>): Promise<void> => {
    setSettings(await api.saveSettings(patch))
    notify('Paramètres enregistrés')
  }

  const launch = async (game: Game): Promise<void> => {
    try {
      await api.launchGame(game.id)
    } catch (e) {
      notify(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))
      return
    }
    notify(settings?.demoMode ? `Mode démo : ${game.name} serait lancé` : `Lancement de ${game.name}…`)
    setGames(await api.getGames())
  }

  if (!ready || !settings) return <div className="boot" />

  if (!entered) {
    return (
      <>
        <Login
          discordReady={!!settings.discordClientId && !!settings.discordClientSecret}
          onLogin={login}
          onSkip={() => setEntered(true)}
          onDemo={async () => {
            await saveSettings({ demoMode: true })
            setEntered(true)
          }}
        />
        {toast && <div className="toast">{toast}</div>}
      </>
    )
  }

  return (
    <div className="shell">
      <Sidebar view={view} onView={setView} accounts={accounts} demo={settings.demoMode} />
      <main className="content">
        {view === 'library' && (
          <Library
            games={games}
            scanning={scanning}
            report={scanReport}
            onLaunch={launch}
            onRefresh={() => loadGames(true)}
            onFavorite={async (g) => setGames(await api.toggleFavorite(g.id))}
          />
        )}
        {view === 'settings' && (
          <SettingsView
            settings={settings}
            accounts={accounts}
            onSave={saveSettings}
            onLogin={login}
            onLogout={async (p) => setAccounts(await api.logout(p))}
          />
        )}
      </main>
      <FriendsPanel result={friends} accounts={accounts} demo={settings.demoMode} onRefresh={loadFriends} onOpenSettings={() => setView('settings')} />
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
