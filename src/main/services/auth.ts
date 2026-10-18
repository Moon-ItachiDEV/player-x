import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { shell } from 'electron'
import type { Account } from '@shared/types'
import { getSettings, saveAccount } from './settings'
import { getSteamProfiles } from './friends'

// Les logins passent par le navigateur du système (il y est souvent déjà connecté),
// puis reviennent sur un petit serveur local qui récupère la réponse.
export const CALLBACK_PORT = 47823
const BASE = `http://127.0.0.1:${CALLBACK_PORT}`

function waitForCallback(path: string): Promise<URL> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', BASE)
      if (url.pathname !== path) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        '<body style="background:#0b0d17;color:#e8eaff;font-family:sans-serif;display:grid;place-items:center;height:100vh">' +
          '<h2>Connexion réussie, tu peux revenir sur Plateforme Gaming.</h2></body>'
      )
      clearTimeout(timer)
      server.close()
      resolve(url)
    })
    const timer = setTimeout(() => {
      server.close()
      reject(new Error('Connexion expirée, réessaie.'))
    }, 5 * 60_000)
    server.on('error', reject)
    server.listen(CALLBACK_PORT, '127.0.0.1')
  })
}

// ---------- Steam (OpenID 2.0) ----------

export async function loginSteam(): Promise<Account> {
  const returnTo = `${BASE}/steam/callback`
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': BASE,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  })
  const pending = waitForCallback('/steam/callback')
  await shell.openExternal(`https://steamcommunity.com/openid/login?${params}`)
  const cb = await pending

  // Vérifie la signature auprès de Steam pour ne pas faire confiance à l'URL de retour.
  const verify = new URLSearchParams(cb.searchParams)
  verify.set('openid.mode', 'check_authentication')
  const check = await fetch('https://steamcommunity.com/openid/login', { method: 'POST', body: verify })
  if (!(await check.text()).includes('is_valid:true')) throw new Error('Steam n’a pas validé la connexion.')

  const steamId = cb.searchParams.get('openid.claimed_id')?.match(/\/id\/(\d{17})$/)?.[1]
  if (!steamId) throw new Error('Identifiant Steam introuvable.')

  let account: Account = { platform: 'steam', id: steamId, name: `Steam ${steamId}` }
  const { steamApiKey } = getSettings()
  if (steamApiKey) {
    const [profile] = await getSteamProfiles(steamApiKey, [steamId]).catch(() => [])
    if (profile) account = { ...account, name: profile.personaname, avatarUrl: profile.avatarfull }
  }
  saveAccount(account)
  return account
}

// ---------- Discord (OAuth2) ----------

export async function loginDiscord(): Promise<Account> {
  const { discordClientId, discordClientSecret } = getSettings()
  if (!discordClientId || !discordClientSecret) {
    throw new Error('Renseigne le Client ID et le Client Secret Discord dans Paramètres.')
  }
  const redirectUri = `${BASE}/discord/callback`
  const state = randomBytes(16).toString('hex')
  const params = new URLSearchParams({
    client_id: discordClientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'identify',
    state
  })
  const pending = waitForCallback('/discord/callback')
  await shell.openExternal(`https://discord.com/oauth2/authorize?${params}`)
  const cb = await pending
  if (cb.searchParams.get('state') !== state) throw new Error('Réponse Discord invalide.')
  const code = cb.searchParams.get('code')
  if (!code) throw new Error(cb.searchParams.get('error_description') ?? 'Connexion Discord annulée.')

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: discordClientId,
      client_secret: discordClientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  })
  if (!tokenRes.ok) throw new Error(`Discord a refusé le code (${tokenRes.status}).`)
  const { access_token } = (await tokenRes.json()) as { access_token: string }

  const meRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } })
  const me = (await meRes.json()) as { id: string; username: string; global_name?: string; avatar?: string }
  const account: Account = {
    platform: 'discord',
    id: me.id,
    name: me.global_name ?? me.username,
    avatarUrl: me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128` : undefined
  }
  saveAccount(account)
  return account
}
