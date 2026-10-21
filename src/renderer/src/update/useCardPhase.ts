// Phases de la carte de mise à jour (spec §5–§6) : ce qu'elle montre, à partir de l'état réel ou d'une image de l'aperçu,
// la file des étapes de vérification, le verrouillage, le compte à rebours et ses pauses, « Plus tard », et toute la
// chorégraphie WAAPI de la carte. Une seule source de rendu : l'aperçu passe par ici comme une vraie mise à jour.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { UpdateErrorCode, UpdateState } from '@shared/types'
import { useToast } from '../components/ui/Toasts'
import { anim, createStore, fx, isIdle, isRealUpdateBusy, lastUpdate, tier, useStore, VERSION, type AnimOpts, type Tier } from './session'
import { EASE, KF, type KeyframeSet } from './keyframes'
import { rate as rateOf, type Rate } from './format'
import { requestRestart, restartBlocked } from './stage'
import { PREVIEW_COUNTDOWN, preview, stopPreview, type PreviewFrame } from './preview'

export type CardPhase = 'hidden' | 'download' | 'verify' | 'lock' | 'armed' | 'refused' | 'interrupted' | 'installing'
export type HoldReason = 'unfocused' | 'hover' | 'game' | 'launch' | 'blocked' | null
export type VerifyStep = 'signature' | 'hash' | 'check'

export interface CardModel {
  phase: CardPhase
  /** Un jeu tourne pendant le téléchargement ou la vérification : pastille immobile. */
  mini: boolean
  version: string
  /** Identité de la carte (clé React) : la version, ou la séance d'aperçu. */
  id: string
  percent: number
  /** 0..1, écrit dans --p à chaque événement de progression. */
  p: number
  bytes?: { done: number; total: number; bps?: number }
  rate: Rate
  stalled: boolean
  /** Étape affichée (file d'attente), pas forcément la vraie. */
  step?: VerifyStep
  hashP: number
  fingerprint?: string
  /** Secondes restantes avant le redémarrage. */
  left: number
  /** Durée du compte à rebours (10 s, 5 s dans l'aperçu). */
  countdown: number
  /** Pourquoi le compte à rebours ne tourne pas (null : il tourne, ou pas encore armé). */
  hold: HoldReason
  errorCode?: UpdateErrorCode
  preview: boolean
  /** Clé du fondu des trois lignes (TextSwap). */
  textKey: string
  lit: number
  cellsOn: number
  critical: boolean
  locking: boolean
  leaving: boolean
}

export interface CardApi {
  model: CardModel
  restart(): void
  later(): void
  close(): void
  setHovered(v: boolean): void
  setFocusWithin(v: boolean): void
}

// ---------- règles (spec §5.5, §6.3, §6.5, §6.6) ----------

/** Compte à rebours du redémarrage automatique, inchangé. */
const RESTART_DELAY = 10
/** Sans événement de progression pendant 6 s : « en attente du réseau ». */
const STALL_MS = 6000
const STEPS: VerifyStep[] = ['signature', 'hash', 'check']
/** Temps minimal d'affichage de chaque étape (540 ms : l'entrée des 17 caractères de l'empreinte). */
const DWELL: Record<Tier, Record<VerifyStep, number>> = {
  full: { signature: 260, hash: 400, check: 540 },
  sober: { signature: 200, hash: 300, check: 400 },
  reduced: { signature: 0, hash: 0, check: 0 }
}
/** « Prête » s'affiche au plus tard ce délai après l'arrivée de l'état ready. */
const READY_CAP: Record<Tier, number> = { full: 1200, sober: 900, reduced: 0 }
/** Verrouillage : durée, et moment où le texte passe aux lignes « prête ». */
const LOCK = { full: { dur: 900, swap: 300 }, sober: { dur: 400, swap: 120 } } as const
/** L'arc intérieur de l'empreinte est redessiné au plus toutes les 100 ms. */
const HASH_REDRAW_MS = 100
/** Paquets de lumière par événement, selon la vitesse réelle. */
const PACKETS: Record<Rate, { n: number; ms: number }> = { slow: { n: 1, ms: 1000 }, mid: { n: 2, ms: 800 }, fast: { n: 3, ms: 620 } }
/**
 * Filet de sécurité : si la scène ne rend jamais la main après un redémarrage demandé (son chien de garde part à
 * délai + 10 s), la carte se débloque d'elle-même, sans relancer le compte à rebours pour cette version.
 */
const RESTART_SAFETY_MS = 12_000

/** Clé masquée par « Plus tard » ou × : au niveau du module, elle survit au démontage de la coque (choix des favoris). */
const dismissedKey = createStore<string | null>(null)

