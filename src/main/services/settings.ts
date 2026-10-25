import { discordGuildIdFrom } from '@shared/text'
import { DEFAULT_OVERLAY_HOTKEY, isValidHotkey } from '@shared/hotkey'
import type { Account, FriendPlatform, Settings } from '@shared/types'
import { deleteKv, getKv, setKv } from '../db'
import { cleanMemberPrefs, type MemberPrefs } from './discordMembers'

// Lu à chaque appel : le .env est chargé après l'import de ce module.
function defaults(): Settings {
  return {
    steamApiKey: process.env.STEAM_API_KEY ?? '',
    discordClientId: process.env.DISCORD_CLIENT_ID ?? '',
    discordClientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
    discordGuildId: '',
    psnNpsso: '',
    demoMode: false,
    friendAlerts: 'all',
    launchWindow: 'stay',
    gameNews: true,
    // Sous Linux, beaucoup de bureaux n'affichent pas la zone de notification : la croix y ferme Player X par défaut.
    closeToTray: process.platform === 'win32',
    startWithWindows: false,
    bf6Recap: true,
    cs2Live: true,
    cs2RecapOpen: true,
    updateChannel: 'stable',
    cs2Overlay: 'off',
    overlayHotkey: DEFAULT_OVERLAY_HOTKEY
  }
}

const TEXT_KEYS = ['steamApiKey', 'discordClientId', 'discordClientSecret', 'discordGuildId', 'psnNpsso'] as const
/** Clés et jetons : jamais envoyés à l'interface (voir publicSettings). */
const SECRET_KEYS = ['steamApiKey', 'discordClientSecret', 'psnNpsso'] as const
const ALERT_MODES = ['all', 'games', 'off']
const WINDOW_MODES = ['stay', 'minimize']
const CHANNELS = ['stable', 'beta']
const OVERLAY_STYLES = ['off', 'a', 'b', 'c']
/** Bien au-delà des vraies valeurs (clé Steam 32, NPSSO 64, secret Discord 32 caractères). */
const MAX_TEXT = 256

/** Ne garde que les réglages connus, avec le bon type (le reste vient de l'interface et n'est pas fiable). */
function cleanPatch(patch: unknown): Partial<Settings> {
  const p = (patch && typeof patch === 'object' ? patch : {}) as Record<string, unknown>
  const clean: Partial<Settings> = {}
  for (const k of TEXT_KEYS) {
    const v = p[k]
    // Une valeur masquée renvoyée par erreur ne doit jamais remplacer le vrai secret.
    if (typeof v === 'string' && v.length <= MAX_TEXT && !v.startsWith('•')) clean[k] = v.trim()
  }
  if (typeof clean.discordGuildId === 'string') clean.discordGuildId = discordGuildIdFrom(clean.discordGuildId)
  if (typeof p.demoMode === 'boolean') clean.demoMode = p.demoMode
  if (typeof p.gameNews === 'boolean') clean.gameNews = p.gameNews
  if (typeof p.closeToTray === 'boolean') clean.closeToTray = p.closeToTray
  if (typeof p.startWithWindows === 'boolean') clean.startWithWindows = p.startWithWindows
  if (typeof p.bf6Recap === 'boolean') clean.bf6Recap = p.bf6Recap
  if (typeof p.cs2Live === 'boolean') clean.cs2Live = p.cs2Live
  if (typeof p.cs2RecapOpen === 'boolean') clean.cs2RecapOpen = p.cs2RecapOpen
  if (typeof p.friendAlerts === 'string' && ALERT_MODES.includes(p.friendAlerts)) clean.friendAlerts = p.friendAlerts as Settings['friendAlerts']
  if (typeof p.launchWindow === 'string' && WINDOW_MODES.includes(p.launchWindow)) clean.launchWindow = p.launchWindow as Settings['launchWindow']
  if (typeof p.updateChannel === 'string' && CHANNELS.includes(p.updateChannel)) clean.updateChannel = p.updateChannel as Settings['updateChannel']
  if (typeof p.cs2Overlay === 'string' && OVERLAY_STYLES.includes(p.cs2Overlay)) clean.cs2Overlay = p.cs2Overlay as Settings['cs2Overlay']
  if (isValidHotkey(p.overlayHotkey)) clean.overlayHotkey = p.overlayHotkey
  return clean
}

export function getSettings(): Settings {
  const saved = cleanPatch(getKv<Partial<Settings>>('settings', {}))
  // Une valeur enregistrée (même vide) l'emporte sur le .env
  return { ...defaults(), ...saved }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  if (TEXT_KEYS.some((k) => typeof patch?.[k] === 'string' && patch[k].length > MAX_TEXT)) throw new Error('Valeur trop longue.')
  const next = { ...cleanPatch(getKv<Partial<Settings>>('settings', {})), ...cleanPatch(patch) }
  setKv('settings', next, true)
  return getSettings()
}

/** Ce que voit l'interface : les secrets sont remplacés par « •••• » et leurs 4 derniers caractères (vide s'ils ne sont pas renseignés). */
export function publicSettings(s: Settings): Settings {
  const masked = { ...s }
  for (const k of SECRET_KEYS) masked[k] = s[k] ? `••••••••${s[k].length >= 12 ? s[k].slice(-4) : ''}` : ''
  return masked
}

export function getAccounts(): Account[] {
  return getKv<Account[]>('accounts', [])
}

export function saveAccount(account: Account): void {
  const others = getAccounts().filter((a) => a.platform !== account.platform)
  setKv('accounts', [...others, account], true)
}

export function removeAccount(platform: FriendPlatform): Account[] {
  const rest = getAccounts().filter((a) => a.platform !== platform)
  if (rest.length) setKv('accounts', rest, true)
  else deleteKv('accounts')
  return rest
}

// Membres du serveur Discord masqués : hors des réglages (jamais envoyés à l'interface avec publicSettings).
// Le mode démo a les siens, pour ne jamais toucher aux vrais.

function memberKv(demo: boolean): string {
  return demo ? 'demoDiscordMembers' : 'discordMembers'
}

export function getMemberPrefs(demo: boolean): MemberPrefs {
  return cleanMemberPrefs(getKv<unknown>(memberKv(demo), null))
}

export function saveMemberPrefs(demo: boolean, prefs: MemberPrefs): void {
  setKv(memberKv(demo), cleanMemberPrefs(prefs))
}
