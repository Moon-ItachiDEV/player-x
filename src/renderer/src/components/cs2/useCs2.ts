// Counter-Strike 2 dans l'interface : état de la liaison, match en direct et bilans, tenus à jour par le processus
// principal (services/cs2Live.ts). Partagé par la fiche de CS2, la carte du bilan et Paramètres.
import { useEffect, useState } from 'react'
import { capitalize } from '@shared/text'
import type { Cs2Live, Cs2Recap, Cs2State } from '@shared/types'
import { createStore } from '../../update/session'

const api = window.launcher

/** Bilan affiché, un seul à la fois. */
export const shownCs2 = createStore<Cs2Recap | null>(null)

/** Ouvre la carte d'un bilan. Un vrai bilan ouvert n'est plus proposé. */
export function openCs2Recap(recap: Cs2Recap): void {
  shownCs2.set(recap)
  if (recap.sample || recap.seen) return
  // Une fois enregistré comme vu, la carte ouverte change d'objet : les listes la relisent sans « Nouveau ».
  api
    .cs2RecapSeen(recap.id)
    .then(() => shownCs2.set((cur) => (cur?.id === recap.id ? { ...cur, seen: true } : cur)))
    .catch(() => {})
}

/** État complet, relu quand la liaison ou les bilans changent ; le match en direct arrive à part, au plus une fois par seconde. */
export function useCs2(): { state: Cs2State | null; live: Cs2Live | null } {
  const [state, setState] = useState<Cs2State | null>(null)
  const [live, setLive] = useState<Cs2Live | null>(null)
  useEffect(() => {
    let alive = true
    const load = (): void => {
      api
        .cs2State()
        .then((s) => {
          if (!alive) return
          setState(s)
          setLive(s.live)
        })
        .catch(() => {})
    }
    load()
    const offState = api.onCs2State(load)
    const offRecap = api.onCs2Recap(load)
    const offLive = api.onCs2Live((l) => alive && setLive(l))
    const offShown = shownCs2.subscribe(load)
    return () => {
      alive = false
      offState()
      offRecap()
      offLive()
      offShown()
    }
  }, [])
  return { state, live }
}

/** Exemple : chiffres fictifs, toujours présentés comme tels. Un match compétitif 13–9 sur Mirage. */
export function sampleCs2Recap(): Cs2Recap {
  const endedAt = Date.now() - 2 * 60_000
  const script: [string, number][] = [
    ['ct_win_elimination', 1],
    ['ct_win_elimination', 2],
    ['t_win_elimination', 0],
    ['ct_win_elimination', 3],
    ['ct_win_time', 1],
    ['ct_win_elimination', 2],
    ['ct_win_defuse', 1],
    ['t_win_bomb', 0],
    ['t_win_elimination', 1],
    ['t_win_elimination', 2],
    ['t_win_elimination', 0],
    ['ct_win_elimination', 1],
    ['ct_win_elimination', 0],
    ['t_win_elimination', 4],
    ['t_win_bomb', 2],
    ['t_win_elimination', 1],
    ['t_win_elimination', 1],
    ['ct_win_elimination', 0],
    ['t_win_bomb', 3],
    ['ct_win_time', 0],
    ['ct_win_elimination', 1],
    ['t_win_elimination', 1]
  ]
  return {
    id: 'cs2-sample',
    sample: true,
    steamId: '0',
    map: 'de_mirage',
    mode: 'competitive',
    startedAt: endedAt - 48 * 60_000,
    endedAt,
    result: 'win',
    score: { us: 13, them: 9 },
    kills: 27,
    deaths: 14,
    assists: 5,
    mvps: 4,
    points: 61,
    headshots: 12,
    damage: 2_380,
    trackedKills: 27,
    roundsTracked: 22,
    multi: { k3: 2, k4: 1, k5: 0 },
    best: { n: 14, kills: 4, damage: 312 },
    rounds: script.map(([code, kills], i) => {
      const side = i < 12 ? 'CT' : 'T'
      return { n: i + 1, winner: code.startsWith('ct_') ? 'CT' : 'T', end: code.includes('bomb') ? 'bomb' : code.includes('defuse') ? 'defuse' : code.includes('time') ? 'time' : 'elimination', side, kills }
    }),
    hasRounds: true
  }
}

// ---------- dates ----------

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
export const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** « Aujourd'hui », « Hier », « Samedi 17 octobre » */
export function dayOf(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Aujourd’hui'
  if (d.toDateString() === new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString()) return 'Hier'
  return capitalize(dayFmt.format(d))
}

/** « 48 min », « 1 h 05 » */
export function minutes(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000))
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}
