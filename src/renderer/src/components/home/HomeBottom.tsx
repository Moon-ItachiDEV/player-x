// Derniers patchs des jeux de la bibliothèque, pour l'onglet « Mises à jour » du bloc du jeu à la une.
// (Les anciens blocs du bas de l'accueil, actus et « Tes succès », sont retirés.)
import { useMemo } from 'react'
import type { Game, NewsFeedItem } from '@shared/types'
import { homeFeed } from '../news/feedView'
import { useNewsFeed } from '../news/useNewsFeed'

/** Patchs montés dans l'onglet ; « Toutes les actus » mène au reste. */
const NEWS_MAX = 3

/** Derniers patchs des jeux de la bibliothèque, ou rien (actus coupées, pas encore de relevé, aucun patch récent). */
export function useHomeNews(games: Game[], enabled: boolean, demo: boolean): NewsFeedItem[] {
  const { state } = useNewsFeed(enabled, demo)
  const ids = useMemo(() => new Set(games.map((g) => g.id)), [games])
  return useMemo(
    () =>
      enabled && state.status === 'ready'
        ? homeFeed(
            state.feed.items.filter((i) => ids.has(i.gameId)),
            Date.now()
          ).slice(0, NEWS_MAX)
        : [],
    [enabled, state, ids]
  )
}
