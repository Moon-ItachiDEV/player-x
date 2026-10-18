import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getBasicPresence,
  getProfileFromAccountId,
  getUserFriendsAccountIds,
  type AuthTokensResponse
} from 'psn-api'
import { net } from 'electron'
import type { Account, Friend, FriendPlatform, FriendsResult, FriendStatus } from '@shared/types'
import { discordGuildIdFrom } from '@shared/text'
import { getAccounts, getSettings, saveAccount } from './settings'

// ---------- Messages d'erreur ----------
// fetch et psn-api renvoient des erreurs en anglais : l'interface n'affiche que du français.

/** Message déjà rédigé pour l'utilisateur, affiché tel quel. */
class UserError extends Error {}

const NETWORK_ERROR = 'Connexion impossible : vérifie ta connexion internet.'
const PSN_AUTH_ERROR = 'Jeton PlayStation invalide ou expiré : colle un nouveau NPSSO dans Paramètres.'
const FALLBACK: Record<FriendPlatform, string> = {
  steam: 'Impossible de récupérer tes amis Steam pour le moment.',
  discord: 'Impossible de récupérer les membres du serveur Discord pour le moment.',
  psn: 'Impossible de récupérer tes amis PlayStation pour le moment.'
}

const isNetworkError = (e: unknown): boolean =>
  (e instanceof TypeError && /fetch failed|network/i.test(e.message)) ||
  (e instanceof Error && /net::ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NAME_RESOLUTION_FAILED|NETWORK_CHANGED|NETWORK_IO_SUSPENDED|NETWORK_ACCESS_DENIED|CONNECTION_|TIMED_OUT|ADDRESS_UNREACHABLE|PROXY_|TUNNEL_)/.test(e.message))

function frenchError(e: unknown, fallback: string): string {
  if (e instanceof UserError) return e.message
  return isNetworkError(e) ? NETWORK_ERROR : fallback
}

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
  if (res.status === 401) throw new UserError('Ta liste d’amis Steam est privée : passe-la en public dans ton profil Steam.')
  if (!res.ok) throw new Error(`Steam API ${res.status}`)
  const list = ((await res.json()) as { friendslist?: { friends: { steamid: string }[] } }).friendslist?.friends ?? []
  // Son propre profil dans la même requête : le pseudo et l'avatar arrivent même si la clé a été ajoutée après la connexion.
  const players = await getSteamProfiles(key, [account.id, ...list.map((f) => f.steamid)])
  const me = players.find((p) => p.steamid === account.id)
  if (me && (me.personaname !== account.name || me.avatarfull !== account.avatarUrl)) {
    // Seulement si ce compte est toujours connecté (pas de retour d'un compte déconnecté entre-temps).
    if (getAccounts().some((a) => a.platform === 'steam' && a.id === account.id)) saveAccount({ ...account, name: me.personaname, avatarUrl: me.avatarfull })
  }
  return players.filter((p) => p.steamid !== account.id).map((p) => {
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
// public d'un serveur (paramètres du serveur, « Activer le widget du serveur ») : membres en ligne et jeu en cours.

interface DiscordWidget {
  members: { id: string; username: string; avatar_url: string; status: string; activity?: { name: string } }[]
}

const DISCORD_WIDGET_OFF =
  'Le widget de ce serveur est désactivé. Dans les paramètres du serveur Discord, active « Activer le widget du serveur » puis enregistre les modifications.'

async function discordServerMembers(rawId: string): Promise<Friend[]> {
  const guildId = discordGuildIdFrom(rawId)
  if (!/^\d{15,22}$/.test(guildId)) throw new UserError('Identifiant de serveur Discord invalide : colle l’« Identifiant du serveur » affiché à côté du widget.')
  // Pile réseau de Chromium (comme un navigateur) et sans cache : Discord refuse parfois les clients « node », et un ancien refus ne doit pas rester.
  const res = await net.fetch(`https://discord.com/api/guilds/${guildId}/widget.json`, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) {
    // Discord précise la cause dans le corps : 50004 = widget désactivé, 10004 = serveur inconnu, 40333 = requête bloquée.
    let body: { code?: number; message?: string } = {}
    try {
      body = (await res.json()) as typeof body
    } catch {
      /* page HTML (protection anti-robot) */
    }
    if (body.code === 50004 || /widget/i.test(body.message ?? '')) throw new UserError(DISCORD_WIDGET_OFF)
    if (res.status === 404 || body.code === 10004)
      throw new UserError('Serveur Discord introuvable : vérifie que c’est bien l’identifiant du serveur, pas ton ID ni celui d’un salon.')
    if (res.status === 429) throw new UserError('Discord limite les requêtes : réessaie dans une minute.')
    if (res.status === 403 || res.status === 401)
      throw new UserError(`Discord a refusé la requête (code ${body.code ?? res.status}). Réessaie dans quelques minutes.`)
    throw new Error(`Discord ${res.status}`)
  }
  const widget = (await res.json()) as DiscordWidget
  return (widget.members ?? []).map((m) => ({
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
  let tokens: AuthTokensResponse
  try {
    tokens = await exchangeAccessCodeForAuthTokens(await exchangeNpssoForAccessCode(npsso))
    if (!tokens.accessToken) throw new Error('PSN token')
  } catch (e) {
    // Hors réseau, un échec ici veut dire que le NPSSO est refusé.
    throw isNetworkError(e) ? e : new UserError(PSN_AUTH_ERROR)
  }
  psnTokens = { ...tokens, obtainedAt: now }
  return psnTokens
}

export async function connectPsn(): Promise<Account> {
  const { psnNpsso } = getSettings()
  if (!psnNpsso) throw new Error('Colle ton jeton NPSSO PlayStation dans Paramètres.')
  psnTokens = null
  try {
    const auth = await psnAuth(psnNpsso)
    const me = await getProfileFromAccountId(auth, 'me')
    const account: Account = { platform: 'psn', id: 'me', name: me.onlineId, avatarUrl: me.avatars.at(-1)?.url }
    saveAccount(account)
    return account
  } catch (e) {
    throw new Error(frenchError(e, 'Connexion à PlayStation impossible pour le moment. Réessaie plus tard.'))
  }
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
      result.errors[platform] = frenchError(e, FALLBACK[platform])
    }
  }

  const tasks: Promise<void>[] = []
  const steam = accounts.find((a) => a.platform === 'steam')
  if (steam) {
    tasks.push(
      collect('steam', () => {
        if (!settings.steamApiKey) throw new UserError('Ajoute ta clé Steam Web API dans Paramètres pour voir tes amis.')
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
