import { useEffect, useRef, useState } from 'react'
import type { AchievementsOverview, GameAchievements } from '@shared/types'
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

/** Pendant le relevé, la page se remplit : relue toutes les 1,5 s. */
const SCAN_POLL_MS = 1500

/** Page Trophées : le résumé de tous les jeux Steam joués. `refresh` relance le relevé. */
export function useAchievementsOverview(): { data: AchievementsOverview | null; error: string | null; refresh: () => void } {
  const [data, setData] = useState<AchievementsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const force = useRef(false)

  useEffect(() => {
    let alive = true
    const refresh = force.current
    force.current = false
    window.launcher.getAchievementsOverview(refresh).then(
      (o) => {
        if (!alive) return
        setData(o)
        setError(null)
      },
      (e) => alive && setError(errorMessage(e))
    )
    return () => {
      alive = false
    }
  }, [tick])

  const scanning = data?.state === 'scanning'
  useEffect(() => {
    if (!scanning) return
    const t = setTimeout(() => setTick((n) => n + 1), SCAN_POLL_MS)
    return () => clearTimeout(t)
  }, [scanning, data])

  return {
    data,
    error,
    refresh: () => {
      force.current = true
      setTick((n) => n + 1)
    }
  }
}
