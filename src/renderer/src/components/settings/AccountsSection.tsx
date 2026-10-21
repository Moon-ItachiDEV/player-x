// Section « Comptes » : une carte de connexion par plateforme.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { plural } from '@shared/text'
import type { Account, FriendPlatform, FriendsResult, HiddenMember, Settings } from '@shared/types'
import type { LoginPlatform } from '../../contracts'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { Dialog } from '../ui/Overlay'
import { StoreTag } from '../ui/StoreTag'
import { errorMessage, useToast } from '../ui/Toasts'
import { prefersReducedMotion, SectionHead, SettingRow } from './parts'

export const PLATFORMS: FriendPlatform[] = ['steam', 'discord', 'psn']

export const PLATFORM_NAME: Record<FriendPlatform, string> = { steam: 'Steam', discord: 'Discord', psn: 'PlayStation' }

const USES: Record<FriendPlatform, string[]> = {
  steam: ['Amis', 'Présence en jeu'],
  discord: ["Membres en ligne d'un serveur"],
  psn: ['Amis', 'Présence', 'Console']
}
/** Discord connecté sans serveur : le compte ne sert qu'au profil. */
const DISCORD_PROFILE_ONLY = ['Profil']

const CONNECT_LABEL: Record<FriendPlatform, string> = { steam: 'Connecter Steam', discord: 'Connecter Discord', psn: 'Connecter' }

const DISCONNECT_BODY: Record<FriendPlatform, string> = {
  steam: "Tes amis Steam n'apparaîtront plus dans Player X. Tu pourras te reconnecter à tout moment.",
  discord: "Ton compte Discord sera retiré de Player X. Les membres du serveur restent affichés tant que l'ID du serveur est renseigné dans Avancé.",
  psn: "Tes amis PlayStation n'apparaîtront plus dans Player X, et ton jeton NPSSO sera effacé. Pour te reconnecter, colle un nouveau jeton dans Avancé."
}

const PRIVACY_URL = 'https://steamcommunity.com/my/edit/settings'

type Tone = 'success' | 'muted' | 'warning' | 'danger'

type Fix = { label: string; to: 'advanced' | 'privacy' }

export interface ConnState {
  label: 'Connecté' | 'Non connecté' | 'Action requise' | 'À configurer' | 'Erreur'
  tone: Tone
  /** Phrase d'intérêt (non connecté) ou message de l'alerte. */
  message?: string
  fixes?: Fix[]
  canConnect?: boolean
  /** Connecté, avec une option facultative à proposer (pas une alerte). */
  tip?: { message: string; fix: Fix }
}

const CONNECTED: ConnState = { label: 'Connecté', tone: 'success' }
const configure = (label = 'Configurer'): Fix => ({ label, to: 'advanced' })

/** Statut d'une plateforme selon le compte, les réglages et la dernière récupération des amis. */
export function connState(p: FriendPlatform, account: Account | undefined, s: Settings, errors: FriendsResult['errors']): ConnState {
  const err = errors[p]
  if (p === 'steam') {
    if (!account) return { label: 'Non connecté', tone: 'muted', message: 'Affiche tes amis Steam et ce à quoi ils jouent.', canConnect: true }
    if (!s.steamApiKey)
      return { label: 'Action requise', tone: 'warning', message: 'Ajoute ta clé Steam Web API pour afficher tes amis.', fixes: [configure('Ajouter la clé')] }
    if (err) {
      const privacy: Fix = { label: 'Ouvrir mes réglages de confidentialité Steam', to: 'privacy' }
      return { label: 'Erreur', tone: 'danger', message: err, fixes: /priv/i.test(err) ? [privacy] : [configure('Vérifier la clé'), privacy] }
    }
    return CONNECTED
  }
  if (p === 'discord') {
    if (account) {
      if (err) return { label: 'Erreur', tone: 'danger', message: err, fixes: [configure()] }
      // Le serveur est facultatif : le compte seul est bien connecté.
      if (!s.discordGuildId)
        return {
          ...CONNECTED,
          tip: { message: "En option : choisis un serveur Discord dont le widget est activé pour voir ses membres en ligne.", fix: configure('Ajouter un serveur') }
        }
      return CONNECTED
    }
    if (!s.discordClientId || !s.discordClientSecret)
      return {
        label: 'À configurer',
        tone: 'warning',
        message: 'Discord demande une application développeur. Renseigne-la dans Avancé.',
        fixes: [configure()]
      }
    if (err) return { label: 'Erreur', tone: 'danger', message: err, fixes: [configure()], canConnect: true }
    return { label: 'Non connecté', tone: 'muted', message: "Affiche les membres en ligne d'un serveur Discord et ce à quoi ils jouent.", canConnect: true }
  }
  // PlayStation
  if (account) {
    if (!s.psnNpsso) return { label: 'Action requise', tone: 'warning', message: 'Colle ton jeton NPSSO dans Avancé.', fixes: [configure('Ajouter le jeton')] }
    if (err) return { label: 'Erreur', tone: 'danger', message: err, fixes: [configure('Mettre à jour le jeton')] }
    return CONNECTED
  }
  if (!s.psnNpsso) return { label: 'À configurer', tone: 'warning', message: 'Colle ton jeton NPSSO dans Avancé.', fixes: [configure()] }
  return { label: 'Non connecté', tone: 'muted', message: 'Affiche tes amis PlayStation via une API non officielle.', canConnect: true }
}

