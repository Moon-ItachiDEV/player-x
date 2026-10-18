import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getBasicPresence,
  getProfileFromAccountId,
  getUserFriendsAccountIds,
  type AuthTokensResponse
} from 'psn-api'
import type { Account, Friend, FriendsResult, FriendStatus } from '@shared/types'
import { getAccounts, getSettings, saveAccount } from './settings'

// ---------- Steam Web API ----------

interface SteamPlayer {
  steamid: string
  personaname: string
  avatarfull: string
  personastate: number // 0 hors ligne, 1 en ligne, 2 occupé, 3 absent, 4 sieste, 5-6 en ligne
  gameextrainfo?: string
}

export async function getSteamProfiles(key: string, ids: string[]): Promise<SteamPlayer[]> {
  const players: SteamPlayer[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${ids.slice(i, i + 100).join(',')}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Steam API ${res.status}`)
    players.push(...((await res.json()) as { response: { players: SteamPlayer[] } }).response.players)
  }
  return players
}

async function steamFriends(account: Account, key: string): Promise<Friend[]> {
  const res = await fetch(
    `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${key}&steamid=${account.id}&relationship=friend`
  )
  if (res.status === 401) throw new Error('Ta liste d’amis Steam est privée : passe-la en public dans ton profil Steam.')
  if (!res.ok) throw new Error(`Steam API ${res.status}`)
  const list = ((await res.json()) as { friendslist?: { friends: { steamid: string }[] } }).friendslist?.friends ?? []
  const players = await getSteamProfiles(key, list.map((f) => f.steamid))
  return players.map((p) => {
    const status: FriendStatus = p.gameextrainfo
      ? 'in-game'
      : p.personastate === 0
        ? 'offline'
        : p.personastate === 3 || p.personastate === 4
          ? 'away'
          : 'online'
    return { id: `steam:${p.steamid}`, platform: 'steam', name: p.personaname, avatarUrl: p.avatarfull, status, game: p.gameextrainfo }
  })
}

// ---------- Discord ----------
// L'API OAuth de Discord ne donne pas accès à la liste d'amis. À la place on lit le widget
// public d'un serveur (Paramètres du serveur > Widget > Activer) : membres en ligne et jeu en cours.

interface DiscordWidget {
  members: { id: string; username: string; avatar_url: string; status: string; activity?: { name: string } }[]
}

async function discordServerMembers(guildId: string): Promise<Friend[]> {
  const res = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`)
  if (res.status === 403) throw new Error('Le widget de ce serveur Discord est désactivé (Paramètres du serveur > Widget).')
  if (!res.ok) throw new Error(`Discord ${res.status}`)
  const widget = (await res.json()) as DiscordWidget
  return widget.members.map((m) => ({
    id: `discord:${m.id}`,
    platform: 'discord',
    name: m.username,
    avatarUrl: m.avatar_url,
    status: m.activity ? 'in-game' : m.status === 'idle' ? 'away' : 'online',
    game: m.activity?.name
  }))
}

// ---------- PlayStation (non officiel, via psn-api) ----------

let psnTokens: (AuthTokensResponse & { obtainedAt: number }) | null = null

async function psnAuth(npsso: string): Promise<{ accessToken: string }> {
  const now = Date.now()
  if (psnTokens && now < psnTokens.obtainedAt + (psnTokens.expiresIn - 60) * 1000) return psnTokens
  if (psnTokens?.refreshToken) {
    try {
      psnTokens = { ...(await exchangeRefreshTokenForAuthTokens(psnTokens.refreshToken)), obtainedAt: now }
      return psnTokens
    } catch {
      /* on retombe sur le NPSSO */
    }
  }
  const code = await exchangeNpssoForAccessCode(npsso)
  psnTokens = { ...(await exchangeAccessCodeForAuthTokens(code)), obtainedAt: now }
  return psnTokens
}

export async function connectPsn(): Promise<Account> {
  const { psnNpsso } = getSettings()
  if (!psnNpsso) throw new Error('Colle ton jeton NPSSO PlayStation dans Paramètres.')
  psnTokens = null
  const auth = await psnAuth(psnNpsso)
  const me = await getProfileFromAccountId(auth, 'me')
  const account: Account = { platform: 'psn', id: 'me', name: me.onlineId, avatarUrl: me.avatars.at(-1)?.url }
  saveAccount(account)
  return account
}

async function psnFriends(npsso: string): Promise<Friend[]> {
  const auth = await psnAuth(npsso)
  const { friends } = await getUserFriendsAccountIds(auth, 'me', { limit: 50 })
  return Promise.all(
    friends.map(async (accountId): Promise<Friend> => {
      const [profile, presence] = await Promise.all([
        getProfileFromAccountId(auth, accountId),
        getBasicPresence(auth, accountId).catch(() => null)
      ])
      const p = presence?.basicPresence
      const game = p?.gameTitleInfoList?.[0]?.titleName
      const online = p?.primaryPlatformInfo?.onlineStatus === 'online'
      return {
        id: `psn:${accountId}`,
        platform: 'psn',
        name: profile.onlineId,
        avatarUrl: profile.avatars.at(-1)?.url,
        status: game ? 'in-game' : online ? 'online' : 'offline',
        game,
        device: p?.primaryPlatformInfo?.platform
      }
    })
  )
}

// ---------- Agrégation ----------

export async function getAllFriends(): Promise<FriendsResult> {
  const settings = getSettings()
  const accounts = getAccounts()
  const result: FriendsResult = { friends: [], errors: {} }

  const collect = async (platform: Friend['platform'], load: () => Promise<Friend[]>): Promise<void> => {
    try {
      result.friends.push(...(await load()))
    } catch (e) {
      result.errors[platform] = e instanceof Error ? e.message : String(e)
    }
  }

  const tasks: Promise<void>[] = []
  const steam = accounts.find((a) => a.platform === 'steam')
  if (steam) {
    tasks.push(
      collect('steam', () => {
        if (!settings.steamApiKey) throw new Error('Ajoute ta clé Steam Web API dans Paramètres pour voir tes amis.')
        return steamFriends(steam, settings.steamApiKey)
      })
    )
  }
  if (settings.discordGuildId) tasks.push(collect('discord', () => discordServerMembers(settings.discordGuildId)))
  if (accounts.some((a) => a.platform === 'psn') && settings.psnNpsso) {
    tasks.push(collect('psn', () => psnFriends(settings.psnNpsso)))
  }
  await Promise.all(tasks)
  return result
}
