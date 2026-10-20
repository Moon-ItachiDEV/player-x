import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { Menu } from './Overlay'

export interface PickOption<T extends string> {
  value: T
  label: string
  /** Texte discret à droite (compteur). */
  hint?: string | number
}

interface Props<T extends string> {
  /** « Store », « Trier par »… */
  label: string
  value: T
  options: PickOption<T>[]
  onPick: (v: T) => void
  /** Texte du bouton pour la valeur choisie (par défaut : son libellé). */
  display?: string
  className?: string
}

/**
 * Menu déroulant « Libellé : Valeur ▾ » (un seul choix). Le menu est rendu dans body : le flou d'une barre
 * collante casserait son position: fixed. Flèches haut/bas entre les choix, Échap ferme et rend le focus.
 */
export function PickMenu<T extends string>({ label, value, options, onPick, display, className = '' }: Props<T>): React.JSX.Element {
  const btn = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null)
  const open = pos !== null
  const wasOpen = useRef(false)
  const current = options.find((o) => o.value === value)

  const close = (): void => setPos(null)
  const toggle = (): void => {
    if (open || !btn.current) return close()
    const r = btn.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: r.left })
  }

  // Pas la place sous le bouton : on ouvre le menu au-dessus (hauteur réelle, mesurée avant affichage).
  useLayoutEffect(() => {
    const menu = menuRef.current?.querySelector<HTMLElement>('.menu')
    if (!open || !menu || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 12)
    if (r.bottom + 6 + menu.offsetHeight > window.innerHeight && r.top > window.innerHeight - r.bottom) {
      setPos({ bottom: window.innerHeight - r.top + 6, left })
    } else if (left !== r.left) {
      setPos({ top: r.bottom + 6, left })
    }
  }, [open])

  useEffect(() => {
    if (open) {
      menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
      // Le menu est fixe : on le ferme si la page défile ou si la fenêtre change de taille.
      const onMove = (e: Event): void => {
        if (!(e.target instanceof Node && menuRef.current?.contains(e.target))) close()
      }
      window.addEventListener('scroll', onMove, true)
      window.addEventListener('resize', onMove)
      wasOpen.current = true
      return () => {
        window.removeEventListener('scroll', onMove, true)
        window.removeEventListener('resize', onMove)
      }
    }
    // À la fermeture (Échap), rendre le focus au bouton s'il s'est perdu.
    if (wasOpen.current && (document.activeElement === document.body || document.activeElement === null)) btn.current?.focus()
    wasOpen.current = false
  }, [open])

  const pick = (v: T): void => {
    close()
    btn.current?.focus()
    if (v !== value) onPick(v)
  }

  const onItemKey = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = Array.from(e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('.menu-item') ?? [])
    const i = items.indexOf(e.currentTarget)
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
  }

  return (
    <>
      <button
        ref={btn}
        className={`picker ${className}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} : ${current?.label ?? value}`}
        // Sans ça, le clic hors menu le fermerait puis ce clic le rouvrirait.
        onMouseDown={(e) => open && e.stopPropagation()}
        onClick={toggle}
      >
        <span className="picker-label">{label} :</span>
        <strong>{display ?? current?.label ?? value}</strong>
        <Icon name="chevron-down" size={14} className={`picker-chevron ${open ? 'is-open' : ''}`} />
      </button>
      {createPortal(
        <div ref={menuRef}>
          <Menu open={open} onClose={close} style={pos ?? {}} className="picker-menu">
            {options.map((o) => (
              <button
                key={o.value}
                className="menu-item"
                role="menuitemradio"
                aria-checked={o.value === value}
                onClick={() => pick(o.value)}
                onKeyDown={onItemKey}
              >
                <span className="picker-check">{o.value === value && <Icon name="check" size={16} />}</span>
                <span className="picker-item-label">{o.label}</span>
                {o.hint !== undefined && <span className="picker-hint num">{o.hint}</span>}
              </button>
            ))}
          </Menu>
        </div>,
        document.body
      )}
    </>
  )
}
