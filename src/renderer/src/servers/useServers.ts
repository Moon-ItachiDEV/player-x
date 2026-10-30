// Serveurs, côté interface : l'état de CS2 selon Valve et les joueurs en jeu sur Steam. Demandés seulement quand un
// écran les montre et que la fenêtre est visible ; le processus principal les garde 5 min.
import { useEffect, useState } from 'react'
import type { Cs2Servers, Game, SteamPlayers } from '@shared/types'
import './servers.css'

const EVERY_MS = 5 * 60_000

/** Relit `load` tout de suite, puis toutes les 5 min et au retour de la fenêtre, tant que `enabled`. */
function usePolled<T>(enabled: boolean, key: string, load: () => Promise<T | null>): T | null {
  const [value, setValue] = useState<{ key: string; v: T } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    const run = (): void => {
      if (document.visibilityState !== 'visible') return
      load()
        .then((v) => {
          if (live) setValue(v === null ? null : { key, v })
        })
        .catch(() => {
          if (live) setValue(null)
        })
    }
    run()
    const t = setInterval(run, EVERY_MS)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      live = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // `load` change à chaque rendu : seule la clé compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])
  return enabled && value?.key === key ? value.v : null
}

/** État des serveurs de CS2 (null : pas de clé, hors ligne, ou pas demandé). */
export function useCs2Servers(enabled: boolean): Cs2Servers | null {
  return usePolled(enabled, 'cs2', () => window.launcher.cs2Servers().then((r) => (r.ok ? r.servers : null)))
}

/** Joueurs en jeu sur Steam pour ce jeu (jeux Steam installés ou non). */
export function useSteamPlayers(game: Game | null): SteamPlayers | null {
  const id = game?.store === 'steam' ? game.id : ''
  return usePolled(!!id, id, () => window.launcher.steamPlayers(id))
}
