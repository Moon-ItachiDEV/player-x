import type { Friend, Game } from '@shared/types'

// Données fictives pour voir l'interface sans compte ni jeu installé (Paramètres > Avancé > Mode démo).
const steam = (appId: string, name: string): Game => ({
  id: `steam:${appId}`,
  store: 'steam',
  storeId: appId,
  name,
  installDir: `C:\\Program Files (x86)\\Steam\\steamapps\\common\\${name}`,
  coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
  heroUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_hero.jpg`
})

const BASE_GAMES: Game[] = [
  steam('1245620', 'ELDEN RING'),
  steam('730', 'Counter-Strike 2'),
  steam('1091500', 'Cyberpunk 2077'),
  steam('570', 'Dota 2'),
  steam('1086940', "Baldur's Gate 3"),
  steam('413150', 'Stardew Valley'),
  steam('1145360', 'Hades'),
  steam('892970', 'Valheim'),
  { id: 'epic:Fortnite', store: 'epic', storeId: 'fn:4fe75bbc5a674f4f9b356b5c90567da5:Fortnite', name: 'Fortnite' },
  { id: 'epic:RocketLeague', store: 'epic', storeId: 'sugar:9773aa1aa54f4f7b80e44bef04986cea:Sugar', name: 'Rocket League' },
  { id: 'epic:AlanWake2', store: 'epic', storeId: 'demo:alanwake2:AlanWake2', name: 'Alan Wake 2' },
  { id: 'ea:apex', store: 'ea', storeId: 'Origin.OFR.50.0002694', name: 'Apex Legends', installDir: 'C:\\Program Files\\EA Games\\Apex' },
  { id: 'ea:fc', store: 'ea', storeId: 'Origin.OFR.50.0005456', name: 'EA SPORTS FC™ 27', installDir: 'C:\\Program Files\\EA Games\\EA SPORTS FC 27' },
  { id: 'ea:bf6', store: 'ea', storeId: 'Origin.OFR.50.0005577', name: 'Battlefield™ 6', installDir: 'C:\\Program Files\\EA Games\\Battlefield 6' }
]

// Historique fictif : [id, il y a combien d'heures, nombre de lancements, favori, minutes jouées]
const HISTORY: [string, number, number, boolean, number][] = [
  ['steam:1245620', 2, 23, true, 7_390],
  ['ea:bf6', 26, 12, true, 2_745],
  ['steam:730', 50, 41, false, 11_820],
  ['steam:1086940', 120, 9, true, 1_960],
  ['epic:RocketLeague', 200, 15, false, 1_310],
  ['steam:413150', 500, 4, false, 385]
]

export function demoGames(now = Date.now()): Game[] {
  return BASE_GAMES.map((g) => {
    const h = HISTORY.find(([id]) => id === g.id)
    if (!h) return { ...g, launches: 0 }
    return { ...g, lastPlayed: now - h[1] * 3600_000, launches: h[2], favorite: h[3], playtime: h[4], playtimeSource: g.store === 'steam' ? 'steam' : 'local' }
  })
}

/** Ids des jeux fictifs, pour les retrouver dans la base. */
export const DEMO_GAMES = BASE_GAMES

const avatar = (seed: string): string => `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`

export const DEMO_FRIENDS: Friend[] = [
  { id: 'steam:1', platform: 'steam', name: 'NeoKai', avatarUrl: avatar('NeoKai'), status: 'in-game', game: 'ELDEN RING' },
  { id: 'steam:9', platform: 'steam', name: 'Valkyr', avatarUrl: avatar('Valkyr'), status: 'in-game', game: 'ELDEN RING' },
  { id: 'psn:3', platform: 'psn', name: 'ShadowFox_93', avatarUrl: avatar('ShadowFox'), status: 'in-game', game: 'EA SPORTS FC 27', device: 'PS5' },
  { id: 'discord:2', platform: 'discord', name: 'Lunaa', avatarUrl: avatar('Lunaa'), status: 'in-game', game: 'Valorant' },
  { id: 'steam:4', platform: 'steam', name: 'Pixel', avatarUrl: avatar('Pixel'), status: 'online' },
  { id: 'discord:5', platform: 'discord', name: 'Mira', avatarUrl: avatar('Mira'), status: 'online' },
  { id: 'psn:10', platform: 'psn', name: 'Okami_X', avatarUrl: avatar('Okami'), status: 'online', device: 'PS5' },
  { id: 'steam:6', platform: 'steam', name: 'Draxx', avatarUrl: avatar('Draxx'), status: 'away' },
  { id: 'psn:7', platform: 'psn', name: 'KenjiPlays', avatarUrl: avatar('Kenji'), status: 'offline' },
  { id: 'steam:8', platform: 'steam', name: 'Orbit', avatarUrl: avatar('Orbit'), status: 'offline' },
  { id: 'steam:11', platform: 'steam', name: 'Nova', avatarUrl: avatar('Nova'), status: 'offline' }
]
