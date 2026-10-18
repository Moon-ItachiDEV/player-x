import { useState } from 'react'
import type { Account, FriendPlatform, Settings } from '@shared/types'
import { Badge } from './Badge'

interface Props {
  settings: Settings
  accounts: Account[]
  onSave: (patch: Partial<Settings>) => Promise<void>
  onLogin: (platform: 'steam' | 'discord' | 'psn') => void
  onLogout: (platform: FriendPlatform) => void
}

function Field(props: { label: string; help: React.ReactNode; value: string; secret?: boolean; onChange: (v: string) => void }): React.JSX.Element {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <input type={props.secret ? 'password' : 'text'} value={props.value} onChange={(e) => props.onChange(e.target.value)} spellCheck={false} />
      <span className="field-help">{props.help}</span>
    </label>
  )
}

function Ext({ href, children }: { href: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

export function SettingsView({ settings, accounts, onSave, onLogin, onLogout }: Props): React.JSX.Element {
  const [draft, setDraft] = useState(settings)
  const set = (k: keyof Settings) => (v: string) => setDraft({ ...draft, [k]: v })
  const account = (p: FriendPlatform): Account | undefined => accounts.find((a) => a.platform === p)

  const AccountRow = ({ platform, connect }: { platform: FriendPlatform; connect: () => void }): React.JSX.Element => {
    const a = account(platform)
    return (
      <div className="account-row">
        <Badge kind={platform} />
        <span className="account-name">{a ? a.name : 'Non connecté'}</span>
        {a ? (
          <button className="ghost-btn" onClick={() => onLogout(platform)}>
            Déconnecter
          </button>
        ) : (
          <button className="ghost-btn accent" onClick={connect}>
            Connecter
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="settings">
      <h1>Paramètres</h1>

      <section className="panel">
        <h2>Comptes</h2>
        <AccountRow platform="steam" connect={() => onLogin('steam')} />
        <AccountRow platform="discord" connect={() => onLogin('discord')} />
        <AccountRow platform="psn" connect={() => onLogin('psn')} />
      </section>

      <section className="panel">
        <h2>Steam</h2>
        <Field
          label="Clé Steam Web API"
          secret
          value={draft.steamApiKey}
          onChange={set('steamApiKey')}
          help={
            <>
              Nécessaire pour la liste d’amis. Gratuite sur <Ext href="https://steamcommunity.com/dev/apikey">steamcommunity.com/dev/apikey</Ext>.
              Ta liste d’amis Steam doit être publique.
            </>
          }
        />
      </section>

      <section className="panel">
        <h2>Discord</h2>
        <Field
          label="Client ID"
          value={draft.discordClientId}
          onChange={set('discordClientId')}
          help={
            <>
              Crée une appli sur <Ext href="https://discord.com/developers/applications">discord.com/developers</Ext> et ajoute la redirection{' '}
              <code>http://127.0.0.1:47823/discord/callback</code>.
            </>
          }
        />
        <Field label="Client Secret" secret value={draft.discordClientSecret} onChange={set('discordClientSecret')} help="Onglet OAuth2 de ton appli Discord." />
        <Field
          label="ID du serveur Discord (widget)"
          value={draft.discordGuildId}
          onChange={set('discordGuildId')}
          help="Discord ne partage pas la liste d’amis avec les applis. À la place, on affiche les membres en ligne d’un serveur dont le widget est activé (Paramètres du serveur > Widget)."
        />
      </section>

      <section className="panel">
        <h2>PlayStation (non officiel)</h2>
        <Field
          label="Jeton NPSSO"
          secret
          value={draft.psnNpsso}
          onChange={set('psnNpsso')}
          help={
            <>
              Connecte-toi sur playstation.com puis ouvre <Ext href="https://ca.account.sony.com/api/v1/ssocookie">ca.account.sony.com/api/v1/ssocookie</Ext> et copie la valeur
              « npsso ». API non officielle : elle peut casser sans prévenir.
            </>
          }
        />
      </section>

      <section className="panel">
        <h2>Interface</h2>
        <label className="toggle">
          <input type="checkbox" checked={draft.demoMode} onChange={(e) => setDraft({ ...draft, demoMode: e.target.checked })} />
          <span>Mode démo (jeux et amis fictifs)</span>
        </label>
      </section>

      <div className="settings-actions">
        <button className="play-btn" onClick={() => onSave(draft)}>
          Enregistrer
        </button>
      </div>
    </div>
  )
}
