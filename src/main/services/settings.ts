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
    friendAlerts: 'all'
  }
}

export function getSettings(): Settings {
  const saved = getKv<Partial<Settings>>('settings', {})
  // Une valeur enregistrée (même vide) l'emporte sur le .env
  const merged = { ...defaults() }
  for (const [k, v] of Object.entries(saved)) if (v !== undefined && v !== null) (merged as Record<string, unknown>)[k] = v
  return merged
}

export function saveSettings(patch: Partial<Settings>): Settings {
  if (typeof patch.discordGuildId === 'string') patch = { ...patch, discordGuildId: discordGuildIdFrom(patch.discordGuildId) }
  if ('friendAlerts' in patch && !['all', 'games', 'off'].includes(patch.friendAlerts as string)) delete patch.friendAlerts
  const next = { ...getKv<Partial<Settings>>('settings', {}), ...patch }
  setKv('settings', next, true)
  return getSettings()
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
