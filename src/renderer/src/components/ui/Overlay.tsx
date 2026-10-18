import { useEffect, useRef } from 'react'

/** Ferme sur Échap. */
export function useEscape(active: boolean, onEscape: () => void): void {
  const ref = useRef(onEscape)
  ref.current = onEscape
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') ref.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}

/** Ferme sur clic en dehors de l'élément (et sur Échap). */
export function useDismiss<T extends HTMLElement>(active: boolean, onDismiss: () => void): React.RefObject<T | null> {
  const el = useRef<T>(null)
  const ref = useRef(onDismiss)
  ref.current = onDismiss
  useEscape(active, onDismiss)
  useEffect(() => {
    if (!active) return
    const onDown = (e: MouseEvent): void => {
      if (el.current && !el.current.contains(e.target as Node)) ref.current()
    }
    // Au prochain tick, pour ne pas capter le clic qui a ouvert le menu.
    const t = setTimeout(() => window.addEventListener('mousedown', onDown))
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousedown', onDown)
    }
  }, [active])
  return el
}

interface MenuProps {
  open: boolean
  onClose: () => void
  /** Position fixe du menu (px depuis les bords de la fenêtre). */
  style: React.CSSProperties
  className?: string
  children: React.ReactNode
}

/** Menu flottant. Les éléments sont des `<button className="menu-item">`, séparés par `<div className="menu-sep" />`. */
export function Menu({ open, onClose, style, className = '', children }: MenuProps): React.JSX.Element | null {
  const ref = useDismiss<HTMLDivElement>(open, onClose)
  if (!open) return null
  return (
    <div ref={ref} className={`menu ${className}`} style={style} role="menu">
      {children}
    </div>
  )
}

interface DialogProps {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
  actions: React.ReactNode
}

export function Dialog({ open, title, children, onClose, actions }: DialogProps): React.JSX.Element | null {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <div>{children}</div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
  label?: string
}

export function Segmented<T extends string>({ value, options, onChange, className = '', label }: SegmentedProps<T>): React.JSX.Element {
  return (
    <div className={`seg ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }): React.JSX.Element {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />
}
