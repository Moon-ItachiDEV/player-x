// Paramètres : un sous-menu à gauche (une section à la fois), les réglages en cartes à droite.
// Pas de bouton « Enregistrer » global : chaque réglage s'applique seul.
import { useCallback, useEffect, useRef, useState } from 'react'
import { timeAgo } from '@shared/text'
import type { FriendAlertMode, FriendPlatform, Game, ScanReport, Settings, SteamLibrary, SteamLibraryState } from '@shared/types'
import { COVER_MIN, type SettingsProps, type SettingsSection, type UiPrefs } from '../../contracts'
import { useSystemReducedMotion, useSystemReducedTransparency } from '../../motion'
import { TopTitle } from '../TopTabs'
import { Icon } from '../ui/Icon'
import { Segmented, Switch } from '../ui/Overlay'
import { STORE_LONG, StoreTag } from '../ui/StoreTag'
import { errorMessage, useToast } from '../ui/Toasts'
import { AboutSection } from './AboutSection'
import { AccountsSection, connState, PLATFORMS } from './AccountsSection'
import { AdvancedSection } from './AdvancedSection'
import { openRecap, sampleRecap } from '../stats/Recap'
import { openCs2Recap, sampleCs2Recap } from '../cs2/useCs2'
import { BackgroundRows } from './BackgroundRows'
import { OverlaySection } from './OverlaySection'
import { Collapse, SectionHead, SettingRow, SettingsCard, storeCaption, useNow } from './parts'
import './settings.css'
import { ShelvesCard } from '../../shelves/ShelvesCard'

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'accounts', label: 'Comptes' },
  { id: 'library', label: 'Bibliothèque' },
  { id: 'interface', label: 'Interface' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'advanced', label: 'Avancé' },
  { id: 'about', label: 'À propos' }
]

export function SettingsView(props: SettingsProps): React.JSX.Element {
  const { section, onSection, settings, accounts, friends } = props
  const rootRef = useRef<HTMLDivElement>(null)
  const [focusCard, setFocusCard] = useState<FriendPlatform | null>(null)
  const focusRef = useRef(focusCard || props.focus)
  focusRef.current = focusCard || props.focus

  // Nouvelle section : on remonte en haut (sauf si une carte d'Avancé ou un bloc de Comptes doit être montré).
  useEffect(() => {
    if (!focusRef.current) rootRef.current?.closest('.content')?.scrollTo({ top: 0 })
  }, [section])

  const configure = (p: FriendPlatform): void => {
    setFocusCard(p)
    onSection('advanced')
  }
  const clearFocus = useCallback(() => setFocusCard(null), [])

  const attention = PLATFORMS.filter((p) => {
    const tone = connState(
      p,
      accounts.find((a) => a.platform === p),
      settings,
      friends.errors
    ).tone
    return tone === 'danger' || (tone === 'warning' && accounts.some((a) => a.platform === p))
  }).length

  return (
    <div className="set-page" ref={rootRef}>
      <h1 className="sr-only">Paramètres</h1>
      <TopTitle>Paramètres</TopTitle>
      <div className="set-layout">
        <SettingsNav value={section} onChange={onSection} alert={attention > 0 ? 'accounts' : null} />
        <div className="set-main" id="set-panel" role="tabpanel" aria-labelledby={`set-tab-${section}`}>
          {section === 'accounts' && (
            <AccountsSection
              settings={settings}
              accounts={accounts}
              friends={friends}
              loginPending={props.loginPending}
              onLogin={props.onLogin}
              onLogout={props.onLogout}
              onConfigure={configure}
              onShowMember={props.onShowMember}
              focus={props.focus}
              onFocused={props.onFocused}
              report={props.report}
              scanning={props.scanning}
              onRescan={props.onRescan}
            />
          )}
          {section === 'library' && (
            <LibrarySection
              report={props.report}
              scanning={props.scanning}
              lastScanAt={props.lastScanAt}
              gamesCount={props.gamesCount}
              demo={settings.demoMode}
              onRescan={props.onRescan}
              onOpenSetup={props.onOpenSetup}
              onReplaySetup={props.onReplaySetup}
              settings={settings}
              onSaveSettings={props.onSaveSettings}
              steamLibrary={props.steamLibrary}
              onRefreshSteamLibrary={props.onRefreshSteamLibrary}
              onConnectSteam={() => props.onLogin('steam')}
              onConfigureSteam={() => configure('steam')}
              allGames={props.steamLibrary ? [...props.games, ...props.steamLibrary.notInstalled] : props.games}
            />
          )}
          {section === 'interface' && (
            <InterfaceSection ui={props.ui} onUiChange={props.onUiChange} settings={settings} onSaveSettings={props.onSaveSettings} />
          )}
          {section === 'overlay' && <OverlaySection settings={settings} onSaveSettings={props.onSaveSettings} games={props.games} />}
          {section === 'advanced' && (
            <AdvancedSection settings={settings} report={props.report} onSaveSettings={props.onSaveSettings} focusCard={focusCard} onFocused={clearFocus} />
          )}
          {section === 'about' && <AboutSection settings={settings} onSaveSettings={props.onSaveSettings} />}
        </div>
      </div>
    </div>
  )
}