// ---------- ce que la carte doit montrer ----------

type Bytes = { done: number; total: number; bps?: number }

type Src =
  | { kind: 'hidden' }
  | { kind: 'download'; version: string; percent: number; bytes?: Bytes; rate: Rate }
  | { kind: 'verify'; version: string; step: VerifyStep; hashP: number; fingerprint?: string }
  | { kind: 'ready'; version: string; fingerprint?: string }
  | { kind: 'installing'; version: string }
  | { kind: 'refused'; version: string }
  | { kind: 'interrupted'; version: string; code: UpdateErrorCode }

const HIDDEN: Src = { kind: 'hidden' }
const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.floor(Number.isFinite(n) ? n : 0)))

function fromReal(s: UpdateState | null): Src {
  if (!s) return HIDDEN
  switch (s.state) {
    case 'downloading': {
      const bytes = s.total && s.total > 0 && s.transferred !== undefined ? { done: s.transferred, total: s.total, bps: s.bytesPerSecond } : undefined
      return { kind: 'download', version: s.version, percent: clampPct(s.percent), bytes, rate: rateOf(s.bytesPerSecond) }
    }
    case 'verifying': {
      const hashP = s.step === 'hash' ? (s.total ? Math.min(1, (s.hashed ?? 0) / s.total) : 0) : s.step === 'check' ? 1 : 0
      return { kind: 'verify', version: s.version, step: s.step, hashP, fingerprint: s.fingerprint }
    }
    case 'ready':
      return { kind: 'ready', version: s.version, fingerprint: s.fingerprint }
    case 'installing':
      return { kind: 'installing', version: s.version }
    case 'error':
      // Sans version (vérification ratée) : rien sur la carte, comme avant ; À propos seulement.
      if (!s.version) return HIDDEN
      return s.code === 'unsigned' ? { kind: 'refused', version: s.version } : { kind: 'interrupted', version: s.version, code: s.code ?? 'other' }
    default:
      return HIDDEN
  }
}

/** Aperçu : aucune version, taille, vitesse ni empreinte inventée. La seule empreinte est celle de la version qui tourne. */
function fromPreview(f: PreviewFrame, ownFingerprint: string | undefined): Src {
  switch (f.phase) {
    case 'download':
      return { kind: 'download', version: VERSION, percent: clampPct(f.percent), rate: 'mid' }
    case 'verify':
      return { kind: 'verify', version: VERSION, step: f.step, hashP: f.hashP, fingerprint: f.step === 'check' ? ownFingerprint : undefined }
    case 'ready':
      return { kind: 'ready', version: VERSION }
  }
}

/** Clé de « Plus tard » et du × : une nouvelle version ou une nouvelle phase remontre la carte. */
function keyOf(src: Src): string {
  switch (src.kind) {
    case 'hidden':
      return ''
    case 'download':
      return `downloading:${src.version}:`
    case 'verify':
      return `verifying:${src.version}:`
    case 'refused':
      return `error:${src.version}:unsigned`
    case 'interrupted':
      return `error:${src.version}:${src.code}`
    default:
      return `${src.kind}:${src.version}:`
  }
}

/** Ce qui est affiché : l'état réel passé par la file des étapes. */
interface View {
  kind: Src['kind']
  version: string
  id: string
  preview: boolean
  key: string
  percent: number
  bytes?: Bytes
  rate: Rate
  /** Un de plus à chaque événement de téléchargement (paquets de lumière). */
  seq: number
  step: VerifyStep
  stepAt: number
  /** Arrivée de l'état ready pendant la file (0 sinon). */
  readyAt: number
  hashP: number
  hashAt: number
  fingerprint?: string
  code?: UpdateErrorCode
}

const VIEW0: View = {
  kind: 'hidden',
  version: '',
  id: '',
  preview: false,
  key: '',
  percent: 0,
  rate: 'slow',
  seq: 0,
  step: 'signature',
  stepAt: 0,
  readyAt: 0,
  hashP: 0,
  hashAt: 0
}

const VIEW_FIELDS = Object.keys(VIEW0).concat('bytes', 'fingerprint', 'code') as Array<keyof View>
const sameView = (a: View, b: View): boolean => VIEW_FIELDS.every((k) => a[k] === b[k])

/**
 * File des étapes (§6.3) : chaque étape reste affichée au moins son temps minimal, dans l'ordre signature → hash → check,
 * avec toujours les valeurs réelles les plus récentes. « Prête » arrive au plus tard READY_CAP après l'état ready.
 * Une erreur, un téléchargement ou une installation passent tout de suite. Rend la vue suivante et le prochain réveil.
 */
