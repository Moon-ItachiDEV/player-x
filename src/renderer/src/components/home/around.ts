// Qui est là, pour l'accueil : amis en ligne (bandeau du jeu à la une) et joueurs d'un jeu (cartes « À reprendre »).
// Module pur, sans React : testé sous Node seul (npm run test:home).
import { norm, plural } from '@shared/text'
import type { Friend, FriendStatus, Game } from '@shared/types'

/** Amis (et membres Discord) en train de jouer à ce jeu. */
export function playersOf(game: Game, friends: Friend[]): Friend[] {
  const key = norm(game.name)
  return friends.filter((f) => f.status === 'in-game' && !!f.game && norm(f.game) === key)
}

/** « 2 amis y jouent », « 1 ami et 1 membre Discord y jouent ». Les membres d'un serveur Discord ne sont pas des amis. */
export function playersLabel(players: Friend[]): string {
  const n = players.length
  const pals = players.filter((p) => p.platform !== 'discord').length
  const members = n - pals
  const parts = [pals ? plural(pals, 'ami', 'amis') : '', members ? plural(members, 'membre Discord', 'membres Discord') : ''].filter(Boolean)
  return `${parts.join(' et ')} ${n > 1 ? 'y jouent' : 'y joue'}`
}

/** Personnes en ligne autour du jeu à la une. */
export interface Around {
  /** `members` : seulement des membres d'un serveur Discord (« Membres en ligne »). */
  kind: 'friends' | 'members'
  /** Sur ce jeu, en jeu ailleurs, en ligne, absents ; puis par nom. */
  people: Friend[]
  /** Ids de ceux qui jouent à ce jeu. */
  here: ReadonlySet<string>
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
const RANK: Record<FriendStatus, number> = { 'in-game': 1, online: 2, away: 3, offline: 4 }

/**
 * Amis Steam et PlayStation en jeu, en ligne ou absents (les mêmes qu'en haut de la liste d'amis).
 * Les membres Discord ne comptent que s'ils jouent à ce jeu, ou si la liste n'a aucun ami Steam ou PlayStation.
 * null : personne.
 */
export function whoIsAround(game: Game, friends: Friend[]): Around | null {
  const key = norm(game.name)
  const isHere = (f: Friend): boolean => f.status === 'in-game' && !!f.game && norm(f.game) === key
  const noPals = !friends.some((f) => f.platform !== 'discord')
  const people = friends.filter((f) => {
    if (f.status === 'offline') return false
    if (f.platform !== 'discord') return !f.presenceUnknown
    return noPals || isHere(f)
  })
  if (!people.length) return null
  const here = new Set(people.filter(isHere).map((f) => f.id))
  // Un membre Discord « en jeu » sur autre chose qu'un jeu reconnu (Spotify, statut perso…) compte comme en ligne.
  const rank = (f: Friend): number => (here.has(f.id) ? 0 : f.platform === 'discord' && f.status === 'in-game' ? RANK.online : RANK[f.status])
  people.sort((a, b) => rank(a) - rank(b) || collator.compare(a.name, b.name))
  return { kind: people.some((f) => f.platform !== 'discord') ? 'friends' : 'members', people, here }
}

/** « 7 amis en ligne, dont 2 sur ce jeu », « 6 amis et 1 membre Discord en ligne », « 3 membres Discord en ligne ». */
export function aroundLabel(a: Around): string {
  const members = a.people.filter((p) => p.platform === 'discord').length
  const pals = a.people.length - members
  const parts = [pals ? plural(pals, 'ami', 'amis') : '', members ? plural(members, 'membre Discord', 'membres Discord') : ''].filter(Boolean)
  return `${parts.join(' et ')} en ligne${a.here.size ? `, dont ${a.here.size} sur ce jeu` : ''}`
}
