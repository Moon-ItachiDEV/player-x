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

// Parties jouées hors de Player X : [id, il y a combien d'heures, source, minutes jouées]
const PLAYED_ELSEWHERE: [string, number, 'steam' | 'session', number][] = [
  ['steam:1091500', 31, 'steam', 4_210], // Cyberpunk 2077 : hier, via Steam
  ['epic:Fortnite', 70, 'session', 540], // lancé depuis Epic, vu par Player X
  ['steam:1145360', 216, 'steam', 1_420], // Hades
  ['ea:apex', 290, 'session', 610],
  ['steam:570', 960, 'steam', 15_600], // Dota 2
  ['steam:892970', 1_800, 'steam', 2_900] // Valheim
]

export function demoGames(now = Date.now()): Game[] {
  return BASE_GAMES.map((g) => {
    const h = HISTORY.find(([id]) => id === g.id)
    if (h)
      return {
        ...g,
        lastPlayed: now - h[1] * 3600_000,
        lastPlayedSource: 'launch' as const,
        launches: h[2],
        favorite: h[3],
        playtime: h[4],
        playtimeSource: g.store === 'steam' ? 'steam' : 'local'
      }
    const e = PLAYED_ELSEWHERE.find(([id]) => id === g.id)
    if (e) return { ...g, lastPlayed: now - e[1] * 3600_000, lastPlayedSource: e[2], launches: 0, playtime: e[3], playtimeSource: e[2] === 'steam' ? 'steam' : 'local' }
    // Alan Wake 2, EA SPORTS FC 27 : aucune partie connue.
    return { ...g, launches: 0 }
  })
}

/** Ids des jeux fictifs, pour les retrouver dans la base. */
export const DEMO_GAMES = BASE_GAMES

// Jeux du compte Steam fictif qui ne sont pas installés : [appid, nom, minutes jouées, dernière partie il y a combien de jours (0 : jamais)]
const NOT_INSTALLED: [string, string, number, number][] = [
  ['1174180', 'Red Dead Redemption 2', 3_120, 64],
  ['2379780', 'Balatro', 650, 12],
  ['105600', 'Terraria', 4_980, 122],
  ['367520', 'Hollow Knight', 2_350, 300],
  ['374320', 'DARK SOULS™ III', 2_810, 410],
  ['814380', 'Sekiro™: Shadows Die Twice - GOTY Edition', 1_520, 530],
  ['620', 'Portal 2', 1_140, 700],
  ['546560', 'Half-Life: Alyx', 0, 0],
  ['1817070', "Marvel's Spider-Man Remastered", 0, 0],
  ['1888930', 'The Last of Us™ Part I', 0, 0]
]

/** Jeux Steam fictifs non installés (onglet « Non installés ») : « Installer » n'ouvre pas Steam en mode démo. */
export function demoNotInstalled(now = Date.now()): Game[] {
  return NOT_INSTALLED.map(([appId, name, minutes, days]) => ({
    id: `steam:${appId}`,
    store: 'steam',
    storeId: appId,
    name,
    notInstalled: true,
    ...(days ? { lastPlayed: now - days * 24 * 3600_000, lastPlayedSource: 'steam' as const } : {}),
    ...(minutes ? { playtime: minutes, playtimeSource: 'steam' as const } : {})
  }))
}

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
  { id: 'steam:11', platform: 'steam', name: 'Nova', avatarUrl: avatar('Nova'), status: 'offline' },
  { id: 'steam:12', platform: 'steam', name: 'Rook', avatarUrl: avatar('Rook'), status: 'in-game', game: 'Counter-Strike 2' },
  // Bots d'un serveur Discord : masqués d'office (discordMembers.ts), listés dans Paramètres › Comptes.
  { id: 'discord:12', platform: 'discord', name: 'MonitoRSS', avatarUrl: avatar('MonitoRSS'), status: 'online' },
  { id: 'discord:13', platform: 'discord', name: 'PatchBot', avatarUrl: avatar('PatchBot'), status: 'online' },
  { id: 'discord:14', platform: 'discord', name: 'Soundboards.gg', avatarUrl: avatar('Soundboards'), status: 'online' },
  { id: 'discord:15', platform: 'discord', name: 'MEE6', avatarUrl: avatar('MEE6'), status: 'online' }
]
