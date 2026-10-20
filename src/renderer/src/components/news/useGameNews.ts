import { useEffect, useState } from 'react'
import type { GameNews } from '@shared/types'
import { errorMessage } from '../ui/Toasts'

export type NewsState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; news: GameNews }

/** Actus d'un jeu, lues à l'ouverture de sa fiche. `reload` relit Steam (sans le cache de 30 min). */
export function useGameNews(gameId: string, enabled: boolean): { state: NewsState; reload: () => void } {
  const [state, setState] = useState<NewsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // Nouveau jeu : on repart du chargement (pas d'actus d'un autre jeu, même un instant).
  const [shownFor, setShownFor] = useState(gameId)
  if (shownFor !== gameId) {
    setShownFor(gameId)
    setState({ status: 'loading' })
    setAttempt(0)
  }

  useEffect(() => {
    if (!enabled) return
    let alive = true
    window.launcher.getGameNews(gameId, attempt > 0).then(
      (news) => alive && setState({ status: 'ready', news }),
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
