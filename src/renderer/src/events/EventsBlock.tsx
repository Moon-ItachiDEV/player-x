// Événements d'un jeu dans sa fiche (onglet Actus) : ce qui se passe en ce moment et ce qui arrive, avec « Me prévenir ».
// Seulement ce que l'éditeur a publié sur la page Steam du jeu ; rien quand il n'y a rien.
import { eventDates, eventLabel, eventWhen } from '@shared/gameEvents'
import type { GameEvent } from '@shared/types'
import { Icon } from '../components/ui/Icon'
import type { EventsInfo } from './useGameEvents'
import './events.css'

const MAX = 4

export function EventsBlock({ info }: { info: EventsInfo }): React.JSX.Element | null {
  const { events, reminders, toggleReminder } = info
  if (!events.length) return null
  const now = Date.now()
  return (
    <section className="ev-block" aria-labelledby="ev-block-h">
      <h3 id="ev-block-h" className="ev-block-h">
        <Icon name="calendar" size={16} />
        En ce moment et à venir
      </h3>
      <ul className="ev-list">
        {events.slice(0, MAX).map((e) => (
          <EventRow key={e.id} e={e} now={now} reminded={reminders.has(e.id)} onRemind={() => toggleReminder(e)} />
        ))}
      </ul>
    </section>
  )
}

function EventRow({ e, now, reminded, onRemind }: { e: GameEvent; now: number; reminded: boolean; onRemind: () => void }): React.JSX.Element {
  const when = eventWhen(e, now)
  return (
    <li className={`ev-row ${when.live ? 'is-live' : ''}`}>
      <span className="ev-text">
        <span className="ev-kind">
          {when.live && <span className="ev-dot" aria-hidden="true" />}
          {eventLabel(e.type)} · {when.text}
        </span>
        <span className="ev-title">{e.title}</span>
        <span className="ev-dates">{eventDates(e)}</span>
      </span>
      <span className="ev-actions">
        {!when.live && (
          <button type="button" className={`btn btn-sm ${reminded ? 'btn-secondary is-on' : 'btn-secondary'}`} aria-pressed={reminded} onClick={onRemind}>
            <Icon name={reminded ? 'check' : 'bell'} size={14} />
            {reminded ? 'On te prévient' : 'Me prévenir'}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void window.launcher.openExternal(e.url)}>
          Voir sur Steam
          <Icon name="external-link" size={13} />
        </button>
      </span>
    </li>
  )
}
