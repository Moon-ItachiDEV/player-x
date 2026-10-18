import { useCallback, useEffect, useRef, useState } from 'react'
import { cleanName, norm } from '@shared/text'
import type { FriendAlert, Game } from '@shared/types'
import { Avatar } from './ui/Avatar'
import { Cover } from './ui/Cover'
import { Icon } from './ui/Icon'
import { StoreTag } from './ui/StoreTag'
import './friendalerts.css'

// Cartes « un ami vient de se connecter / de lancer un jeu », en haut à droite, quand Player X est au premier plan.
// Quand la fenêtre est en arrière-plan, c'est Windows qui affiche la notification (processus principal).

const api = window.launcher
const LIFETIME_MS = 7_000
const MAX_SHOWN = 3
/** Durée de la sortie (doit suivre friendalerts.css). */
const LEAVE_MS = 260

interface Shown extends FriendAlert {
  leaving?: boolean
}

export function FriendAlerts({ games, onShowFriends }: { games: Game[]; onShowFriends: () => void }): React.JSX.Element | null {
  const [items, setItems] = useState<Shown[]>([])

  const dismiss = useCallback((key: string) => {
    setItems((list) => list.map((a) => (a.key === key ? { ...a, leaving: true } : a)))
    setTimeout(() => setItems((list) => list.filter((a) => a.key !== key)), LEAVE_MS)
  }, [])

  useEffect(
    () =>
      api.onFriendAlert((alerts) =>
        // Les plus récentes en haut ; au-delà de trois, les plus anciennes partent.
        setItems((list) => [...alerts.slice().reverse(), ...list].slice(0, MAX_SHOWN + 2))
      ),
    []
  )

  if (!items.length) return null
  const visible = items.slice(0, MAX_SHOWN)
  const hidden = items.length - visible.length

  return (
    <div className="fa-stack" role="region" aria-label="Activité de tes amis" aria-live="polite">
      {visible.map((a, i) => (
        <AlertCard
          key={a.key}
          alert={a}
          index={i}
          game={a.kind === 'in-game' && a.friend.game ? games.find((g) => norm(g.name) === norm(a.friend.game!)) : undefined}
          onOpen={() => {
            onShowFriends()
            dismiss(a.key)
          }}
          onClose={() => dismiss(a.key)}
        />
      ))}
      {hidden > 0 && (
        <p className="caption fa-more">
          + {hidden} autre{hidden > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

interface CardProps {
  alert: Shown
  index: number
  game?: Game
  onOpen: () => void
  onClose: () => void
}

function AlertCard({ alert, index, game, onOpen, onClose }: CardProps): React.JSX.Element {
  const { friend, kind } = alert
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [paused, setPaused] = useState(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  const start = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => closeRef.current(), LIFETIME_MS)
  }, [])
  useEffect(() => {
    start()
    return () => clearTimeout(timer.current)
  }, [start])

  const inGame = kind === 'in-game'
  return (
    <article
      className={`fa-card ${inGame ? 'is-ingame' : 'is-online'} ${alert.leaving ? 'is-leaving' : ''} ${paused ? 'is-paused' : ''}`}
      style={{ '--i': index, '--life': `${LIFETIME_MS}ms` } as React.CSSProperties}
      onMouseEnter={() => {
        clearTimeout(timer.current)
        setPaused(true)
      }}
      onMouseLeave={() => {
        setPaused(false)
        start()
      }}
    >
      {inGame && game && (
        <div className="fa-art" aria-hidden="true">
          <Cover key={game.id} game={game} variant="landscape" showTitle={false} />
        </div>
      )}
      <button className="fa-main" onClick={onOpen} title="Voir tes amis">
        <span className="fa-avatar">
          <Avatar name={friend.name} url={friend.avatarUrl} size={40} status={inGame ? 'in-game' : 'online'} />
        </span>
        <span className="fa-text">
          <span className="fa-name">
            {friend.name}
            <StoreTag kind={friend.platform} size={16} className="fa-pf" />
          </span>
          <span className="fa-what">
            {inGame ? (
              <>
                a lancé <strong className="fa-game">{cleanName(friend.game ?? '')}</strong>
              </>
            ) : (
              'vient de se connecter'
            )}
          </span>
          {alert.sample && <span className="caption fa-sample">Alerte d’exemple</span>}
        </span>
      </button>
      <button className="icon-btn fa-close" onClick={onClose} aria-label="Fermer" title="Fermer">
        <Icon name="x" size={14} />
      </button>
      <span className="fa-life" aria-hidden="true" />
    </article>
  )
}
