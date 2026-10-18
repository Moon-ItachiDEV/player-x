import type { Account, FriendPlatform, Settings } from '@shared/types'
import { deleteKv, getKv, setKv } from '../db'

const DEFAULTS: Settings = {
  steamApiKey: process.env.STEAM_API_KEY ?? '',
  discordClientId: process.env.DISCORD_CLIENT_ID ?? '',
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
  discordGuildId: '',
  psnNpsso: '',
  demoMode: false
}

export function getSettings(): Settings {
  const saved = getKv<Partial<Settings>>('settings', {})
  // Une valeur vide en base ne masque pas celle du .env
  const merged = { ...DEFAULTS }
  for (const [k, v] of Object.entries(saved)) if (v !== '' && v !== undefined) (merged as Record<string, unknown>)[k] = v
  return merged
}

export function saveSettings(patch: Partial<Settings>): Settings {
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
