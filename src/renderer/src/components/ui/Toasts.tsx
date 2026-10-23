import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { LEAVE_MS, motionReduced } from '../../motion'
import { Icon } from './Icon'

/** trophy : succès rare débloqué (carte dorée). */
export type ToastKind = 'success' | 'error' | 'info' | 'loading' | 'trophy'

export interface ToastOptions {
  kind?: ToastKind
  /** Un toast avec le même id remplace le précédent (ex. « Connexion… » → « Connecté »). */
  id?: string
  /** URL d'avatar à la place de l'icône. */
  avatarUrl?: string
  action?: { label: string; onClick: () => void }
  /** Durée d'affichage en ms, à la place de celle du genre. */
  duration?: number
}

interface Toast extends ToastOptions {
  key: number
  /** Sortie en cours (animation is-leaving), retiré après LEAVE_MS. */
  leaving?: boolean
  id: string
  message: string
  kind: ToastKind
}

export type Notify = (message: string, options?: ToastOptions) => void

const ToastContext = createContext<Notify>(() => {})

/** `const notify = useToast(); notify('Chemin copié', { kind: 'success' })` */
export function useToast(): Notify {
  return useContext(ToastContext)
}

const DURATION: Record<ToastKind, number> = {
  success: 3500,
  info: 3500,
  error: 6000,
  loading: 0,
  trophy: 7000
}

let counter = 0

/** Nettoie le préfixe ajouté par Electron aux erreurs IPC. */
export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }): React.JSX.Element {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const start = useCallback(() => {
    const d = toast.duration ?? DURATION[toast.kind]
    if (d) timer.current = setTimeout(() => closeRef.current(), d)
  }, [toast.kind, toast.duration])
  useEffect(() => {
    start()
    return () => clearTimeout(timer.current)
  }, [start, toast.key])

  return (
    <div
      className={`toast ${toast.kind} ${toast.leaving ? 'is-leaving' : ''}`}
      role="status"
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={start}
    >
      <span className="toast-icon">
        {toast.avatarUrl ? (
          <img src={toast.avatarUrl} alt="" />
        ) : toast.kind === 'loading' ? (
          <span className="spinner" />
        ) : (
          <Icon
            name={toast.kind === 'success' ? 'check-circle' : toast.kind === 'error' ? 'alert-circle' : toast.kind === 'trophy' ? 'trophy' : 'info'}
            size={18}
          />
        )}
      </span>
      <span>{toast.message}</span>
      {toast.action ? (
        <button
          className="link-btn"
          onClick={() => {
            toast.action!.onClick()
            onClose()
          }}
        >
          {toast.action.label}
        </button>
      ) : (
        <span />
      )}
      <button className="icon-btn toast-close" onClick={onClose} aria-label="Fermer" title="Fermer">
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])

  const notify = useCallback<Notify>((message, options = {}) => {
    const key = ++counter
    const toast: Toast = {
      ...options,
      key,
      id: options.id ?? `t${key}`,
      message,
      kind: options.kind ?? 'info'
    }
    setToasts((list) => [...list.filter((t) => t.id !== toast.id), toast].slice(-3))
  }, [])

  const close = useCallback((id: string) => {
    const remove = (): void => setToasts((list) => list.filter((t) => t.id !== id || !t.leaving))
    if (motionReduced()) {
      setToasts((list) => list.filter((t) => t.id !== id))
      return
    }
    // Sortie animée, puis retrait ; un toast qui revient entre-temps avec le même id (nouvelle clé) est gardé.
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(remove, LEAVE_MS)
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <ToastItem key={t.key} toast={t} onClose={() => close(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
