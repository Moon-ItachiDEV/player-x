import { useCallback, useEffect, useRef, useState } from 'react'
import type { NewsFeed } from '@shared/types'
import { errorMessage } from '../ui/Toasts'

export type FeedState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; feed: NewsFeed }

export interface NewsFeedHook {
  state: FeedState
  /** « Actualiser » en cours. */
  refreshing: boolean
  /** Redemande les dernières annonces à Steam. */
  refresh: () => Promise<void>
  markAllSeen: () => Promise<void>
}

/**
 * Relevé des actus de tous les jeux (rangée de l'accueil, page Actus des jeux). Relu à chaque changement des jeux
 * (badges, relevé, « vu »). Une relecture garde le relevé affiché : seul le premier chargement montre « loading », et
 * une erreur ne remplace pas un relevé déjà là (sinon la rangée et la page clignoteraient à chaque changement).
 */
export function useNewsFeed(enabled: boolean, demo: boolean): NewsFeedHook {
  const [state, setState] = useState<FeedState>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  // Numéro de la dernière demande : les changements arrivent en rafale, une réponse plus ancienne est ignorée.
  const seq = useRef(0)

  const apply = useCallback((request: Promise<NewsFeed>): Promise<void> => {
    const n = ++seq.current
    return request.then(
      (feed) => {
        if (n === seq.current) setState({ status: 'ready', feed })
      },
      (e) => {
        if (n === seq.current) setState((prev) => (prev.status === 'ready' ? prev : { status: 'error', message: errorMessage(e) }))
      }
    )
  }, [])

  // Le mode démo change la bibliothèque sans « jeux changés » : relu aussi quand il bascule.
  useEffect(() => {
    if (!enabled) return
    const load = (): void => void apply(window.launcher.getNewsFeed())
    load()
    const off = window.launcher.onGamesChanged(load)
    return () => {
      off()
      // Réponses en vol : ignorées (démontage, ou double effet de StrictMode).
      seq.current++
    }
  }, [enabled, demo, apply])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await apply(window.launcher.refreshNewsFeed())
    } finally {
      setRefreshing(false)
    }
  }, [apply])

  const markAllSeen = useCallback(async () => {
    try {
      await window.launcher.markAllNewsSeen()
    } finally {
      await apply(window.launcher.getNewsFeed())
    }
  }, [apply])

  return { state, refreshing, refresh, markAllSeen }
}
