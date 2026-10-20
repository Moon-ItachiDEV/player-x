// Paramètres : une section par onglet (barre du haut). Pas de bouton « Enregistrer » global : chaque réglage s'applique seul.
import { useCallback, useEffect, useRef, useState } from 'react'
import { timeAgo } from '@shared/text'
import type { FriendAlertMode, FriendPlatform, ScanReport, Settings, SteamLibrary, SteamLibraryState } from '@shared/types'
import { COVER_MIN, type SettingsProps, type SettingsSection, type UiPrefs } from '../../contracts'
import { useSystemReducedMotion } from '../../motion'
import { TopTabs } from '../TopTabs'
import { Icon } from '../ui/Icon'
import { Segmented, Switch } from '../ui/Overlay'
import { STORE_LONG, StoreTag } from '../ui/StoreTag'
import { errorMessage, useToast } from '../ui/Toasts'
import { AboutSection } from './AboutSection'
import { AccountsSection, connState, PLATFORMS } from './AccountsSection'
import { AdvancedSection } from './AdvancedSection'
import { Collapse, SectionHead, SettingRow, storeCaption, useNow } from './parts'
import './settings.css'

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'accounts', label: 'Comptes' },
  { id: 'library', label: 'Bibliothèque' },
  { id: 'interface', label: 'Interface' },
  { id: 'advanced', label: 'Avancé' },
  { id: 'about', label: 'À propos' }
]

export function SettingsView(props: SettingsProps): React.JSX.Element {
  const { section, onSection, settings, accounts, friends } = props
  const rootRef = useRef<HTMLDivElement>(null)
  const [focusCard, setFocusCard] = useState<FriendPlatform | null>(null)
  const focusRef = useRef(focusCard)
  focusRef.current = focusCard

  // Nouvelle section : on remonte en haut (sauf si une carte d'Avancé doit être montrée).
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
      <TopTabs<SettingsSection>
        label="Sections des paramètres"
        idBase="set"
        value={section}
        onChange={onSection}
        tabs={SECTIONS.map((t) => (t.id === 'accounts' && attention > 0 ? { ...t, alert: 'action requise' } : t))}
      />
      <div className="set-layout">
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
              settings={settings}
              onSaveSettings={props.onSaveSettings}
              steamLibrary={props.steamLibrary}
              onRefreshSteamLibrary={props.onRefreshSteamLibrary}
              onConnectSteam={() => props.onLogin('steam')}
              onConfigureSteam={() => configure('steam')}
            />
          )}
          {section === 'interface' && (
            <InterfaceSection ui={props.ui} onUiChange={props.onUiChange} settings={settings} onSaveSettings={props.onSaveSettings} />
          )}
          {section === 'advanced' && (
            <AdvancedSection settings={settings} report={props.report} onSaveSettings={props.onSaveSettings} focusCard={focusCard} onFocused={clearFocus} />
          )}
          {section === 'about' && <AboutSection />}
        </div>
      </div>
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
  settings: Settings
  onSaveSettings: (patch: Partial<Settings>) => Promise<Settings>
  steamLibrary: SteamLibrary | null
  onRefreshSteamLibrary: () => Promise<void>
  onConnectSteam: () => void
  onConfigureSteam: () => void
}