/** Sous-menu des sections : onglets verticaux. Flèches, Début/Fin : section voisine (activation directe). */
function SettingsNav({ value, onChange, alert }: { value: SettingsSection; onChange: (s: SettingsSection) => void; alert: SettingsSection | null }): React.JSX.Element {
  const list = useRef<HTMLDivElement>(null)

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const i = SECTIONS.findIndex((t) => t.id === value)
    const last = SECTIONS.length - 1
    const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft'
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? last : back ? (i <= 0 ? last : i - 1) : i === last ? 0 : i + 1
    onChange(SECTIONS[next].id)
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div ref={list} className="set-nav" role="tablist" aria-label="Sections des paramètres" aria-orientation="vertical" onKeyDown={onKeyDown}>
      {SECTIONS.map((t) => {
        const on = t.id === value
        return (
            <button
              key={t.id}
              id={`set-tab-${t.id}`}
              className="set-nav-item"
              role="tab"
              aria-selected={on}
              aria-controls="set-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(t.id)}
            >
              {t.label}
              {alert === t.id && (
                <span className="set-nav-alert" title="Action requise">
                  <Icon name="alert-circle" size={15} />
                  <span className="sr-only">· action requise</span>
                </span>
              )}
            </button>
        )
      })}
    </div>
  )
}

// ---------- Bibliothèque ----------

interface LibraryProps {
  report: ScanReport[]
  scanning: boolean
  lastScanAt: number | null
  gamesCount: number
  demo: boolean
  onRescan: () => void
  onOpenSetup: () => void
  onReplaySetup: () => void
  settings: Settings
  onSaveSettings: (patch: Partial<Settings>) => Promise<Settings>
  steamLibrary: SteamLibrary | null
  onRefreshSteamLibrary: () => Promise<void>
  onConnectSteam: () => void
  onConfigureSteam: () => void
  /** Bibliothèque et jeux Steam pas installés : noms des jeux masqués. */
  allGames: Game[]
}