function advance(v: View, src: Src, ctx: { id: string; preview: boolean; fresh: boolean }, now: number, t: Tier): { v: View; wake: number } {
  const same = v.id === ctx.id
  const base = { ...v, id: ctx.id, preview: ctx.preview }
  const done = (next: View): { v: View; wake: number } => ({ v: sameView(next, v) ? v : next, wake: Infinity })
  switch (src.kind) {
    case 'hidden':
      return done({ ...v, kind: 'hidden' })
    case 'download':
      if (!ctx.fresh && v.kind === 'download' && same) return { v, wake: Infinity }
      return done({
        ...base,
        kind: 'download',
        version: src.version,
        key: keyOf(src),
        percent: src.percent,
        bytes: src.bytes,
        rate: src.rate,
        seq: v.seq + 1,
        hashP: 0,
        fingerprint: undefined,
        code: undefined
      })
    case 'installing':
      return done({ ...base, kind: 'installing', version: src.version, key: keyOf(src), percent: 100, code: undefined })
    case 'refused':
      return done({ ...base, kind: 'refused', version: src.version, key: keyOf(src), percent: 100, code: 'unsigned' })
    case 'interrupted': {
      // Les graduations gardent ce qui a été reçu avant la coupure.
      const percent = v.kind === 'download' && same ? v.percent : src.code === 'verify' ? 100 : 0
      return done({ ...base, kind: 'interrupted', version: src.version, key: keyOf(src), percent, code: src.code })
    }
  }

  const ready = (): View => ({
    ...base,
    kind: 'ready',
    version: src.version,
    key: `ready:${src.version}:`,
    percent: 100,
    hashP: 1,
    fingerprint: (src.kind === 'ready' ? src.fingerprint : undefined) ?? v.fingerprint,
    readyAt: 0,
    code: undefined
  })

  let cur = v
  if (cur.kind !== 'verify' || !same || cur.version !== src.version) {
    const afterDownload = cur.kind === 'download' && same && cur.version === src.version
    // Prête sans vérification affichée juste avant (lancement, carte masquée) : directement « prête ».
    if (src.kind === 'ready' && !afterDownload) return done(ready())
    cur = {
      ...base,
      kind: 'verify',
      version: src.version,
      key: `verifying:${src.version}:`,
      percent: 100,
      // Juste après le téléchargement, on part de la première étape même si la vraie est déjà plus loin.
      step: afterDownload || src.kind === 'ready' ? 'signature' : src.step,
      stepAt: now,
      readyAt: 0,
      hashP: 0,
      hashAt: 0,
      fingerprint: undefined,
      code: undefined
    }
  }

  const dwell = DWELL[t]
  const target = src.kind === 'ready' ? STEPS.length : STEPS.indexOf(src.step)
  const readyAt = src.kind === 'ready' ? cur.readyAt || now : 0
  if (src.kind === 'ready' && now - readyAt >= READY_CAP[t]) return done(ready())
  let i = STEPS.indexOf(cur.step)
  let at = cur.stepAt
  while (i < target && now - at >= dwell[STEPS[i]]) {
    i++
    at = now
  }
  if (i >= STEPS.length) return done(ready())

  const step = STEPS[i]
  // Une étape sautée (petit fichier) : l'empreinte est finie, l'arc est plein.
  const realHash = target > 1 ? 1 : src.kind === 'verify' && src.step === 'hash' ? src.hashP : 0
  let hashP = cur.hashP
  let hashAt = cur.hashAt
  let wake = Infinity
  if (step === 'hash' && realHash !== hashP) {
    if (realHash >= 1 || now - hashAt >= HASH_REDRAW_MS) {
      hashP = realHash
      hashAt = now
    } else wake = hashAt + HASH_REDRAW_MS
  }
  const fingerprint = src.fingerprint ?? cur.fingerprint
  if (i < target) wake = Math.min(wake, at + dwell[step])
  if (readyAt) wake = Math.min(wake, readyAt + READY_CAP[t])
  const next: View = { ...cur, step, stepAt: at, readyAt, hashP, hashAt, fingerprint }
  return { v: sameView(next, v) ? v : next, wake }
}

// ---------- chorégraphie ----------

type Target = Element | null | undefined

/** Un passage, puis retour à l'état de repos du CSS (rien ne reste dans getAnimations()). */
export function play(el: Target, set: KeyframeSet, o: AnimOpts = {}): Animation | null {
  const a = anim(el, set.frames, { ...set.opts, ...o })
  if (a) a.onfinish = () => a.cancel()
  return a
}