interface Props {
  settings: Settings
  accounts: Account[]
  friends: FriendsResult
  loginPending: LoginPlatform | null
  onLogin: (p: LoginPlatform) => void
  onLogout: (p: FriendPlatform) => Promise<void>
  onConfigure: (p: FriendPlatform) => void
  onShowMember: (name: string) => Promise<void>
  /** « Gérer » de la liste d'amis : bloc « Membres masqués » à montrer et à focaliser. */
  focus: 'hidden-members' | null
  onFocused: () => void
}

export function AccountsSection(props: Props): React.JSX.Element {
  const { settings, accounts, friends, loginPending, onLogin, onLogout, onConfigure, onShowMember, focus, onFocused } = props
  const notify = useToast()
  const [confirm, setConfirm] = useState<FriendPlatform | null>(null)
  const [busy, setBusy] = useState(false)
  const lastConfirm = useRef<FriendPlatform>('steam')
  if (confirm) lastConfirm.current = confirm
  const shown = confirm ?? lastConfirm.current
  // Bouton « Déconnecter » à l'origine du dialogue, retenu avant l'autoFocus d'« Annuler ».
  const trigger = useRef<HTMLElement | null>(null)

  useFocusTrap(!!confirm, trigger)

  const logout = async (): Promise<void> => {
    if (!confirm || busy) return
    setBusy(true)
    try {
      await onLogout(confirm)
      setConfirm(null)
    } catch (e) {
      notify(errorMessage(e), { kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SectionHead title="Comptes connectés">
        Connecte tes comptes pour voir tes amis et ce à quoi ils jouent. Ta bibliothèque fonctionne sans compte.
      </SectionHead>
      <div className="set-conn-grid">
        {PLATFORMS.map((p) => {
          const account = accounts.find((a) => a.platform === p)
          return (
            <ConnectionCard
              key={p}
              platform={p}
              account={account}
              state={connState(p, account, settings, friends.errors)}
              count={friends.friends.filter((f) => f.platform === p).length}
              masked={p === 'discord' ? (friends.hidden ?? []).filter((h) => h.online).length : 0}
              settings={settings}
              loginPending={loginPending}
              onConnect={() => onLogin(p)}
              onDisconnect={(el) => {
                trigger.current = el
                setConfirm(p)
              }}
              onConfigure={() => onConfigure(p)}
            />
          )
        })}
      </div>
      {(settings.discordGuildId || settings.demoMode || (friends.hidden?.length ?? 0) > 0) && (
        <HiddenMembers hidden={friends.hidden ?? []} onShow={onShowMember} focus={focus} onFocused={onFocused} />
      )}
      <Dialog
        open={!!confirm}
        title={`Déconnecter ${PLATFORM_NAME[shown]} ?`}
        onClose={() => !busy && setConfirm(null)}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)} disabled={busy} autoFocus>
              Annuler
            </button>
            <button className="btn btn-danger set-danger-solid" onClick={logout} disabled={busy}>
              {busy && <span className="spinner" />}
              Déconnecter
            </button>
          </>
        }
      >
        <p>{DISCONNECT_BODY[shown]}</p>
      </Dialog>
    </>
  )
}

