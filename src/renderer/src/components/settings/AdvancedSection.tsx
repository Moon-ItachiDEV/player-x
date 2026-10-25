// Section « Avancé » : clés et applications développeur, diagnostic.
import { useEffect, useRef, useState } from 'react'
import { discordGuildIdFrom } from '@shared/text'
import type { FriendPlatform, ScanReport, Settings } from '@shared/types'
import { Icon } from '../ui/Icon'
import { StoreTag } from '../ui/StoreTag'
import { useToast } from '../ui/Toasts'
import { Collapse, prefersReducedMotion, readLocal, reportText, SectionHead, SettingRow, SettingsCard, writeLocal } from './parts'
import { SecretField, TextField } from './SecretField'

const STEAM_KEY_URL = 'https://steamcommunity.com/dev/apikey'
const NPSSO_URL = 'https://ca.account.sony.com/api/v1/ssocookie'
const REDIRECT_URI = 'http://127.0.0.1:47823/discord/callback'
const PREFS_KEY = 'pg.settings'

const steamKey = (v: string): string | null => (/^[0-9a-f]{32}$/i.test(v) ? null : 'Une clé Steam Web API fait 32 caractères (chiffres et lettres de A à F).')
const discordId = (v: string): string | null => (/^\d{15,22}$/.test(v) ? null : 'Un identifiant Discord ne contient que des chiffres (17 à 20 en général).')
// Serveur : l'ID seul ou le lien « JSON API » copié depuis les réglages du widget.
const guildId = (v: string): string | null => discordId(discordGuildIdFrom(v))

interface Props {
  settings: Settings
  report: ScanReport[]
  onSaveSettings: (patch: Partial<Settings>) => Promise<Settings>
  /** Carte à montrer et à focaliser en arrivant (depuis « Configurer »). */
  focusCard: FriendPlatform | null
  onFocused: () => void
}