function LibrarySection(props: LibraryProps): React.JSX.Element {
  const { report, scanning, lastScanAt, gamesCount, demo, onRescan, onOpenSetup, settings, onSaveSettings } = props
  const now = useNow()
  const notify = useToast()
  return (
    <>
      <SectionHead title="Bibliothèque" />
      {demo && (
        <div className="set-banner">
          <Icon name="info" size={16} />
          <p>Le mode démo est actif : ta bibliothèque affiche des jeux fictifs. Le rapport ci-dessous reste celui de ce PC.</p>
        </div>
      )}
      <SettingsCard
        title="Jeux détectés sur ce PC"
        meta={
          <>
            <span className="num">{gamesCount}</span> jeu{gamesCount > 1 ? 'x' : ''} dans ta bibliothèque
          </>
        }
      >
        <div className="set-stores" aria-busy={scanning && !report.length}>
          {report.length ? (
            report.map((r) => <StoreRow key={r.store} report={r} />)
          ) : scanning ? (
            [0, 1, 2].map((i) => (
              <div className="set-store" key={i}>
                <div className="set-store-main">
                  <span className="skel set-skel-tag" />
                  <span className="skel set-skel-line" />
                </div>
              </div>
            ))
          ) : (
            <p className="set-store-empty">Aucun rapport de scan pour le moment. Relance un scan pour voir ce qui est détecté.</p>
          )}
        </div>
        <div className="set-scan">
          <span className="caption">{lastScanAt ? `Dernier scan : ${timeAgo(lastScanAt, Math.max(now, lastScanAt))}` : 'Aucun scan pour le moment'}</span>
          <button className="btn btn-secondary" onClick={onRescan} disabled={scanning}>
            {scanning ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
            {scanning ? 'Scan en cours…' : 'Relancer le scan'}
          </button>
        </div>
      </SettingsCard>
      <SettingsCard title="Jeux et actus">
        <SettingRow label="Jeux favoris">
          <button className="btn btn-secondary" onClick={onOpenSetup} disabled={gamesCount === 0} data-open-setup>
            <Icon name="star" size={16} />
            Choisir mes jeux favoris
          </button>
        </SettingRow>
        <SettingRow label="Accueil de Player X">
          <button className="btn btn-secondary" onClick={props.onReplaySetup}>
            Revoir l'accueil de Player X
          </button>
        </SettingRow>
        <SettingRow label="Actus des jeux">
          <Switch
            checked={settings.gameNews}
            onChange={(gameNews) => onSaveSettings({ gameNews }).catch((e) => notify(errorMessage(e), { kind: 'error' }))}
            label="Actus des jeux"
          />
        </SettingRow>
        <SteamLibraryRow
          lib={props.steamLibrary}
          demo={demo}
          onRefresh={props.onRefreshSteamLibrary}
          onConnect={props.onConnectSteam}
          onConfigure={props.onConfigureSteam}
        />
      </SettingsCard>
      <ShelvesCard games={props.allGames} />
    </>
  )
}

const STEAM_LIB_TEXT: Record<Exclude<SteamLibraryState, 'ready'>, string> = {
  loading: 'Lecture de ta liste de jeux Steam…',
  'no-account': "Connecte ton compte Steam pour voir aussi les jeux que tu n'as pas installés sur ce PC",
  'no-key': "Ajoute ta clé Steam Web API (onglet Avancé) pour voir aussi les jeux que tu n'as pas installés sur ce PC",
  'key-refused': "Steam refuse ta clé Web API : vérifie-la dans l'onglet Avancé",
  private: 'Ta liste de jeux est privée sur Steam : dans ton profil Steam, Modifier le profil › Paramètres de confidentialité, mets « Détails des jeux » sur Public',
  offline: 'Steam ne répond pas pour le moment'
}

/** « Jeux Steam non installés » : combien il y en a, ou ce qu'il manque pour les voir (compte, clé, profil public). */
function SteamLibraryRow(props: {
  lib: SteamLibrary | null
  demo: boolean
  onRefresh: () => Promise<void>
  onConnect: () => void
  onConfigure: () => void
}): React.JSX.Element {
  const { lib, demo, onRefresh, onConnect, onConfigure } = props
  const [busy, setBusy] = useState(false)
  const state = lib?.state ?? 'loading'
  const n = lib?.notInstalled.length ?? 0

  const refresh = (): void => {
    setBusy(true)
    onRefresh().finally(() => setBusy(false))
  }

  const value = demo
    ? `Mode démo : ${n} jeux Steam fictifs dans l'onglet « Non installés » de la bibliothèque`
    : state !== 'ready'
      ? STEAM_LIB_TEXT[state]
      : n
        ? `${n} des ${lib?.owned ?? n} jeux de ton compte Steam ${n > 1 ? 'ne sont' : "n'est"} pas sur ce PC`
        : 'Tous tes jeux Steam sont installés'

  let action: React.ReactNode = null
  if (demo || state === 'loading') action = null
  else if (state === 'no-account')
    action = (
      <button className="btn btn-secondary" onClick={onConnect}>
        Connecter Steam
      </button>
    )
  else if (state === 'no-key' || state === 'key-refused')
    action = (
      <button className="btn btn-secondary" onClick={onConfigure}>
        {state === 'no-key' ? 'Ajouter la clé' : 'Vérifier la clé'}
      </button>
    )
  else
    action = (
      <button className="btn btn-secondary" onClick={refresh} disabled={busy}>
        {busy ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
        {state === 'ready' ? 'Actualiser' : 'Réessayer'}
      </button>
    )

  return (
    <SettingRow label="Jeux Steam non installés" value={value}>
      {action}
    </SettingRow>
  )
}

function StoreRow({ report: r }: { report: ScanReport }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const id = `set-checked-${r.store}`
  return (
    <div className="set-store">
      <div className="set-store-main">
        <StoreTag kind={r.store} size={32} />
        <div className="set-store-text">
          <div className="set-store-name">{STORE_LONG[r.store]}</div>
          <div className={`caption ${r.error ? 'set-store-err' : ''}`}>
            {r.error && <Icon name="alert-circle" size={13} />}
            {r.error ? `Erreur : ${r.error}` : storeCaption(r)}
          </div>
        </div>
        {r.checked.length > 0 && (
          <button className="btn btn-ghost btn-sm set-details" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
            Détails
            <Icon name="chevron-down" size={14} className="set-chev" />
          </button>
        )}
      </div>
      {r.checked.length > 0 && (
        <Collapse open={open} id={id}>
          <ul className="set-checked" aria-label={`Emplacements examinés pour ${STORE_LONG[r.store]}`}>
            {r.checked.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Collapse>
      )}
    </div>
  )
}

// ---------- Interface ----------

const SIZE_LABEL: Record<UiPrefs['coverSize'], string> = { S: 'Petite', M: 'Moyenne', L: 'Grande' }


const IS_WINDOWS = window.launcher?.platform === 'win32'


interface InterfaceProps {
  ui: UiPrefs
  onUiChange: (patch: Partial<UiPrefs>) => void
  settings: Settings
  onSaveSettings: (patch: Partial<Settings>) => Promise<Settings>
}

function InterfaceSection({ ui, onUiChange, settings, onSaveSettings }: InterfaceProps): React.JSX.Element {
  const systemReduced = useSystemReducedMotion()
  const systemOpaque = useSystemReducedTransparency()
  const notify = useToast()
  return (
    <>
      <SectionHead title="Interface" />
      <SettingsCard title="Affichage">
        <SettingRow label="Taille des jaquettes">
          <Segmented
            className="set-seg"
            label="Taille des jaquettes"
            value={ui.coverSize}
            options={(['S', 'M', 'L'] as const).map((v) => ({ value: v, label: SIZE_LABEL[v] }))}
            onChange={(coverSize) => onUiChange({ coverSize })}
          />
        </SettingRow>
        <SettingRow
          label="Réduire les animations"
          value={!ui.reduceMotion && systemReduced ? 'Déjà réduites par Windows' : undefined}
        >
          <Switch checked={ui.reduceMotion} onChange={(reduceMotion) => onUiChange({ reduceMotion })} label="Réduire les animations" />
        </SettingRow>
        <SettingRow
          label="Effets visuels"
          value={ui.visualFx && (ui.reduceMotion || systemReduced) ? 'En pause : animations réduites' : undefined}
        >
          <Switch checked={ui.visualFx} onChange={(visualFx) => onUiChange({ visualFx })} label="Effets visuels" />
        </SettingRow>
        <SettingRow
          label="Effets de transparence"
          value={ui.transparency && systemOpaque ? 'En pause : réglage de Windows' : undefined}
        >
          <Switch checked={ui.transparency} onChange={(transparency) => onUiChange({ transparency })} label="Effets de transparence" />
        </SettingRow>
      </SettingsCard>
      <SettingsCard title="Fenêtre">
        <SettingRow label="Quand un jeu démarre" value={IS_WINDOWS ? undefined : 'Disponible sur Windows'}>
          <Segmented
            className="set-seg"
            label="Quand un jeu démarre"
            value={settings.launchWindow}
            disabled={!IS_WINDOWS}
            options={[
              { value: 'stay', label: 'Rester ouvert' },
              { value: 'minimize', label: 'Se réduire' }
            ]}
            onChange={(launchWindow) => onSaveSettings({ launchWindow }).catch((e) => notify(errorMessage(e), { kind: 'error' }))}
          />
        </SettingRow>
        <BackgroundRows settings={settings} onSaveSettings={onSaveSettings} />
      </SettingsCard>
      <SettingsCard title="Notifications">
        <SettingRow label="Alertes d'amis">
          <div className="set-inline">
            <Segmented
              className="set-seg"
              label="Alertes d'amis"
              value={settings.friendAlerts}
              options={[
                { value: 'all', label: 'Tout' },
                { value: 'games', label: 'Jeux' },
                { value: 'off', label: 'Aucune' }
              ]}
              onChange={(friendAlerts) => onSaveSettings({ friendAlerts }).catch((e) => notify(errorMessage(e), { kind: 'error' }))}
            />
            <button
              className="btn btn-secondary btn-sm"
              disabled={settings.friendAlerts === 'off'}
              onClick={() => window.launcher.testFriendAlert().catch((e) => notify(errorMessage(e), { kind: 'error' }))}
            >
              Tester
            </button>
          </div>
        </SettingRow>
        <SettingRow label="Jeu prêt après une mise à jour Steam">
          <Switch
            checked={settings.gameReadyAlert}
            onChange={(gameReadyAlert) => onSaveSettings({ gameReadyAlert }).catch((e) => notify(errorMessage(e), { kind: 'error' }))}
            label="Jeu prêt après une mise à jour Steam"
          />
        </SettingRow>
      </SettingsCard>
      <SettingsCard title="Bilans de match">
        <SettingRow label="Bilan Battlefield 6">
          <div className="set-inline">
            <Switch
              checked={settings.bf6Recap}
              onChange={(bf6Recap) => onSaveSettings({ bf6Recap }).catch((e) => notify(errorMessage(e), { kind: 'error' }))}
              label="Bilan Battlefield 6"
            />
            <button className="btn btn-secondary btn-sm" onClick={() => openRecap(sampleRecap())}>
              Voir un exemple
            </button>
          </div>
        </SettingRow>
        <SettingRow label="Match Counter-Strike 2">
          <div className="set-inline">
            <Switch
              checked={settings.cs2Live}
              onChange={(cs2Live) => onSaveSettings({ cs2Live }).catch((e) => notify(errorMessage(e), { kind: 'error' }))}
              label="Match Counter-Strike 2"
            />
            <button className="btn btn-secondary btn-sm" onClick={() => openCs2Recap(sampleCs2Recap())}>
              Voir un exemple
            </button>
          </div>
        </SettingRow>
        {settings.cs2Live && (
          <SettingRow label="Ouvrir le bilan à la fermeture de CS2">
            <Switch
              checked={settings.cs2RecapOpen}
              onChange={(cs2RecapOpen) => onSaveSettings({ cs2RecapOpen }).catch((e) => notify(errorMessage(e), { kind: 'error' }))}
              label="Ouvrir le bilan à la fermeture de CS2"
            />
          </SettingRow>
        )}
      </SettingsCard>
    </>
  )
}