interface CardProps {
  platform: FriendPlatform
  account?: Account
  state: ConnState
  count: number
  /** Discord : membres en ligne masqués (bots connus, « Masquer »). */
  masked: number
  settings: Settings
  loginPending: LoginPlatform | null
  onConnect: () => void
  onDisconnect: (trigger: HTMLElement) => void
  onConfigure: () => void
}

function ConnectionCard({ platform, account, state, count, masked, settings, loginPending, onConnect, onDisconnect, onConfigure }: CardProps): React.JSX.Element {
  const name = PLATFORM_NAME[platform]
  const pending = loginPending === platform
  // Steam et Discord passent par le navigateur (même port de retour) : une connexion à la fois.
  const blocked = !!loginPending && !pending

  const caption = pending
    ? platform === 'psn'
      ? 'Connexion à PlayStation…'
      : 'Termine la connexion dans ton navigateur…'
    : account
      ? state.label === 'Connecté'
        ? platform === 'discord'
          ? settings.discordGuildId
            ? `${plural(count, 'membre en ligne', 'membres en ligne')}${masked ? ` · ${plural(masked, 'masqué', 'masqués')}` : ''}`
            : 'Aucun serveur choisi'
          : plural(count, 'ami', 'amis')
        : 'Amis indisponibles pour le moment'
      : platform === 'psn'
        ? 'API non officielle'
        : platform === 'discord' && !(settings.discordClientId && settings.discordClientSecret)
          ? 'Application développeur requise'
          : 'Connexion dans ton navigateur'

  return (
    <article className="set-conn" aria-labelledby={`set-conn-${platform}`}>
      <header className="set-conn-head">
        <StoreTag kind={platform} size={40} />
        <div className="set-conn-name">
          <h3 id={`set-conn-${platform}`}>{name}</h3>
          {platform === 'psn' && <span className="pill pill-outline-warning no-dot">Expérimental</span>}
        </div>
        <span className={`pill pill-${state.tone}`}>{state.label}</span>
      </header>

      {account && (
        <div className="set-conn-id">
          <Avatar name={account.name} url={account.avatarUrl} size={32} />
          <div className="set-conn-id-text">
            <div className="set-conn-acc">{account.name}</div>
            {account.id && account.id !== 'me' && <div className="caption num">ID {account.id}</div>}
          </div>
        </div>
      )}

      {state.label === 'Connecté' ? (
        <div className="set-conn-uses">
          <span className="overline">Utilisé pour</span>
          <div className="set-conn-chips">
            {(platform === 'discord' && !settings.discordGuildId ? DISCORD_PROFILE_ONLY : USES[platform]).map((u) => (
              <span key={u} className="set-use">
                {u}
              </span>
            ))}
          </div>
          {state.tip && (
            <div className="set-tip">
              <Icon name="info" size={16} />
              <p>{state.tip.message}</p>
              <button className="btn btn-secondary btn-sm" onClick={onConfigure}>
                {state.tip.fix.label}
              </button>
            </div>
          )}
        </div>
      ) : state.fixes ? (
        <div className={`set-alert ${state.tone}`}>
          <Icon name={state.tone === 'danger' ? 'alert-circle' : 'alert-triangle'} size={16} />
          <div>
            <p>{state.message}</p>
            <div className="set-alert-actions">
              {state.fixes.map((f) =>
                f.to === 'privacy' ? (
                  <button key={f.label} className="link-btn set-link" onClick={() => window.launcher.openExternal(PRIVACY_URL)}>
                    {f.label}
                    <Icon name="external-link" size={13} />
                  </button>
                ) : (
                  <button key={f.label} className="btn btn-secondary btn-sm" onClick={onConfigure}>
                    {f.label}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="set-conn-benefit">{state.message}</p>
      )}

      <footer className="set-conn-foot">
        <span className="caption">{caption}</span>
        <div className="set-conn-actions">
          {pending && platform !== 'psn' && (
            <button className="btn btn-ghost btn-sm" onClick={() => window.launcher.cancelLogin()}>
              Annuler
            </button>
          )}
          {account ? (
            <button className="btn btn-ghost btn-sm set-ghost-danger" onClick={(e) => onDisconnect(e.currentTarget)}>
              Déconnecter
            </button>
          ) : (
            state.canConnect && (
              <button className="btn btn-primary btn-sm" onClick={onConnect} disabled={pending || blocked}>
                {pending && <span className="spinner" />}
                {pending ? 'Connexion…' : CONNECT_LABEL[platform]}
              </button>
            )
          )}
        </div>
      </footer>
    </article>
  )
}

const HIDDEN_VALUE: Record<HiddenMember['reason'], string> = { bot: 'Bot reconnu par Player X', user: 'Masqué à ta demande' }

interface HiddenProps {
  hidden: HiddenMember[]
  onShow: (name: string) => Promise<void>
  focus: 'hidden-members' | null
  onFocused: () => void
}

/** Membres du serveur Discord retirés des listes : bots reconnus d'office et membres masqués avec l'œil barré. */
function HiddenMembers({ hidden, onShow, focus, onFocused }: HiddenProps): React.JSX.Element {
  const title = useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Arrivée depuis « Gérer » (liste d'amis) : le bloc se montre et prend le focus.
  useEffect(() => {
    if (focus !== 'hidden-members') return
    title.current?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    title.current?.focus({ preventScroll: true })
    onFocused()
  }, [focus, onFocused])

  // « Afficher » : la ligne disparaît avec son bouton quand la liste relue arrive, après la fin de `onShow` (rendu suivant).
  // C'est donc une fois la ligne retirée du DOM que le focus, tombé sur la page, revient au titre du bloc.
  const refocus = useRef<string | null>(null)
  useLayoutEffect(() => {
    const name = refocus.current
    if (!name || hidden.some((m) => m.name === name)) return
    refocus.current = null
    const active = document.activeElement
    if (!active || active === document.body || !active.isConnected) title.current?.focus({ preventScroll: true })
  }, [hidden])

  const show = async (name: string): Promise<void> => {
    if (busy) return
    setBusy(name)
    refocus.current = name
    try {
      await onShow(name)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="set-hidden-title">
      <h3 id="set-hidden-title" ref={title} className="set-block-title" tabIndex={-1}>
        Membres masqués
      </h3>
      <div className="set-help-block">
        <p className="set-help">
          Le widget Discord ne dit pas qui est un bot : Player X masque d'office les bots connus (MEE6, MonitoRSS, PatchBot, Soundboards.gg…). Pour masquer
          quelqu'un d'autre, survole-le dans la liste d'amis et clique sur l'œil barré. Discord ne donne que le pseudo : un membre qui en change réapparaît.
        </p>
        {hidden.length ? (
          <div>
            {hidden.map((m) => (
              <SettingRow key={m.name} label={m.name} value={m.reason === 'user' && !m.online ? `${HIDDEN_VALUE.user} · hors ligne` : HIDDEN_VALUE[m.reason]}>
                <button className="btn btn-secondary btn-sm" aria-label={`Afficher ${m.name}`} disabled={busy === m.name} onClick={() => void show(m.name)}>
                  <Icon name="eye" size={15} />
                  Afficher
                </button>
              </SettingRow>
            ))}
          </div>
        ) : (
          <p className="set-help">Aucun membre masqué pour le moment.</p>
        )}
      </div>
    </section>
  )
}

/** Garde le focus clavier dans la boîte de dialogue ouverte, et le rend au déclencheur à la fermeture. */
function useFocusTrap(active: boolean, triggerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!active) return
    const trigger = triggerRef.current
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return
      const dialog = document.querySelector<HTMLElement>('.dialog[role="dialog"]')
      if (!dialog) return
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (trigger?.isConnected) trigger.focus()
    }
  }, [active, triggerRef])
}
