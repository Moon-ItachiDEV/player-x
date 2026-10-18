// Bandeau de mise à jour, en bas à gauche du contenu : progression 0 → 100 %, puis redémarrage après un compte à rebours.
// « Plus tard » laisse la mise à jour s'installer à la fermeture.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { UpdateState } from '@shared/types'
import type { UpdateNoticeProps } from '../contracts'
import { Icon } from './ui/Icon'
import './update.css'

/** État des mises à jour (processus principal), tenu à jour par l'événement `update:state`. `null` tant qu'il n'est pas connu. */
export function useUpdateState(): [UpdateState | null, (s: UpdateState) => void] {
  const [state, setState] = useState<UpdateState | null>(null)
  useEffect(() => {
    let alive = true
    const off = window.launcher.onUpdateState((s) => alive && setState(s))
    // Un événement arrivé entre-temps est plus récent : on le garde.
    window.launcher
      .getUpdateState()
      .then((s) => alive && setState((cur) => cur ?? s))
      .catch(() => {})
    return () => {
      alive = false
      off()
    }
  }, [])
  return [state, setState]
}

/** Avant le redémarrage automatique, compté seulement quand la fenêtre est au premier plan (jamais en pleine partie). */
const RESTART_DELAY = 10
const RING_R = 17
const RING_C = 2 * Math.PI * RING_R

/** Fenêtre au premier plan : visible et avec le focus. */
function useWindowActive(): boolean {
  const [active, setActive] = useState(() => document.visibilityState === 'visible' && document.hasFocus())
  useEffect(() => {
    const update = (): void => setActive(document.visibilityState === 'visible' && document.hasFocus())
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return active
}

/** Pourcentage affiché : rattrape la valeur réelle en douceur au lieu de sauter d'un palier à l'autre. */
function useSmoothPercent(target: number): number {
  const [shown, setShown] = useState(target)
  const current = useRef(target)
  useEffect(() => {
    if (document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = target
      setShown(target)
      return
    }
    let raf = 0
    const step = (): void => {
      const diff = target - current.current
      current.current = Math.abs(diff) < 0.5 ? target : current.current + diff * 0.12
      setShown(current.current)
      if (current.current !== target) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return shown
}

/** Anneau de progression (0 à 100) autour d'une icône ou du pourcentage. */
function Ring({ value, children, done }: { value: number; children: React.ReactNode; done?: boolean }): React.JSX.Element {
  return (
    <span className={`upd-ring ${done ? 'is-done' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 40 40" width="40" height="40">
        <defs>
          <linearGradient id="upd-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="55%" stopColor="#4f7cff" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle className="upd-ring-track" cx="20" cy="20" r={RING_R} />
        <circle
          className="upd-ring-fill"
          cx="20"
          cy="20"
          r={RING_R}
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - Math.max(0, Math.min(100, value)) / 100)}
        />
      </svg>
      <span className="upd-ring-center">{children}</span>
    </span>
  )
}

export function UpdateNotice({ onOpenAbout }: UpdateNoticeProps): React.JSX.Element | null {
  const [state] = useUpdateState()
  // « Plus tard » masque le bandeau jusqu'au prochain changement d'état (autre version, nouvelle étape).
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)
  const [left, setLeft] = useState(RESTART_DELAY)
  const active = useWindowActive()
  const percent = useSmoothPercent(state?.state === 'downloading' ? state.percent : state?.state === 'ready' ? 100 : 0)

  const key = !state ? '' : state.state === 'ready' || state.state === 'downloading' ? `${state.state}:${state.version}` : state.state
  const counting = state?.state === 'ready' && dismissed !== key && !installing

  const restart = useCallback(async (): Promise<void> => {
    setInstalling(true)
    try {
      await window.launcher.installUpdate()
      // L'appli se ferme dans la foulée ; si rien ne se passe, le bouton redevient utilisable.
      setTimeout(() => setInstalling(false), 15_000)
    } catch {
      setInstalling(false)
    }
  }, [])

  // Compte à rebours : il repart de zéro pour chaque nouvelle version, et se met en pause quand la fenêtre passe en arrière-plan.
  useEffect(() => setLeft(RESTART_DELAY), [key])
  useEffect(() => {
    if (!counting || !active) return
    if (left <= 0) {
      void restart()
      return
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [counting, active, left, restart])

  if (!state || dismissed === key) return null

  if (state.state === 'downloading') {
    const pct = Math.floor(percent)
    return (
      <div className="upd-dock">
        <button
          className="upd-card upd-progress"
          onClick={onOpenAbout}
          title="Voir les détails dans Paramètres › À propos"
          aria-label={`Téléchargement de Player X ${state.version} : ${state.percent} %. Voir les détails`}
        >
          <Ring value={percent}>
            <span className="num">{pct}</span>
          </Ring>
          <span className="upd-text">
            <span className="upd-title">
              Mise à jour <span className="num">{state.version}</span>
            </span>
            <span className="upd-sub">Téléchargement en arrière-plan</span>
            <span className="upd-bar" aria-hidden="true">
              <span className="upd-bar-fill" style={{ transform: `scaleX(${percent / 100})` }} />
            </span>
          </span>
          <span className="upd-pct num" aria-hidden="true">
            {pct} %
          </span>
        </button>
      </div>
    )
  }

  if (state.state !== 'ready') return null

  return (
    <div className="upd-dock">
      <div className="upd-card upd-ready" role="status">
        <Ring value={installing ? 100 : (left / RESTART_DELAY) * 100} done>
          {installing ? <span className="spinner" /> : <Icon name="check" size={16} />}
        </Ring>
        <div className="upd-text">
          <div className="upd-title">
            Player X <span className="num">{state.version}</span> est prête
          </div>
          <div className="upd-sub">
            {installing ? (
              'Redémarrage…'
            ) : active ? (
              <>
                Redémarrage dans <span className="num">{left}</span> s
              </>
            ) : (
              'Redémarrage dès que tu reviens sur Player X'
            )}
          </div>
        </div>
        <div className="upd-actions">
          <button className="btn btn-primary btn-sm" onClick={restart} disabled={installing}>
            Redémarrer
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setDismissed(key)} disabled={installing} title="S'installera à la fermeture de Player X">
            Plus tard
          </button>
        </div>
      </div>
    </div>
  )
}
