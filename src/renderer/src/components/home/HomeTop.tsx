// Barre du haut de l'Accueil (après « Bonsoir, … ») : ce qui se passe maintenant, en pastilles cliquables,
// sur le modèle du choix du jeu de Stats. Seulement des faits : chaque pastille disparaît sans donnée.
// - le jeu en cours (→ sa fiche) ;
// - tes amis en jeu, sinon en ligne (→ Amis) ;
// - les nouveaux patchs de tes jeux (→ Actus).
import { useContext, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { cleanName } from '@shared/text'
import type { Friend, Game } from '@shared/types'
import { classify, libraryIndex } from '../friends/friendView'
import { TopSlot } from '../TopTabs'
import { Avatar } from '../ui/Avatar'
import { Cover } from '../ui/Cover'

interface Props {
  games: Game[]
  friends: Friend[]
  /** Actus activées (Paramètres › Bibliothèque) : sinon pas de pastille de patchs. */
  news: boolean
  onOpen: (g: Game) => void
  onShowFriends: () => void
  onShowNews: () => void
}

const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`

export function HomeTop({ games, friends, news, onOpen, onShowFriends, onShowNews }: Props): React.JSX.Element | null {
  const slot = useContext(TopSlot)
  const running = games.find((g) => g.running)
  const people = useMemo(() => {
    const lib = libraryIndex(games)
    const all = friends.filter((f) => f.platform !== 'discord').map((f) => classify(f, lib))
    const inGame = all.filter((e) => e.status === 'in-game')
    const online = all.filter((e) => e.status === 'online')
    return inGame.length ? { kind: 'in-game' as const, list: inGame } : online.length ? { kind: 'online' as const, list: online } : null
  }, [friends, games])
  const patched = news ? games.filter((g) => g.newPatch) : []

  if (!slot || (!running && !people && !patched.length)) return null
  return createPortal(
    <div className="hm-now" role="group" aria-label="En ce moment">
      {running && (
        <button type="button" className="hm-now-pill is-live" onClick={() => onOpen(running)} title="Voir la fiche du jeu">
          <span className="hm-now-thumb" aria-hidden="true">
            <Cover game={running} variant="landscape" showTitle={false} />
          </span>
          <span className="hm-now-dot" aria-hidden="true" />
          En jeu · {cleanName(running.name)}
        </button>
      )}
      {people && (
        <button type="button" className="hm-now-pill" onClick={onShowFriends} title="Voir tes amis">
          <span className="hm-now-faces" aria-hidden="true">
            {people.list.slice(0, 3).map((e) => (
              <Avatar key={e.friend.id} name={e.friend.name} url={e.friend.avatarUrl} size={24} />
            ))}
          </span>
          {people.kind === 'in-game'
            ? people.list.length === 1
              ? `${people.list[0].friend.name} joue à ${people.list[0].game}`
              : plural(people.list.length, 'ami en jeu', 'amis en jeu')
            : plural(people.list.length, 'ami en ligne', 'amis en ligne')}
        </button>
      )}
      {patched.length > 0 && (
        <button type="button" className="hm-now-pill" onClick={onShowNews} title="Voir les actus de tes jeux">
          <span className="hm-now-thumb" aria-hidden="true">
            <Cover game={patched[0]} variant="landscape" showTitle={false} />
          </span>
          {patched.length === 1 ? `Nouveau patch · ${cleanName(patched[0].name)}` : plural(patched.length, 'nouveau patch', 'nouveaux patchs')}
        </button>
      )}
    </div>,
    slot
  )
}