function LibrarySection(props: LibraryProps): React.JSX.Element {
  const { report, scanning, lastScanAt, gamesCount, demo, onRescan, onOpenSetup, settings, onSaveSettings } = props
  const now = useNow()
  const notify = useToast()
  return (
    <>
      <SectionHead title="Bibliothèque">Les jeux sont détectés automatiquement sur ce PC.</SectionHead>
      {demo && (
        <div className="set-banner">
          <Icon name="info" size={16} />
          <p>Le mode démo est actif : ta bibliothèque affiche des jeux fictifs. Le rapport ci-dessous reste celui de ce PC.</p>
        </div>
      )}
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
        <button className="btn btn-secondary" onClick={onRescan} disabled={scanning}>
          {scanning ? <span className="spinner" /> : <Icon name="refresh" size={16} />}
          {scanning ? 'Scan en cours…' : 'Relancer le scan'}
        </button>
        <span className="caption">
          {lastScanAt ? `Dernier scan : ${timeAgo(lastScanAt, Math.max(now, lastScanAt))}` : 'Aucun scan pour le moment'}
          {' · '}
          <span className="num">{gamesCount}</span> jeu{gamesCount > 1 ? 'x' : ''} dans ta bibliothèque
        </span>
      </div>
      <SettingRow label="Jeux favoris" value="Mis en avant en tête de ta bibliothèque">
        <button className="btn btn-secondary" onClick={onOpenSetup} disabled={gamesCount === 0} data-open-setup>
          <Icon name="star" size={16} />
          Choisir mes jeux favoris
        </button>
      </SettingRow>
      <SettingRow
        label="Actus des jeux"
        value={
          settings.gameNews
            ? 'Activées · annonces officielles de Steam dans la fiche, badge « Nouveau patch » sur les jeux mis à jour cette semaine'
            : 'Désactivées · Player X ne demande plus les actus de tes jeux à Steam'
        }
      >
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
        ? `${n} des ${lib?.owned ?? n} jeux de ton compte Steam ${n > 1 ? 'ne sont' : "n'est"} pas sur ce PC · onglet « Non installés » de la bibliothèque`
        : 'Tous les jeux de ton compte Steam sont installés sur ce PC'

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

const ALERT_LABEL: Record<FriendAlertMode, string> = {
  all: 'Connexions et jeux lancés · amis Steam et PlayStation',
  games: 'Seulement quand un ami lance un jeu',
  off: 'Désactivées'
}

const IS_WINDOWS = window.launcher?.platform === 'win32'

/** Légende de « Quand un jeu démarre » (spec launch-sequence.md §5). Player X ne passe jamais devant le jeu. */
function launchWindowCaption(settings: Settings): string {
  if (!IS_WINDOWS) return 'Disponible sur Windows'
  if (settings.demoMode) return 'Sans effet en mode démo : rien n’est lancé'
  return settings.launchWindow === 'minimize'
    ? 'Se réduit quand le jeu est détecté et revient quand tu le quittes, sauf s’il était agrandi'
    : 'Player X reste ouvert derrière le jeu, sans jamais passer devant'
}

interface InterfaceProps {
  ui: UiPrefs
  onUiChange: (patch: Partial<UiPrefs>) => void
  settings: Settings
  onSaveSettings: (patch: Partial<Settings>) => Promise<Settings>
}

function InterfaceSection({ ui, onUiChange, settings, onSaveSettings }: InterfaceProps): React.JSX.Element {
  const systemReduced = useSystemReducedMotion()
  const notify = useToast()
  return (
    <>
      <SectionHead title="Interface">Ces préférences s'appliquent tout de suite et restent sur ce PC.</SectionHead>
      <div className="set-rows">
        <SettingRow
          label="Liste d'amis du menu"
          value={ui.friendsPanel === 'open' ? 'Dépliée sous la navigation' : "Repliée · un clic sur « Amis » la déplie"}
        >
          <Segmented
            label="Liste d'amis du menu"
            value={ui.friendsPanel}
            options={[
              { value: 'open', label: 'Dépliée' },
              { value: 'hidden', label: 'Repliée' }
            ]}
            onChange={(friendsPanel) => onUiChange({ friendsPanel })}
          />
        </SettingRow>
        <SettingRow
          label="Taille des jaquettes"
          value={
            <>
              {SIZE_LABEL[ui.coverSize]} · <span className="num">{COVER_MIN[ui.coverSize]}</span> px de large au minimum
            </>
          }
        >
          <Segmented
            label="Taille des jaquettes"
            value={ui.coverSize}
            options={(['S', 'M', 'L'] as const).map((v) => ({ value: v, label: SIZE_LABEL[v] }))}
            onChange={(coverSize) => onUiChange({ coverSize })}
          />
        </SettingRow>
        <SettingRow
          label="Réduire les animations"
          value={
            ui.reduceMotion
              ? 'Activé · mouvements réduits au minimum'
              : systemReduced
                ? "Désactivé · Windows demande déjà moins d'animations, c'est respecté"
                : "Désactivé · suit aussi le réglage d'accessibilité de Windows"
          }
        >
          <Switch checked={ui.reduceMotion} onChange={(reduceMotion) => onUiChange({ reduceMotion })} label="Réduire les animations" />
        </SettingRow>
        <SettingRow
          label="Effets visuels"
          value={
            ui.reduceMotion || systemReduced
              ? 'En pause · les animations sont réduites'
              : ui.visualFx
                ? 'Activés · jaquettes en relief, reflets, fond aux couleurs du jeu survolé'
                : 'Désactivés · interface sobre, moins de calcul graphique'
          }
        >
          <Switch checked={ui.visualFx} onChange={(visualFx) => onUiChange({ visualFx })} label="Effets visuels" />
        </SettingRow>
        <SettingRow
          label="Effets de transparence"
          value={ui.transparency ? 'Activés · flou derrière les barres et les notifications' : 'Désactivés · couleurs pleines, sans flou'}
        >
          <Switch checked={ui.transparency} onChange={(transparency) => onUiChange({ transparency })} label="Effets de transparence" />
        </SettingRow>
        <SettingRow label="Quand un jeu démarre" value={launchWindowCaption(settings)}>
          <Segmented
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
        <SettingRow label="Alertes d'amis" value={ALERT_LABEL[settings.friendAlerts]}>
          <div className="set-inline">
            <Segmented
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
      </div>
    </>
  )
}
