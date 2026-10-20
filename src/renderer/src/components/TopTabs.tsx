import { createContext, useContext, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './ui/Icon'

/** Élément de la barre du haut où la page affichée pose ses onglets (null tant qu'il n'est pas monté). */
export const TopSlot = createContext<HTMLElement | null>(null)

export interface TopTab<T extends string> {
  id: T
  label: string
  icon?: IconName
  /** Compteur ou rang affiché après le libellé (« 14 », « 2e »). */
  badge?: string | number
}

interface Props<T extends string> {
  label: string
  tabs: TopTab<T>[]
  value: T
  onChange: (id: T) => void
  /** Préfixe des ids : onglet `${idBase}-tab-${id}`, panneau `${idBase}-panel`. */
  idBase: string
}

/** Onglets de la page, rendus dans la barre du haut. Flèches gauche/droite, Début/Fin : onglet voisin (activation directe). */
export function TopTabs<T extends string>({ label, tabs, value, onChange, idBase }: Props<T>): React.JSX.Element | null {
  const slot = useContext(TopSlot)
  const list = useRef<HTMLDivElement>(null)
  if (!slot) return null

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const i = tabs.findIndex((t) => t.id === value)
    const last = tabs.length - 1
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? last : e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : i <= 0 ? last : i - 1
    onChange(tabs[next].id)
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }

  return createPortal(
    <div ref={list} className="tb-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t) => {
        const on = t.id === value
        return (
          <button
            key={t.id}
            id={`${idBase}-tab-${t.id}`}
            className="tb-tab"
            role="tab"
            aria-selected={on}
            aria-controls={`${idBase}-panel`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
          >
            {t.icon && <Icon name={t.icon} size={16} filled={t.icon === 'star' && on} />}
            {t.label}
            {t.badge !== undefined && <span className="tb-tab-badge num">{t.badge}</span>}
          </button>
        )
      })}
    </div>,
    slot
  )
}
