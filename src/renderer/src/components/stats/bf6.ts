import { useCallback, useEffect, useRef, useState } from 'react'
import { isBf6Name } from '@shared/text'
import type { Bf6Account, Bf6Platform, Bf6Point, Bf6Snapshot, Game } from '@shared/types'
import { errorMessage } from '../ui/Toasts'

// Outils partagés par la page Stats et la fiche de Battlefield 6.

const api = window.launcher

export const int = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
export const dec = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

export const PLATFORM_LABEL: Record<Bf6Platform, string> = { ea: 'EA', pc: 'PC', steam: 'Steam', psn: 'PlayStation', xbox: 'Xbox' }

export const keyOf = (a: Bf6Account): string => `${a.platform}:${a.personaId ?? a.name.toLowerCase()}`
export const percent = (n: number): string => `${pct.format(n)} %`

/** « 312 h », « 45 min » */
export function duration(seconds: number): string {
  if (seconds < 3600) return `${int.format(Math.round(seconds / 60))} min`
  return `${int.format(Math.round(seconds / 3600))} h`
}

/** Durée lisible pour un écart de temps de jeu (« 31 h 40 »). */
export function playedFor(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${h} h`
}

/** Battlefield 6 dans la bibliothèque, quel que soit le nom exact du store (« Battlefield™ 6 »…). */
export const isBf6Game = (g: Pick<Game, 'name'>): boolean => isBf6Name(g.name)

/** Stats d'un compte, relues à la demande. */
export function useBf6(account: Bf6Account | null): { snap: Bf6Snapshot | null; error: string | null; loading: boolean; refresh: () => void } {
  const [snap, setSnap] = useState<Bf6Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [doneKey, setDoneKey] = useState<string | null>(null)
  const [force, setForce] = useState(0)
  const key = account ? keyOf(account) : ''
  const lastKey = useRef(key)
  const usedForce = useRef(0)

  useEffect(() => {
    // Autre compte (ou plus de compte) : on n'affiche jamais les stats du précédent.
    if (lastKey.current !== key) {
      lastKey.current = key
      setSnap(null)
    }
    setError(null)
    if (!account) {
      setLoading(false)
      setDoneKey(null)
      return
    }
    // Seul le passage lancé par « Actualiser » contourne le cache.
    const refresh = force !== usedForce.current
    usedForce.current = force
    let live = true
    setLoading(true)
    api
      .bf6Stats(account, refresh)
      .then((s) => live && setSnap(s))
      .catch((e) => {
        if (!live) return
        setSnap(null)
        setError(errorMessage(e))
      })
      .finally(() => {
        if (!live) return
        setLoading(false)
        setDoneKey(key)
      })
    return () => {
      live = false
    }
    // Le compte compte par identité : le même compte renvoyé par le stockage ne relance rien.
  }, [key, force])

  // Tant que le compte affiché n'a reçu ni stats ni erreur, il est en cours de chargement (y compris avant le premier effet).
  const pending = !!account && doneKey !== key
  return { snap, error, loading: loading || pending, refresh: useCallback(() => setForce((n) => n + 1), []) }
}

export interface Bf6Summary {
  name: string
  /** « K/D 1,60 » */
  kd?: string
  /** « 53 % de victoires » */
  win?: string
}

/** Résumé de ton compte pour la fiche du jeu. `undefined` : en cours ; `null` : aucun compte relié. */
export function useBf6Summary(): Bf6Summary | null | undefined {
  const [summary, setSummary] = useState<Bf6Summary | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    api
      .bf6GetTracked()
      .then(async ({ me }) => {
        if (!me) return live && setSummary(null)
        try {
          const { stats } = await api.bf6Stats(me)
          if (live) setSummary({ name: stats.account.name, kd: `K/D ${dec.format(stats.killDeath)}`, win: `${int.format(stats.winPercent)} % de victoires` })
        } catch {
          // Service injoignable : le raccourci reste, avec le pseudo seulement.
          if (live) setSummary({ name: me.name })
        }
      })
      .catch(() => live && setSummary(null))
    return () => {
      live = false
    }
  }, [])
  return summary
}

// ---------- relevés quotidiens ----------

/** Relevés d'un compte suivi, relus à chaque nouvelle lecture des stats (le relevé du jour vient peut-être d'être ajouté). */
export function useBf6History(account: Bf6Account | null, fetchedAt?: number): Bf6Point[] | null {
  const [history, setHistory] = useState<Bf6Point[] | null>(null)
  const key = account ? keyOf(account) : ''
  useEffect(() => {
    if (!account) return setHistory(null)
    let alive = true
    api
      .bf6History(account)
      .then((h) => alive && setHistory(h))
      .catch(() => alive && setHistory([]))
    return () => {
      alive = false
    }
    // Le compte compte par identité.
  }, [key, fetchedAt])
  return history
}

/**
 * Relevés des `days` derniers jours (tous si Infinity). Le relevé juste avant la période sert de point de départ,
 * s'il n'est pas trop ancien (sinon « 7 j » afficherait des mois après une longue pause).
 */
export function inWindow(history: Bf6Point[], days: number): Bf6Point[] {
  if (!Number.isFinite(days)) return history
  const since = Date.now() - days * 86_400_000
  const inRange = history.filter((p) => p.at >= since)
  const before = history.filter((p) => p.at < since && p.at >= since - Math.max(2, days / 2) * 86_400_000).at(-1)
  return before ? [before, ...inRange] : inRange
}

export const kdOf = (p: Bf6Point): number => (p.deaths ? p.kills / p.deaths : p.kills)

/** Ce que tu as fait entre le premier et le dernier relevé d'une période (null : moins de deux relevés). */
export function periodOf(points: Bf6Point[]): { kills: number; deaths: number; matches: number; wins: number; seconds: number; kdChange: number } | null {
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last || points.length < 2) return null
  return {
    kills: last.kills - first.kills,
    deaths: last.deaths - first.deaths,
    matches: last.matches - first.matches,
    wins: last.wins - first.wins,
    seconds: last.secondsPlayed - first.secondsPlayed,
    kdChange: kdOf(last) - kdOf(first)
  }
}

// ---------- jeu affiché par la page Stats ----------

/** Battlefield 6 ou Counter-Strike 2 : le choix est gardé sur ce PC. */
export type StatsGame = 'bf6' | 'cs2'

const GAME_KEY = 'pg.stats.game'

export function loadStatsGame(): StatsGame {
  try {
    return localStorage.getItem(GAME_KEY) === 'cs2' ? 'cs2' : 'bf6'
  } catch {
    return 'bf6'
  }
}

export function saveStatsGame(game: StatsGame): void {
  try {
    localStorage.setItem(GAME_KEY, game)
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
}
