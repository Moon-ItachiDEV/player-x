import { useEffect, useState } from 'react'
import type { GameAchievements } from '@shared/types'
import { errorMessage } from '../ui/Toasts'

export type AchievementsLoad = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: GameAchievements }

/** Succès Steam d'un jeu, lus à l'ouverture de sa fiche. `reload` relit Steam (sans le cache de 10 min). */
export function useAchievements(gameId: string, enabled: boolean): { state: AchievementsLoad; reload: () => void } {
  const [state, setState] = useState<AchievementsLoad>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // Nouveau jeu : on repart du chargement (pas les succès d'un autre jeu, même un instant).
  const [shownFor, setShownFor] = useState(gameId)
  if (shownFor !== gameId) {
    setShownFor(gameId)
    setState({ status: 'loading' })
    setAttempt(0)
  }

  useEffect(() => {
    if (!enabled) return
    let alive = true
    window.launcher.getAchievements(gameId, attempt > 0).then(
      (data) => alive && setState({ status: 'ready', data }),
      (e) => alive && setState({ status: 'error', message: errorMessage(e) })
    )
    return () => {
      alive = false
    }
  }, [gameId, enabled, attempt])

  return {
    state,
    reload: () => {
      setState({ status: 'loading' })
      setAttempt((n) => n + 1)
    }
  }
}