const kf = (frames: Keyframe[], duration: number, easing: string, delay = 0): KeyframeSet => ({ frames, opts: { duration, easing, delay, fill: 'both' } })
/** Accent d'armement (§6.5) : halo .6 → 1 → .6 sur 650 ms, cellules allumées une à une. */
const ACCENT_GLOW = kf([{ opacity: 0.6 }, { opacity: 1 }, { opacity: 0.6 }], 650, EASE.inOut)
const cellIn = (j: number): KeyframeSet => kf([{ opacity: 0 }, { opacity: 1 }], 200, EASE.out, j * 30)

const litOf = (percent: number): number => Math.floor((percent * 24) / 100)

/** Fenêtre au premier plan (focus et page visible), mis à jour à chaque changement. */
export function useWindowActive(): boolean {
  const [active, setActive] = useState(() => !isIdle())
  useEffect(() => {
    const set = (): void => setActive(!isIdle())
    window.addEventListener('focus', set)
    window.addEventListener('blur', set)
    document.addEventListener('visibilitychange', set)
    set()
    return () => {
      window.removeEventListener('focus', set)
      window.removeEventListener('blur', set)
      document.removeEventListener('visibilitychange', set)
    }
  }, [])
  return active
}

export function useCardPhase(
  real: UpdateState | null,
  o: { inGame: boolean; launching?: boolean; cardRef: RefObject<HTMLDivElement | null> }
): CardApi {
  const { inGame, cardRef } = o
  const launching = !!o.launching
  // Partie en cours, ou jeu en train de se lancer : la carte se fait discrète (pastille, pas d'entrée, compte en pause).
  const quiet = inGame || launching
  const notify = useToast()
  const active = useWindowActive()
  const pv = useStore(preview)
  const blockedVersion = useStore(restartBlocked)
  // Empreinte de la version qui tourne : même règle que le retour et Quoi de neuf (dernière mise à jour vers VERSION).
  const lu = useStore(lastUpdate).value
  const ownFingerprint = lu && lu.to === VERSION ? lu.fingerprint : undefined

  // ----- source : la vraie mise à jour gagne toujours sur l'aperçu -----
  const realBusy = isRealUpdateBusy(real)
  // Pendant le saut de l'aperçu, la carte garde sa dernière image : elle est aspirée avec l'interface, comme une vraie.
  const fromPv = pv.active && (pv.part === 'card' || pv.part === 'warp') && !!pv.frame && !realBusy
  // Une séance d'aperçu = une carte (entrée, verrouillage, compte à rebours à elle).
  const session = useRef({ active: false, n: 0 })
  if (pv.active !== session.current.active) session.current = { active: pv.active, n: session.current.n + (pv.active ? 1 : 0) }
  const src = useMemo(() => (fromPv && pv.frame ? fromPreview(pv.frame, ownFingerprint) : fromReal(real)), [fromPv, pv.frame, real, ownFingerprint])
  const id = fromPv ? `preview-${session.current.n}` : src.kind === 'hidden' ? '' : src.version

  useEffect(() => {
    if (pv.active && realBusy) stopPreview()
  }, [pv.active, realBusy])

  // ----- file des étapes -----
  const [view, setView] = useState<View>(VIEW0)
  const viewRef = useRef(view)
  const srcRef = useRef<Src | null>(null)
  const [wakeN, setWakeN] = useState(0)
  const quietRef = useRef(quiet)
  quietRef.current = quiet

  // Verrouillage en cours (clé de la vue « prête », texte déjà passé aux lignes « prête »).
  const [lock, setLock] = useState<{ key: string; tier: 'full' | 'sober'; swapped: boolean; dur: number; swap: number } | null>(null)
  /** Clé « prête » dont l'accent d'armement attend le prochain retour au premier plan. */
  const accentFor = useRef<string | null>(null)
  const locked = useRef(new Set<string>())

  useLayoutEffect(() => {
    const fresh = srcRef.current !== src
    srcRef.current = src
    const prev = viewRef.current
    const { v: next, wake } = advance(prev, src, { id: id || prev.id, preview: fromPv, fresh }, Date.now(), tier())
    if (next !== prev) {
      viewRef.current = next
      setView(next)
      // Prête juste après une vérification visible : verrouillage, une fois par version (§6.5).
      // Clé par carte : chaque séance d'aperçu a le sien, une vraie version une seule fois.
      const lk = `${next.id}|${next.key}`
      if (next.kind === 'ready' && prev.kind === 'verify' && prev.id === next.id && !locked.current.has(lk)) {
        locked.current.add(lk)
        const t = tier()
        if (quietRef.current || isIdle()) accentFor.current = t === 'reduced' ? null : next.key
        else if (t !== 'reduced') setLock({ key: next.key, tier: t, swapped: false, ...LOCK[t] })
      }
    }
    if (wake === Infinity) return
    const tm = setTimeout(() => setWakeN((n) => n + 1), Math.max(0, wake - Date.now()))
    return () => clearTimeout(tm)
  }, [src, id, fromPv, wakeN])

  useEffect(() => {
    if (!lock) return
    const a = setTimeout(() => setLock((l) => (l && l.key === lock.key ? { ...l, swapped: true } : l)), lock.swap)
    const b = setTimeout(() => setLock((l) => (l && l.key === lock.key ? null : l)), lock.dur)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
    // Les minuteries partent au début du verrouillage seulement.
  }, [lock?.key])

  // ----- téléchargement figé -----
  const [stalledSeq, setStalledSeq] = useState(-1)
  useEffect(() => {
    if (view.kind !== 'download' || view.preview) return
    const seq = view.seq
    const t = setTimeout(() => setStalledSeq(seq), STALL_MS)
    return () => clearTimeout(t)
  }, [view.kind, view.seq, view.preview])
  const stalled = view.kind === 'download' && !view.preview && stalledSeq === view.seq

  // ----- masquage, redémarrage, compte à rebours -----
  const dismissed = useStore(dismissedKey)
  const [leaving, setLeaving] = useState(false)
  const [hovered, setHoveredState] = useState(false)
  const [focusWithin, setFocusWithinState] = useState(false)
  const [restarting, setRestarting] = useState<string | null>(null)
  const [selfBlocked, setSelfBlocked] = useState<string | null>(null)

  const D = view.preview ? PREVIEW_COUNTDOWN : RESTART_DELAY
  const readyKey = view.kind === 'ready' ? `${view.id}|${view.key}` : ''
  const [cd, setCd] = useState({ key: '', left: RESTART_DELAY })
  // Le compte garde sa valeur pendant le redémarrage : ni « 10 », ni cellules rallumées sous l'instantané du saut.
  const cdKey = view.kind === 'ready' || view.kind === 'installing' ? `${view.id}|ready:${view.version}:` : ''
  const left = cd.key === cdKey ? cd.left : D

  const hidden = view.kind === 'hidden' || (!view.preview && dismissed === view.key)
  const blocked = view.kind === 'ready' && ((!view.preview && blockedVersion === view.version) || selfBlocked === readyKey)
  const isRestarting = view.kind === 'ready' && restarting === readyKey && !blocked
  const lockActive = !!lock && lock.key === view.key && view.kind === 'ready'

  const phase: CardPhase = hidden ? 'hidden' : view.kind === 'ready' ? (isRestarting ? 'installing' : lockActive ? 'lock' : 'armed') : view.kind
  const mini = quiet && !view.preview && (phase === 'download' || phase === 'verify')

  const hold: HoldReason =
    phase !== 'armed' ? null : blocked ? 'blocked' : inGame ? 'game' : launching ? 'launch' : !active ? 'unfocused' : hovered || focusWithin ? 'hover' : null
  const counting = phase === 'armed' && hold === null && !leaving

  // Pointeur ou focus restés sur une carte disparue : ils ne doivent pas geler la suivante. La même carte traverse
  // téléchargement → vérification → prête : on ne remet rien à zéro tant qu'elle reste montée.
  useEffect(() => {
    setHoveredState(false)
    setFocusWithinState(false)
  }, [view.id, hidden, mini])
  // Le bouton qui avait le focus a disparu (la carte entière n'est plus un bouton une fois prête) : plus de focus dedans.
  useEffect(() => {
    if (focusWithin && !cardRef.current?.contains(document.activeElement)) setFocusWithinState(false)
  }, [phase, focusWithin, cardRef])

  // Une nouvelle tentative manuelle après un échec : l'état « bloqué » sera reposé si elle échoue aussi.
  const restartRef = useRef<() => void>(() => {})
  restartRef.current = () => {
    if (view.kind !== 'ready' || isRestarting || leaving) return
    const card = cardRef.current
    const origin = card?.querySelector('.rx')?.getBoundingClientRect() ?? null
    const trigger = card?.querySelector<HTMLElement>('.upd-go') ?? null
    if (!view.preview && restartBlocked.get() === view.version) restartBlocked.set(null)
    setSelfBlocked((b) => (b === readyKey ? null : b))
    setRestarting(readyKey)
    try {
      requestRestart({ version: view.version, origin, trigger, preview: view.preview || undefined })
    } catch (e) {
      // La scène a ses propres replis ; ici, seulement ne pas laisser la carte figée sur « Redémarrage… ».
      console.error(e)
      setRestarting(null)
      setSelfBlocked(readyKey)
    }
  }
  const restart = useCallback(() => restartRef.current(), [])

  // La scène a rendu la main (échec) : la carte redevient utilisable, sans compte à rebours.
  useEffect(() => {
    if (blocked && restarting === readyKey) setRestarting(null)
  }, [blocked, restarting, readyKey])
  // Filet de sécurité si personne ne répond.
  useEffect(() => {
    if (!restarting || real?.state === 'installing') return
    const key = restarting
    const t = setTimeout(() => {
      setRestarting((r) => (r === key ? null : r))
      setSelfBlocked(key)
    }, RESTART_SAFETY_MS)
    return () => clearTimeout(t)
  }, [restarting, real?.state])

  // Une seconde réelle par tick, seulement quand c'est permis ; la suivante part une seconde pleine après la reprise.
  useEffect(() => {
    if (!counting) return
    if (left <= 0) {
      restartRef.current()
      return
    }
    const t = setTimeout(() => {
      setCd({ key: readyKey, left: left - 1 })
      // Dernière seconde : le redémarrage part dans le même rendu, sans image « Redémarrage dans 0 s ».
      if (left - 1 <= 0) restartRef.current()
    }, 1000)
    return () => clearTimeout(t)
  }, [counting, left, readyKey, D])

  // ----- départ : « Plus tard », × -----
  const leave = useCallback(
    (after: () => void) => {
      const card = cardRef.current
      setLeaving(true)
      const a = anim(card, KF.cardLeave.frames, { ...KF.cardLeave.opts, level: 'sober' })
      const finish = (): void => {
        flushSync(() => {
          setLeaving(false)
          after()
        })
        a?.cancel()
      }
      if (a) a.finished.then(finish, finish)
      else finish()
    },
    [cardRef]
  )

  const later = useCallback(() => {
    const v = viewRef.current
    if (v.preview) return leave(stopPreview)
    notify(`La ${v.version} s’installera quand tu fermeras Player X`, { kind: 'info', id: 'update' })
    leave(() => dismissedKey.set(v.key))
  }, [leave, notify])

  const close = useCallback(() => {
    const v = viewRef.current
    leave(v.preview ? stopPreview : () => dismissedKey.set(v.key))
  }, [leave])

  // ----- chorégraphie (après chaque rendu, avant l'affichage) -----
  const arrived = useRef(new Set<string>())
  const holds = useRef<Animation[]>([])
  const prev = useRef<{ card: HTMLElement | null; phase: CardPhase; id: string; seq: number; percent: number; left: number; key: string }>({
    card: null,
    phase: 'hidden',
    id: '',
    seq: 0,
    percent: 0,
    left: RESTART_DELAY,
    key: ''
  })

  useLayoutEffect(() => {
    const card = mini ? null : cardRef.current
    const p = prev.current
    prev.current = { card, phase, id: view.id, seq: view.seq, percent: view.percent, left, key: readyKey }
    if (phase !== p.phase || card !== p.card) {
      // Les images tenues d'une phase (verrouillage) ne survivent pas à la phase.
      for (const a of holds.current) a.cancel()
      holds.current = []
    }
    if (mini) arrived.current.add(view.id) // carte ↔ pastille : bascule instantanée dans les deux sens
    if (!card) return
    const q = (sel: string): Element | null => card.querySelector(sel)
    const t = tier()
    const keep = (el: Target, set: KeyframeSet, o: AnimOpts = {}): void => {
      const a = anim(el, set.frames, { ...set.opts, ...o })
      if (a) holds.current.push(a)
    }

    if (card !== p.card) {
      // Entrée de la carte (§5.6), une fois par version : jamais en revenant de la pastille, rien si la fenêtre est inactive.
      if (arrived.current.has(view.id)) return
      arrived.current.add(view.id)
      let played = false
      // En jeu, la carte apparaît sans entrée (§5.6) ; l'accent d'armement attend la fin de la partie.
      if (t === 'full' && !quiet) {
        played = !!play(card, KF.cardIn)
        if (played && (phase === 'download' || phase === 'armed')) {
          play(q('.upd-sheen'), KF.sheen, { delay: 260 })
          play(q('.rx-svg'), KF.rxSpinIn)
          play(q('.rx-ping'), KF.pingArrive)
          play(q('.upd-swap > .upd-text'), KF.textIn, { delay: 380 })
        }
        if (played && phase === 'verify') play(q('.rx-shield-svg'), KF.shieldIn)
      } else if (t === 'sober' && !quiet) played = !!play(card, KF.cardInSober, { level: 'sober' })
      if (played && phase === 'refused') refusedCore(q, t, true)
      // Prête dès l'arrivée (état lu au lancement) sans entrée visible : l'accent attend le premier plan.
      if (phase === 'armed' && !played && t === 'full' && (isIdle() || quiet)) accentFor.current = view.key
      return
    }

    if (phase !== p.phase) {
      if (phase === 'verify' && p.phase === 'download') {
        // Le bouclier apparaît (§6.4) ; les graduations, la tête et le centre s'effacent en CSS, la barre se démonte.
        if (t === 'full') play(q('.rx-shield-svg'), KF.shieldIn)
        else play(q('.rx-shield-svg'), KF.fade(180), { level: 'sober' })
      }
      if (phase === 'lock') {
        // Verrouillage (§6.5). Ce qui doit rester visible jusqu'à la fin est tenu, puis annulé au passage en « armée ».
        if (lock?.tier === 'full') {
          keep(q('.rx-shield-fill'), KF.shieldFill)
          keep(q('.rx-check'), KF.stamp)
          keep(q('.rx-shield-svg'), KF.shieldOut)
          keep(q('.rx-mark-svg'), KF.shieldOut)
          play(q('.rx-ping'), KF.pingLock)
          play(q('.rx-glow'), KF.glowSettle)
          play(q('.rx-sec'), KF.secIn, { delay: 700 })
          play(q('.upd-sheen'), KF.sheen, { delay: 300 })
          play(q('.upd-go'), KF.rise(0))
          play(q('.upd-later'), KF.rise(1))
        } else {
          keep(q('.rx-shield-fill'), KF.fade(180), { level: 'sober' })
          keep(q('.rx-check'), KF.fade(180), { level: 'sober' })
          keep(q('.rx-shield-svg'), KF.fadeOut(180, 220), { level: 'sober' })
          keep(q('.rx-mark-svg'), KF.fadeOut(180, 220), { level: 'sober' })
          card.querySelectorAll('.upd-actions > *').forEach((el, i) => play(el, KF.fade(160, 200 + i * 40), { level: 'sober' }))
        }
      }
      if (phase === 'refused') refusedCore(q, t, p.phase !== 'verify' && p.phase !== 'lock')
      if ((phase === 'refused' || phase === 'interrupted') && (p.phase === 'download' || p.phase === 'verify')) {
        card.querySelectorAll('.upd-actions > *').forEach((el, i) => {
          if (t === 'full') play(el, KF.rise(i), { delay: 140 + i * 60 })
          else play(el, KF.fade(160, 100 + i * 40), { level: 'sober' })
        })
      }
      return
    }

    // Téléchargement : des passages uniques par vrai événement, jamais de boucle (§5.5).
    if (phase === 'download' && view.seq !== p.seq && fx()) {
      const pk = PACKETS[view.rate]
      card.querySelectorAll('.upd-pk').forEach((el, i) => {
        if (i >= pk.n) return
        for (const a of el.getAnimations()) a.cancel()
        play(el, KF.packet(view.percent, pk.ms, i))
      })
      if (litOf(view.percent) > litOf(p.percent)) play(q('.rx-head > i'), KF.sparkPulse)
      if ([25, 50, 75].some((m) => p.percent < m && view.percent >= m)) play(q('.rx-ping'), KF.pingStage)
    }

    // Compte à rebours : une seconde réelle = une cellule qui s'éteint (CSS), le chiffre qui remonte, le halo qui bat.
    if (phase === 'armed' && readyKey === p.key && left < p.left) {
      if (t === 'full') play(q('.rx-sec'), KF.secIn)
      else play(q('.rx-sec'), KF.fade(120), { level: 'sober' })
      play(q('.rx-glow'), KF.glowTick(left <= 3))
    }
  })

  /** Remplissage de « Redémarrer » en cours (voir plus bas). */
  const charge = useRef<{ el: Element; a: Animation } | null>(null)

  // Fenêtre en arrière-plan : les passages en cours sautent à leur fin (zéro image tant qu'elle est inactive).
  // Le remplissage de « Redémarrer » est géré à part, et l'orbite CSS s'arrête d'elle-même (update.css).
  useLayoutEffect(() => {
    if (active) return
    for (const a of cardRef.current?.getAnimations({ subtree: true }) ?? []) {
      if (a instanceof CSSAnimation || a instanceof CSSTransition) continue
      if ((a.effect as KeyframeEffect | null)?.target === charge.current?.el) continue
      a.finish()
    }
  }, [active, cardRef])

  // Accent d'armement (§6.5) : prête arrivée fenêtre inactive ou en partie, joué au prochain retour, une fois par version.
  useEffect(() => {
    if (accentFor.current !== view.key || phase !== 'armed' || !active || quiet) return
    accentFor.current = null
    const card = cardRef.current
    if (!card || tier() !== 'full') return
    play(card.querySelector('.rx-ping'), KF.pingLock)
    play(card.querySelector('.rx-glow'), ACCENT_GLOW)
    card.querySelectorAll('.rx-cell-lit.on').forEach((el, j) => play(el, cellIn(j)))
    play(card.querySelector('.upd-sheen'), KF.sheen)
  }, [active, quiet, phase, view.key, cardRef])

  // Remplissage de « Redémarrer » (§6.6) : une animation par version, pilotée par currentTime à chaque seconde,
  // en pause hors du compte. Fenêtre en arrière-plan : annulée, le style statique garde la même position.
  useLayoutEffect(() => {
    const el = phase === 'armed' || phase === 'installing' ? (cardRef.current?.querySelector('.upd-charge') ?? null) : null
    let c = charge.current
    if (c && (c.el !== el || !active)) {
      c.a.cancel()
      c = charge.current = null
    }
    if (!el || !active) return
    if (!c) {
      const set = KF.charge(D)
      const a = anim(el, set.frames, set.opts)
      if (!a) return
      a.pause()
      c = charge.current = { el, a }
    }
    c.a.currentTime = (D - left) * 1000
    if (counting) c.a.play()
    else c.a.pause()
  }, [phase, counting, left, active, D, cardRef])
  useEffect(
    () => () => {
      charge.current?.a.cancel()
      for (const a of holds.current) a.cancel()
    },
    []
  )

  // Le pourcentage a baissé (un nouveau téléchargement) : une image sans transition, rien ne balaie à l'envers.
  const lastPct = useRef(0)
  useLayoutEffect(() => {
    const card = cardRef.current
    if (card && phase === 'download' && view.percent < lastPct.current) {
      card.setAttribute('data-reset', '')
      void getComputedStyle(card.querySelector('.upd-stream-win') ?? card).transform
      card.removeAttribute('data-reset')
    }
    lastPct.current = phase === 'download' ? view.percent : 0
  }, [view.percent, phase, cardRef])

  const step = view.kind === 'verify' ? view.step : undefined
  const textKey =
    phase === 'lock'
      ? lock?.swapped
        ? 'ready'
        : 'verify'
      : phase === 'armed' || phase === 'installing'
        ? 'ready'
        : phase === 'interrupted'
          ? `interrupted:${view.code}`
          : phase

  const model: CardModel = {
    phase,
    mini,
    version: view.version,
    id: view.id,
    percent: view.percent,
    p: phase === 'download' ? view.percent / 100 : 1,
    bytes: view.bytes,
    rate: view.rate,
    stalled,
    step,
    hashP: view.hashP,
    fingerprint: view.fingerprint,
    left,
    countdown: D,
    hold,
    errorCode: view.code,
    preview: view.preview,
    textKey,
    lit: litOf(view.percent),
    // Éteintes hors de « prête » : le verrouillage les allume une à une (transition CSS).
    cellsOn: phase === 'lock' ? 10 : phase === 'armed' || phase === 'installing' ? Math.max(0, Math.min(10, Math.round((left * 10) / D))) : 0,
    critical: phase === 'armed' && left <= 3,
    locking: phase === 'lock',
    leaving
  }

  const setHovered = useCallback((v: boolean) => setHoveredState(v), [])
  const setFocusWithin = useCallback((v: boolean) => setFocusWithinState(v), [])
  return { model, restart, later, close, setHovered, setFocusWithin }
}

/** Refusée (§6.8) : le bouclier passe au danger et la croix se tamponne. Aucun mouvement ensuite. */
function refusedCore(q: (sel: string) => Element | null, t: Tier, shieldEnters: boolean): void {
  if (t === 'full') {
    if (shieldEnters) play(q('.rx-shield-svg'), KF.shieldFill)
    play(q('.rx-cross'), KF.stamp, { delay: 200 })
  } else {
    if (shieldEnters) play(q('.rx-shield-svg'), KF.fade(180), { level: 'sober' })
    play(q('.rx-cross'), KF.fade(180), { level: 'sober' })
  }
}
