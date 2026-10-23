// « Dernier match » de l'accueil : bilans Counter-Strike 2 et Battlefield 6 gardés sur ce PC, relus quand un bilan arrive,
// change ou est ouvert. Vides en mode démo : l'encart est alors masqué.
import { useEffect, useState } from 'react'
import type { Bf6RecapState, Cs2State } from '@shared/types'
import { shownCs2 } from '../cs2/useCs2'
import { latestMatch, type LastMatch } from './pick'

const api = window.launcher

export function useLastMatch(): LastMatch | null {
  const [cs2, setCs2] = useState<Cs2State | null>(null)
  const [bf6, setBf6] = useState<Bf6RecapState | null>(null)

  useEffect(() => {
    let alive = true
    const loadCs2 = (): void => {
      api
        .cs2State()
        .then((s) => alive && setCs2(s))
        .catch(() => {})
    }
    const loadBf6 = (): void => {
      api
        .bf6Recaps()
        .then((s) => alive && setBf6(s))
        .catch(() => {})
    }
    loadCs2()
    loadBf6()
    const offs = [api.onCs2State(loadCs2), api.onCs2Recap(loadCs2), shownCs2.subscribe(loadCs2), api.onBf6Recap(loadBf6), api.onBf6RecapState(loadBf6)]
    return () => {
      alive = false
      for (const off of offs) off()
    }
  }, [])

  return latestMatch(cs2, bf6)
}
