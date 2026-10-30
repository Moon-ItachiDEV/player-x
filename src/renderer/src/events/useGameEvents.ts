// Événements d'un jeu (saisons, bonus d'XP…, page Steam du jeu) et « Me prévenir ». Le processus principal garde la
// liste 30 min : un jeu revu (Accueil, fiche) ne redemande rien à Steam.
import { useCallback, useEffect, useState } from 'react'
import type { Game, GameEvent } from '@shared/types'
import { errorMessage, useToast } from '../components/ui/Toasts'

export interface EventsInfo {
  events: GameEvent[]
  reminders: ReadonlySet<string>
  /** « Me prévenir » ou l'annuler ; une carte dit ce qui s'est passé. */
  toggleReminder: (e: GameEvent) => void
}

/** `delay` : attendre avant de demander (l'Accueil, où l'on fait défiler les jeux). */
export function useGameEvents(game: Game | null, enabled: boolean, delay = 0): EventsInfo {
  const notify = useToast()
  const id = enabled && game ? game.id : null
  const [data, setData] = useState<{ id: string; events: GameEvent[]; reminders: string[] } | null>(null)

  useEffect(() => {
    if (!id) return
    let live = true
    const t = setTimeout(() => {
      window.launcher
        .getGameEvents(id)
        .then((r) => {
          if (live) setData({ id, events: r.events, reminders: r.reminders })
        })
        .catch(() => {
          if (live) setData({ id, events: [], reminders: [] })
        })
    }, delay)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [id, delay])

  const shown = data && data.id === id ? data : null
  const toggleReminder = useCallback(
    (e: GameEvent) => {
      if (!id) return
      const on = !shown?.reminders.includes(e.id)
      window.launcher
        .setEventReminder(id, e.id, on)
        .then((reminders) => {
          setData((d) => (d && d.id === id ? { ...d, reminders } : d))
          notify(on ? `Player X te préviendra au début de « ${e.title} »` : `Rappel retiré : ${e.title}`, { kind: on ? 'success' : 'info', id: `remind:${e.id}` })
        })
        .catch((err) => notify(errorMessage(err), { kind: 'error' }))
    },
    [id, shown, notify]
  )

  return { events: shown?.events ?? [], reminders: new Set(shown?.reminders ?? []), toggleReminder }
}
