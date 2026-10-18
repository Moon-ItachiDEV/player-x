// Paramètres : navigation latérale + une section à la fois. Pas de bouton « Enregistrer » global : chaque réglage s'applique seul.
import { useCallback, useEffect, useRef, useState } from 'react'
import { timeAgo } from '@shared/text'
import type { FriendPlatform, ScanReport } from '@shared/types'
import { COVER_MIN, type SettingsProps, type SettingsSection, type UiPrefs } from '../../contracts'
import { useSystemReducedMotion } from '../../motion'
import { Icon, type IconName } from '../ui/Icon'
import { Segmented, Switch } from '../ui/Overlay'
import { STORE_LONG, StoreTag } from '../ui/StoreTag'
import { AccountsSection, connState, PLATFORMS } from './AccountsSection'
import { AdvancedSection } from './AdvancedSection'
import { Collapse, SectionHead, SettingRow, storeCaption, useNow } from './parts'
import './settings.css'

const NAV: { group: string; items: { id: SettingsSection; label: string; icon: IconName }[] }[] = [
  { group: 'Compte', items: [{ id: 'accounts', label: 'Comptes', icon: 'users' }] },
  {
    group: 'Application',
    items: [
      { id: 'library', label: 'Bibliothèque', icon: 'library' },
      { id: 'interface', label: 'Interface', icon: 'sliders' }
    ]
  },
  { group: 'Avancé', items: [{ id: 'advanced', label: 'Avancé', icon: 'key' }] }
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
    const tone = connState(p, accounts.find((a) => a.platform === p), settings, friends.errors).tone
    return tone === 'danger' || (tone === 'warning' && accounts.some((a) => a.platform === p))
  }).length

  return (
    <div className="set-page" ref={rootRef}>
      <div className="set-layout">
        <nav className="set-nav" aria-label="Sections des paramètres">
          <h1 className="display-l set-nav-title">Paramètres</h1>
          {NAV.map((g) => (
            <div className="set-nav-group" key={g.group} role="group" aria-label={g.group}>
              <div className="overline set-nav-heading" aria-hidden="true">
                {g.group}
              </div>
              {g.items.map((it) => (
                <button key={it.id} className="set-nav-item" aria-current={section === it.id ? 'page' : undefined} onClick={() => onSection(it.id)}>
                  <Icon name={it.icon} size={16} />
                  {it.label}
                  {it.id === 'accounts' && attention > 0 && (
                    <span className="set-nav-flag" title="Action requise">
                      <Icon name="alert-circle" size={14} />
                      <span className="sr-only">· action requise</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="set-main">
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
            />
          )}
          {section === 'interface' && <InterfaceSection ui={props.ui} onUiChange={props.onUiChange} />}
          {section === 'advanced' && (
            <AdvancedSection settings={settings} report={props.report} onSaveSettings={props.onSaveSettings} focusCard={focusCard} onFocused={clearFocus} />
          )}
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
}

function LibrarySection({ report, scanning, lastScanAt, gamesCount, demo, onRescan }: LibraryProps): React.JSX.Element {
  const now = useNow()
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
        {report.length
          ? report.map((r) => <StoreRow key={r.store} report={r} />)
          : scanning
            ? [0, 1, 2].map((i) => (
                <div className="set-store" key={i}>
                  <div className="set-store-main">
                    <span className="skel set-skel-tag" />
                    <span className="skel set-skel-line" />
                  </div>
                </div>
              ))
            : (
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
    </>
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

function InterfaceSection({ ui, onUiChange }: { ui: UiPrefs; onUiChange: (patch: Partial<UiPrefs>) => void }): React.JSX.Element {
  const systemReduced = useSystemReducedMotion()
  return (
    <>
      <SectionHead title="Interface">Ces préférences s'appliquent tout de suite et restent sur ce PC.</SectionHead>
      <div className="set-rows">
        <SettingRow
          label="Panneau d'amis"
          value={ui.friendsPanel === 'open' ? 'Affiché à droite de la fenêtre' : 'Masqué · le bouton de la barre du haut le rouvre'}
        >
          <Segmented
            label="Panneau d'amis"
            value={ui.friendsPanel}
            options={[
              { value: 'open', label: 'Affiché' },
              { value: 'hidden', label: 'Masqué' }
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
                ? 'Désactivé · Windows demande déjà moins d\'animations, c\'est respecté'
                : 'Désactivé · suit aussi le réglage d\'accessibilité de Windows'
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
      </div>
    </>
  )
}
