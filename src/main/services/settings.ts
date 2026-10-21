import { discordGuildIdFrom } from '@shared/text'
import type { Account, FriendPlatform, Settings } from '@shared/types'
import { deleteKv, getKv, setKv } from '../db'

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
    launchWindow: 'stay'
  }
}

const TEXT_KEYS = ['steamApiKey', 'discordClientId', 'discordClientSecret', 'discordGuildId', 'psnNpsso'] as const
/** Clés et jetons : jamais envoyés à l'interface (voir publicSettings). */
const SECRET_KEYS = ['steamApiKey', 'discordClientSecret', 'psnNpsso'] as const
const ALERT_MODES = ['all', 'games', 'off']
const WINDOW_MODES = ['stay', 'minimize']
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
  if (typeof p.friendAlerts === 'string' && ALERT_MODES.includes(p.friendAlerts)) clean.friendAlerts = p.friendAlerts as Settings['friendAlerts']
  if (typeof p.launchWindow === 'string' && WINDOW_MODES.includes(p.launchWindow)) clean.launchWindow = p.launchWindow as Settings['launchWindow']
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
