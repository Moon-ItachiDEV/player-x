import { useRef } from 'react'

// Onglets d'un jeu sur la page Stats : soulignés sur le filet du bas, avec à droite la source des chiffres (et, pour
// Battlefield 6, le profil relié). Flèches gauche/droite, Début/Fin : onglet voisin (activation directe).

export interface TabDef<T extends string> {
  id: T
  label: string
  /** Rang ou compteur après le libellé (« 2e »). */
  badge?: string
}

interface Props<T extends string> {
  label: string
  /** Préfixe des ids : onglet `${idBase}-tab-${id}`, panneau `${idBase}-panel`. */
  idBase: string
  tabs: TabDef<T>[]
  value: T
  onChange: (id: T) => void
  children?: React.ReactNode
}

export function StatsTabs<T extends string>({ label, idBase, tabs, value, onChange, children }: Props<T>): React.JSX.Element {
  const list = useRef<HTMLDivElement>(null)

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const i = tabs.findIndex((t) => t.id === value)
    const last = tabs.length - 1
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? last : e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : i <= 0 ? last : i - 1
    onChange(tabs[next].id)
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div className="bf-tabbar">
      <div ref={list} className="bf-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((t) => {
          const on = t.id === value
          return (
            <button
              key={t.id}
              id={`${idBase}-tab-${t.id}`}
              className="bf-tab"
              role="tab"
              aria-selected={on}
              aria-controls={`${idBase}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(t.id)}
            >
              {t.label}
              {t.badge !== undefined && <span className="bf-tab-badge num">{t.badge}</span>}
            </button>
          )
        })}
      </div>
      {children && <div className="bf-tabbar-side">{children}</div>}
    </div>
  )
}