export function AdvancedSection({ settings, report, onSaveSettings, focusCard, onFocused }: Props): React.JSX.Element {
  const notify = useToast()
  const cards = useRef<Partial<Record<FriendPlatform, HTMLElement | null>>>({})
  const guildInput = useRef<HTMLInputElement>(null)
  const [diagOpen, setDiagOpen] = useState(() => readLocal(PREFS_KEY, { diagOpen: false }).diagOpen)

  useEffect(() => {
    if (!focusCard) return
    const card = cards.current[focusCard]
    if (card) {
      card.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      // Discord déjà configuré : il ne manque que le serveur.
      const discordReady = focusCard === 'discord' && settings.discordClientId && settings.discordClientSecret
      const target = discordReady ? guildInput.current : card.querySelector<HTMLInputElement>('input')
      target?.focus({ preventScroll: true })
    }
    onFocused()
  }, [focusCard, onFocused])

  const copy = async (text: string, done: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      notify(done, { kind: 'success' })
    } catch {
      notify('Impossible de copier', { kind: 'error' })
    }
  }

  const toggleDiag = (): void => {
    setDiagOpen((o) => {
      writeLocal(PREFS_KEY, { diagOpen: !o })
      return !o
    })
  }

  const checkedCount = report.reduce((n, r) => n + r.checked.length, 0)

  return (
    <>
      <SectionHead title="Avancé">Clés d'accès et informations utiles en cas de souci.</SectionHead>

      <div className="set-banner">
        <Icon name="info" size={16} />
        <p>Ces réglages servent aux connexions qui demandent une clé ou une application développeur. Ils restent sur ce PC.</p>
      </div>

      <h3 className="set-block-title">Clés API et intégrations</h3>
      <div className="set-adv-cards">
        <section className="set-adv-card" ref={(el) => void (cards.current.steam = el)} aria-labelledby="set-adv-steam">
          <header className="set-adv-head">
            <StoreTag kind="steam" size={40} />
            <h4 id="set-adv-steam">Steam</h4>
          </header>
          <SecretField
            label="Clé Steam Web API"
            value={settings.steamApiKey}
            onSave={async (v) => (await onSaveSettings({ steamApiKey: v })).steamApiKey}
            savedToast="Clé enregistrée"
            clearedToast="Clé effacée"
            placeholder="32 caractères"
            validate={steamKey}
          />
          <p className="set-help">
            Gratuite sur steamcommunity.com/dev/apikey. Ta liste d'amis Steam doit être publique.{' '}
            <button className="link-btn set-link" onClick={() => window.launcher.openExternal(STEAM_KEY_URL)}>
              Où obtenir cette clé ?
              <Icon name="external-link" size={13} />
            </button>
          </p>
        </section>

        <section className="set-adv-card" ref={(el) => void (cards.current.discord = el)} aria-labelledby="set-adv-discord">
          <header className="set-adv-head">
            <StoreTag kind="discord" size={40} />
            <h4 id="set-adv-discord">Discord</h4>
          </header>
          <TextField
            label="Client ID"
            value={settings.discordClientId}
            onSave={async (v) => (await onSaveSettings({ discordClientId: v })).discordClientId}
            savedToast="Client ID enregistré"
            clearedToast="Client ID effacé"
            placeholder="Identifiant de ton application"
            validate={discordId}
            masculine
          />
          <SecretField
            label="Client Secret"
            value={settings.discordClientSecret}
            onSave={async (v) => (await onSaveSettings({ discordClientSecret: v })).discordClientSecret}
            savedToast="Client Secret enregistré"
            clearedToast="Client Secret effacé"
            masculine
          />
          <div className="set-help-block">
            <p className="set-help">Ajoute cette redirection à ton application :</p>
            <div className="set-codebox">
              <code>{REDIRECT_URI}</code>
              <button className="btn btn-secondary btn-sm" onClick={() => copy(REDIRECT_URI, 'Adresse de redirection copiée')}>
                <Icon name="copy" size={14} />
                Copier
              </button>
            </div>
          </div>
          <TextField
            ref={guildInput}
            label="ID du serveur (widget)"
            value={settings.discordGuildId}
            onSave={async (v) => (await onSaveSettings({ discordGuildId: v })).discordGuildId}
            savedToast="Serveur enregistré"
            clearedToast="Serveur retiré"
            placeholder="Identifiant numérique du serveur"
            validate={guildId}
            masculine
          />
          <p className="set-help">
            Dans les paramètres du serveur Discord, active « Activer le widget du serveur » et enregistre. Copie ensuite l'« Identifiant du serveur » affiché juste en dessous (le lien « JSON API » marche aussi).
          </p>
        </section>

        <section className="set-adv-card" ref={(el) => void (cards.current.psn = el)} aria-labelledby="set-adv-psn">
          <header className="set-adv-head">
            <StoreTag kind="psn" size={40} />
            <h4 id="set-adv-psn">PlayStation</h4>
            <span className="pill pill-outline-warning no-dot">Expérimental</span>
          </header>
          <SecretField
            label="Jeton NPSSO"
            value={settings.psnNpsso}
            onSave={async (v) => (await onSaveSettings({ psnNpsso: v })).psnNpsso}
            savedToast="Jeton enregistré"
            clearedToast="Jeton effacé"
            placeholder="64 caractères"
            masculine
          />
          <div className="set-note-danger">
            <Icon name="alert-triangle" size={16} />
            <p>
              Ce jeton donne accès à ton compte PlayStation : garde-le comme un mot de passe. API non officielle, elle peut cesser de fonctionner.
            </p>
          </div>
          <p className="set-help">
            Connecte-toi sur playstation.com dans ton navigateur, puis ouvre ce lien et copie la valeur « npsso ».{' '}
            <button className="link-btn set-link" onClick={() => window.launcher.openExternal(NPSSO_URL)}>
              Obtenir mon jeton
              <Icon name="external-link" size={13} />
            </button>
          </p>
        </section>
      </div>

      <SettingsCard title="Données et diagnostic" className="set-adv-data">
        <div className="set-diag">
          <button className="set-diag-toggle" aria-expanded={diagOpen} aria-controls="set-diag-body" onClick={toggleDiag}>
            <span className="set-row-text">
              <span className="set-row-label">Dossiers examinés au dernier scan</span>
              <span className="set-row-value">
                {report.length ? `${report.length} store${report.length > 1 ? 's' : ''} · ${checkedCount} emplacement${checkedCount > 1 ? 's' : ''}` : 'Aucun scan pour le moment'}
              </span>
            </span>
            <Icon name="chevron-down" size={16} className="set-chev" />
          </button>
          <Collapse open={diagOpen} id="set-diag-body">
            <div className="set-diag-body">
              {report.length ? (
                <>
                  <pre className="set-pre">{reportText(report)}</pre>
                  <button className="btn btn-secondary btn-sm" onClick={() => copy(reportText(report), 'Rapport copié')}>
                    <Icon name="copy" size={14} />
                    Copier le rapport
                  </button>
                </>
              ) : (
                <p className="set-help">Lance un scan depuis Bibliothèque pour voir les dossiers examinés.</p>
              )}
            </div>
          </Collapse>
        </div>
      </SettingsCard>
    </>
  )
}
