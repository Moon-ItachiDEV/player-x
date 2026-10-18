import type { Friend, Game } from '@shared/types'

// Données fictives pour voir l'interface sans compte ni jeu installé (Paramètres > Mode démo).
const steam = (appId: string, name: string): Game => ({
  id: `steam:${appId}`,
  store: 'steam',
  storeId: appId,
  name,
  coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
  heroUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_hero.jpg`
})

export const DEMO_GAMES: Game[] = [
  steam('1245620', 'ELDEN RING'),
  steam('730', 'Counter-Strike 2'),
  steam('1091500', 'Cyberpunk 2077'),
  steam('570', 'Dota 2'),
  steam('1086940', "Baldur's Gate 3"),
  steam('413150', 'Stardew Valley'),
  { id: 'epic:Fortnite', store: 'epic', storeId: 'fn:4fe75bbc5a674f4f9b356b5c90567da5:Fortnite', name: 'Fortnite' },
  { id: 'epic:RocketLeague', store: 'epic', storeId: 'sugar:9773aa1aa54f4f7b80e44bef04986cea:Sugar', name: 'Rocket League' },
  { id: 'ea:apex', store: 'ea', storeId: 'Origin.OFR.50.0002694', name: 'Apex Legends' },
  { id: 'ea:fc', store: 'ea', storeId: 'Origin.OFR.50.0005456', name: 'EA SPORTS FC 25' }
]

const avatar = (seed: string): string => `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`

export const DEMO_FRIENDS: Friend[] = [
  { id: 'steam:1', platform: 'steam', name: 'NeoKai', avatarUrl: avatar('NeoKai'), status: 'in-game', game: 'ELDEN RING' },
  { id: 'discord:2', platform: 'discord', name: 'Lunaa', avatarUrl: avatar('Lunaa'), status: 'in-game', game: 'Valorant' },
  { id: 'psn:3', platform: 'psn', name: 'ShadowFox_93', avatarUrl: avatar('ShadowFox'), status: 'in-game', game: 'EA SPORTS FC 25', device: 'PS5' },
  { id: 'steam:4', platform: 'steam', name: 'Pixel', avatarUrl: avatar('Pixel'), status: 'online' },
  { id: 'discord:5', platform: 'discord', name: 'Mira', avatarUrl: avatar('Mira'), status: 'online' },
  { id: 'steam:6', platform: 'steam', name: 'Draxx', avatarUrl: avatar('Draxx'), status: 'away' },
  { id: 'psn:7', platform: 'psn', name: 'KenjiPlays', avatarUrl: avatar('Kenji'), status: 'offline' },
  { id: 'steam:8', platform: 'steam', name: 'Orbit', avatarUrl: avatar('Orbit'), status: 'offline' }
]
