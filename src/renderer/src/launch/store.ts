// Lancements, côté interface. Le processus principal décide de chaque phase (services/launches.ts) : ici, on garde
// sa dernière réponse par lancement, l'état local du clic (« Lancement… » dans la même image, « Vérification… »),
// la carte affichée, les annonces lues et la date gelée du jeu qui se lance (rien ne bouge sous le curseur).
// Règle du clic (comme le redémarrage d'une mise à jour) : l'IPC part d'abord, l'animation ensuite.
import { useMemo, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { cleanName } from '@shared/text'
import type { LaunchRoute, LaunchStatus, LaunchVia } from '@shared/launch'
import type { Game } from '@shared/types'
import { createStore, isIdle, tier } from '../update/session'
import { revealDone, warpActive } from '../update/stage'
import { announcement, clickAnnouncement, pendingAnnouncement, slowAnnouncement } from './copy'
import { CARD_CAP_MS, closeFinishedCards, freezesDate, isPending, SLOW_MS, STAGE_REPEAT_MS } from './phase'
import { playLaunchVisual, type Entrance } from './sequence'

export interface LaunchView {
  launchId: string
  gameId: string
  /** Nom affiché (cleanName), gardé même si le jeu quitte la bibliothèque. */
  name: string
  /** Dernière réponse du processus principal, ou l'état local du clic (rev -1) en attendant. */
  status: LaunchStatus
  /** « Vérification… » : le jeu semblait tourner, le processus principal regarde de nouveau. */
  checking: boolean
  /** Date.now() du clic, côté interface (libellé minimal de 600 ms). */
  clickedAt: number
  /** Dernier changement de phase. */
  changedAt: number
  /** Carte au premier plan : la plus récente gagne (clic, échec, ou clic sur un jeu déjà en cours de lancement). */
  focusAt: number
  /** Un de plus à chaque clic sur un jeu déjà en cours de lancement : un reflet passe sur la carte. */
  bump: number
  /** Carte fermée (×, action, temps écoulé). */
  cardDone: boolean
  /** Revenu par launch:list après un rechargement : ni entrée animée, ni annonce de ce retour (les phases suivantes, si). */
  hydrated: boolean
  entrance: Entrance
}

export const launches = createStore<Record<string, LaunchView>>({})
/** Région polie de la carte (LaunchDock) : une phrase par changement de phase. */
export const launchAnnounce = createStore<string>('')

export function announce(text: string | null): void {
  if (!text) return
  // Même phrase deux fois de suite : une espace insécable la fait relire.
  launchAnnounce.set((p) => (p === text ? `${text} ` : text))
}

/** Mode démo actif (posé par App) : le texte du clic le dit avant même la réponse du processus principal. */
let demoMode = false
export function setLaunchDemo(on: boolean): void {
  demoMode = on
}

const update = (id: string, fn: (v: LaunchView) => LaunchView): void =>
  launches.set((all) => {
    const v = all[id]
    if (!v) return all
    const next = fn(v)
    return next === v ? all : { ...all, [id]: next }
  })

// ---------- minuteries (annonce des 90 s, carte jamais revue) ----------

const timers = new Map<string, ReturnType<typeof setTimeout>[]>()

function clearTimers(id: string): void {
  for (const t of timers.get(id) ?? []) clearTimeout(t)
  timers.delete(id)
}

function arm(id: string, ms: number, fn: () => void): void {
  const list = timers.get(id) ?? []
  list.push(setTimeout(fn, Math.max(0, ms)))
  timers.set(id, list)
}

/** Après chaque changement de phase : l'annonce « toujours pas détecté » à 90 s, et le retrait sans bruit à 10 min. */
function armPhase(v: LaunchView): void {
  clearTimers(v.launchId)
  const s = v.status
  const at = (s.handedAt ?? s.clickAt) + SLOW_MS
  // Revenu après un rechargement au-delà des 90 s : rien à lire d'un coup, l'attente était déjà « Toujours en attente ».
  if (s.phase === 'waiting' && !s.demo && !(v.hydrated && at <= Date.now())) {
    arm(v.launchId, at - Date.now(), () => {
      const cur = launches.get()[v.launchId]
      if (cur?.status.phase === 'waiting' && !cur.status.steamUpdating) announce(slowAnnouncement(cur.name))
    })
  }
  if (!isPending(s.phase)) arm(v.launchId, CARD_CAP_MS, () => update(v.launchId, (c) => (c.cardDone ? c : { ...c, cardDone: true })))
}

// ---------- réponses du processus principal ----------

/** Lancements terminés depuis plus longtemps que ça : oubliés (les boutons n'en ont plus besoin). */
const FORGET_MS = 15 * 60_000
/** Après un rechargement, une carte terminée ne revient que si elle vient de changer. */
const HYDRATE_FRESH_MS = 10_000

function nameOf(gameId: string): string {
  return cleanName(gamesById.get(gameId)?.name ?? '')
}

/** Dernier instant connu d'un lancement (pour décider si une carte terminée revient après un rechargement). */
const lastAt = (s: LaunchStatus): number => Math.max(s.clickAt, s.handedAt ?? 0, s.detectedAt ?? 0, s.goneAt ?? 0, s.endedAt ?? 0)

function merge(s: LaunchStatus, o: { hydrated?: boolean } = {}): void {
  const now = Date.now()
  const cur = launches.get()[s.launchId]
  // Un événement plus ancien que ce qu'on a déjà : ignoré (l'interface ne revient jamais en arrière).
  if (cur && cur.status.rev >= s.rev) return
  const prev = cur && cur.status.rev >= 0 && !cur.checking ? cur.status : null
  const changed = !cur || cur.checking || cur.status.phase !== s.phase
  const name = cur?.name || nameOf(s.gameId)
  const hydrated = cur ? cur.hydrated : !!o.hydrated
  const next: LaunchView = {
    launchId: s.launchId,
    gameId: s.gameId,
    name,
    status: s,
    checking: false,
    clickedAt: cur?.clickedAt ?? s.clickAt,
    changedAt: changed ? now : cur.changedAt,
    // Un échec passe devant (même devant un lancement plus récent).
    focusAt: cur ? (changed && s.phase === 'failed' ? now : cur.focusAt) : s.clickAt,
    bump: cur?.bump ?? 0,
    cardDone: cur ? (changed ? false : cur.cardDone) : !!o.hydrated && !isPending(s.phase) && now - lastAt(s) > HYDRATE_FRESH_MS,
    hydrated,
    entrance: cur?.entrance ?? 'none'
  }
  launches.set((all) => {
    const out: Record<string, LaunchView> = { ...all, [s.launchId]: next }
    // On oublie les vieux lancements terminés.
    for (const [id, v] of Object.entries(out))
      if (!isPending(v.status.phase) && !v.checking && now - v.changedAt > FORGET_MS) {
        delete out[id]
        sources.delete(id)
      }
    return out
  })
  if (changed) armPhase(next)
  // Seul le retour par launch:list est muet : ce qui change ensuite est annoncé comme d'habitude.
  if (cur || !o.hydrated) announce(announcement(prev, s, name, now))
}

let bound = 0
/** À appeler une fois (App) : événements launch:status, puis les lancements déjà en cours (rechargement de l'interface). */
export function bindLaunchIpc(): () => void {
  const api = window.launcher
  const n = ++bound
  const off = api.onLaunchStatus((s) => merge(s))
  api
    .listLaunches()
    .then((list) => {
      if (n === bound) for (const s of list) merge(s, { hydrated: true })
    })
    .catch(() => {})
  return off
}

/** Mode démo basculé : le processus principal a tout arrêté, l'interface oublie tout. */
export function resetLaunches(): void {
  for (const id of timers.keys()) clearTimers(id)
  frozen.clear()
  sources.clear()
  launches.set({})
}

// ---------- clic ----------

/** Jeux connus de l'interface (nom d'un lancement qui arrive par événement). Tenu à jour par useFrozenGames. */
const gamesById = new Map<string, Game>()
/** Dernière date de lancement de chaque jeu au moment du clic : gelée tant que le lancement est en cours. */
const frozen = new Map<string, number | undefined>()
/** Dernière mise à feu jouée par jeu (performance.now()) : pas deux fois en 10 min. */
const lastStageAt = new Map<string, number>()
/**
 * Bouton qui avait le focus au clic : il le reprend si la carte part en le tenant. Référence faible : un écran quitté
 * (bibliothèque démontée) n'est pas retenu en mémoire par son bouton Jouer.
 */
const sources = new Map<string, WeakRef<HTMLElement>>()

/** Le jeu tel que l'interface le connaît (vignette de la carte, Réessayer). */
export const gameOf = (id: string): Game | undefined => gamesById.get(id)
/** Contrôle d'où est parti un lancement, s'il est encore dans la page. */
export function focusSource(id: string): HTMLElement | null {
  const el = sources.get(id)?.deref()
  return el?.isConnected ? el : null
}

let seq = 0
const newId = (): string => {
  try {
    return crypto.randomUUID()
  } catch {
    return `l${Date.now().toString(36)}${(++seq).toString(36)}`
  }
}

/** Route probable, avant la réponse du processus principal (qui la corrige si le jeu part par son exécutable). */
function guessRoute(g: Game): LaunchRoute {
  if (g.store === 'steam') return /^\d+$/.test(g.storeId) ? 'steam' : 'exe'
  if (g.store === 'ea') return g.storeId ? 'ea' : 'exe'
  return 'epic'
}

/** Lancement le plus récent d'un jeu. */
export function latestFor(all: Record<string, LaunchView>, gameId: string): LaunchView | null {
  let best: LaunchView | null = null
  for (const v of Object.values(all)) if (v.gameId === gameId && (!best || v.clickedAt > best.clickedAt)) best = v
  return best
}

/** Un lancement de ce jeu attend encore (clic, vérification, envoi, attente du jeu). */
export const isBusy = (v: LaunchView | null): boolean => !!v && (v.checking || isPending(v.status.phase))

/** Clic sur un jeu déjà en cours de lancement : la carte revient devant, sans nouvel envoi. */
export function bringForward(id: string): void {
  const v = launches.get()[id]
  if (!v) return
  update(id, (c) => ({ ...c, focusAt: Date.now(), bump: c.bump + 1, cardDone: false }))
  announce(pendingAnnouncement(v.name))
}

/** × de la carte pendant l'attente : Player X arrête de suivre ce lancement (rien n'est fermé). */
export function cancelLaunch(id: string): void {
  const v = launches.get()[id]
  if (!v) return
  update(id, (c) => ({ ...c, cardDone: true }))
  window.launcher.cancelLaunch(id).catch(() => {})
}

/** Carte fermée (×, action, temps écoulé) : le lancement reste connu des boutons. */
export function dismissCard(id: string): void {
  update(id, (c) => (c.cardDone ? c : { ...c, cardDone: true }))
}

/** Seule porte vers launchGame depuis l'interface. `from` : l'élément cliqué (jaquette), d'où part la jaquette. */
export function startLaunch(game: Game, from?: HTMLElement | null, via: LaunchVia = 'play'): void {
  const all = launches.get()
  const cur = latestFor(all, game.id)
  const name = cleanName(game.name)
  // Double clic, ou clic pendant l'attente : rien n'est renvoyé, la carte revient devant.
  if (isBusy(cur) && via !== 'relaunch') return bringForward(cur!.launchId)
  const launchId = newId()
  const force = via === 'relaunch'
  // Le jeu semblait tourner : le processus principal regarde de nouveau avant d'envoyer quoi que ce soit.
  const checking = !force && (!!game.running || (!!cur && !cur.status.demo && cur.status.phase === 'running'))

  // 1. L'IPC D'ABORD, dans son propre try : quoi qu'il arrive ensuite, le lancement est parti.
  let reply: Promise<LaunchStatus>
  try {
    reply = Promise.resolve(window.launcher.launchGame(game.id, { launchId, via, ...(force ? { force: true } : {}) }))
  } catch (e) {
    reply = Promise.reject(e)
  }

  // 2. L'état local, dans la même image.
  const now = Date.now()
  const otherPending = Object.values(all).some((v) => v.gameId !== game.id && isBusy(v))
  const entrance = chooseEntrance(game, from, via, checking, otherPending)
  if (entrance === 'stage') lastStageAt.set(game.id, performance.now())
  frozen.set(game.id, game.lastPlayed)
  gamesById.set(game.id, game)
  const active = document.activeElement
  // Parti d'une carte (« Réessayer », « Relancer quand même ») : son bouton disparaît avec elle, le nouveau lancement
  // garde le contrôle d'où était parti le précédent.
  const card = active instanceof HTMLElement ? active.closest<HTMLElement>('.launch-card[data-launch-id]') : null
  const src = card ? sources.get(card.dataset.launchId ?? '')?.deref() : active
  if (src instanceof HTMLElement && src !== document.body) sources.set(launchId, new WeakRef(src))
  const status: LaunchStatus = {
    launchId,
    gameId: game.id,
    route: guessRoute(game),
    phase: 'sending',
    detect: 'none',
    via,
    rev: -1,
    clickAt: now,
    ...(demoMode ? { demo: true as const } : {})
  }
  const view: LaunchView = {
    launchId,
    gameId: game.id,
    name,
    status,
    checking,
    clickedAt: now,
    changedAt: now,
    focusAt: now,
    bump: 0,
    cardDone: false,
    hydrated: false,
    entrance
  }
  // Les cartes terminées de ce jeu (échec, jeu fermé, déjà en jeu) se ferment dans le même rendu : sinon l'ancienne
  // reviendrait quand la nouvelle part (« Lancement impossible » pendant que les boutons disent « En jeu »).
  const commit = (): void => launches.set((a) => ({ ...closeFinishedCards(a, game.id), [launchId]: view }))
  try {
    flushSync(commit)
  } catch {
    commit()
  }
  announce(clickAnnouncement(name))

  reply.then(
    (s) => {
      // Déjà en cours côté processus principal (autre fenêtre, clic très rapide) : on suit le lancement existant.
      if (s.launchId !== launchId) {
        launches.set((a) => {
          const { [launchId]: _drop, ...rest } = a
          return rest
        })
        clearTimers(launchId)
        merge(s)
        return bringForward(s.launchId)
      }
      merge(s)
    },
    () =>
      merge({
        ...status,
        phase: 'failed',
        reason: 'other',
        rev: Number.MAX_SAFE_INTEGER
      })
  )

  // 3. L'animation, juste après : une exception ne touche ni l'IPC ni l'état.
  if (entrance === 'none' || entrance === 'auto') return
  try {
    playLaunchVisual({
      launchId,
      game,
      name,
      from: from ?? null,
      entrance,
      demo: demoMode,
      get: () => launches.get()[launchId] ?? null,
      subscribe: launches.subscribe
    })
  } catch (e) {
    console.error(e)
  }
}

/** Mise à feu (Full), glissé (effets coupés, ou mise à feu déjà vue), allumage dans la fiche, ou rien. */
function chooseEntrance(game: Game, from: HTMLElement | null | undefined, via: LaunchVia, checking: boolean, otherPending: boolean): Entrance {
  const t = tier()
  if (t === 'reduced' || isIdle() || document.hidden || checking) return checking ? 'auto' : 'none'
  if (from?.closest('.sheet-root')) return t === 'full' ? 'sheet' : 'auto'
  const recent = performance.now() - (lastStageAt.get(game.id) ?? -Infinity) < STAGE_REPEAT_MS
  const stageOk = t === 'full' && via === 'play' && !otherPending && !recent && !warpActive() && revealDone.get()
  return stageOk ? 'stage' : 'glide'
}

// ---------- lecture ----------

/** Lancements de ce jeu, pour ses boutons : un bouton ne se redessine que si le lancement de son jeu change. */
export function useLatestLaunch(gameId: string): LaunchView | null {
  return useSyncExternalStore(launches.subscribe, () => latestFor(launches.get(), gameId))
}

/** Un vrai lancement attend (hors démo) : retient le compte à rebours d'une mise à jour, coupe son aperçu. */
export function useLaunchPending(): { real: boolean; any: boolean } {
  const real = useSyncExternalStore(launches.subscribe, () => Object.values(launches.get()).some((v) => !v.status.demo && isBusy(v)))
  const any = useSyncExternalStore(launches.subscribe, () => Object.values(launches.get()).some(isBusy))
  return { real, any }
}

/** Carte à montrer : le lancement au premier plan le plus récent, parmi ceux qui ont encore une carte. */
export function dockRecord(all: Record<string, LaunchView>): LaunchView | null {
  let best: LaunchView | null = null
  for (const v of Object.values(all)) {
    if (v.cardDone || v.checking || v.status.silent || v.status.phase === 'ended' || v.status.phase === 'cancelled') continue
    if (!best || v.focusAt > best.focusAt) best = v
  }
  return best
}

/** Jeux dont la date reste gelée, en une chaîne stable : la coque ne se redessine que quand cet ensemble change. */
const frozenKey = (): string =>
  Object.values(launches.get())
    .filter(freezesDate)
    .map((v) => v.gameId)
    .sort()
    .join('|')

/**
 * Bibliothèque montrée aux écrans : la date de dernier lancement d'un jeu qui se lance reste celle d'avant le clic,
 * pour que ni l'accueil ni « Récents » ne bougent sous le curseur. Levée dès que le jeu est détecté (un relais ne la
 * remet pas : la date fraîche est déjà affichée), ou que le lancement s'arrête.
 */
export function useFrozenGames(games: Game[]): Game[] {
  const busy = useSyncExternalStore(launches.subscribe, frozenKey)
  for (const g of games) gamesById.set(g.id, g)
  return useMemo(() => {
    if (!busy) return games
    const ids = new Set(busy.split('|'))
    return games.map((g) => (ids.has(g.id) && frozen.has(g.id) && g.lastPlayed !== frozen.get(g.id) ? { ...g, lastPlayed: frozen.get(g.id) } : g))
  }, [games, busy])
}
