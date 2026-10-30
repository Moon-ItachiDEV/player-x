// Fiche d'un jeu : « Ranger » ouvre un menu pour l'ajouter à une collection (ou l'en retirer), en créer une, et le masquer
// de l'Accueil et de la Bibliothèque (ou le réafficher). Rendu dans body, comme PickMenu : position fixe sous le bouton.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cleanName } from '@shared/text'
import type { Game } from '@shared/types'
import { Icon } from '../components/ui/Icon'
import { Menu } from '../components/ui/Overlay'
import { errorMessage, useToast } from '../components/ui/Toasts'
import { shelfActions, useShelves } from './store'
import './shelves.css'

export function ShelfMenu({ game, className = '' }: { game: Game; className?: string }): React.JSX.Element {
  const notify = useToast()
  const { collections, hidden } = useShelves()
  const btn = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // Calé sur le bord droit du bouton (le menu s'élargit quand on nomme une collection : il ne sort pas de la fenêtre).
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const open = pos !== null
  const isHidden = hidden.includes(game.id)
  const title = cleanName(game.name)

  const close = (): void => {
    setPos(null)
    setNaming(false)
    setName('')
  }
  const toggle = (): void => {
    if (open || !btn.current) return close()
    const r = btn.current.getBoundingClientRect()
    setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) })
  }

  // Pas la place sous le bouton : au-dessus.
  useLayoutEffect(() => {
    const menu = menuRef.current?.querySelector<HTMLElement>('.menu')
    if (!open || !menu || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    if (r.bottom + 8 + menu.offsetHeight > window.innerHeight && r.top > window.innerHeight - r.bottom)
      setPos({ bottom: window.innerHeight - r.top + 8, right: Math.max(12, window.innerWidth - r.right) })
  }, [open, naming])

  useEffect(() => {
    if (!open) return
    if (!naming) menuRef.current?.querySelector<HTMLElement>('.menu-item')?.focus()
    const onMove = (e: Event): void => {
      if (!(e.target instanceof Node && menuRef.current?.contains(e.target))) close()
    }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, naming])

  const done = (): void => {
    close()
    btn.current?.focus()
  }

  const fail = (e: unknown): void => notify(errorMessage(e), { kind: 'error' })

  const inCollection = (id: string, on: boolean, label: string): void => {
    shelfActions
      .toggle(id, game.id, on)
      .then(() => notify(on ? `${title} ajouté à « ${label} »` : `${title} retiré de « ${label} »`, { kind: 'success', id: 'shelf' }))
      .catch(fail)
  }

  const create = (): void => {
    const n = name.trim()
    if (!n) return
    shelfActions
      .create(n, game.id)
      .then(() => {
        notify(`Collection « ${n} » créée avec ${title}`, { kind: 'success', id: 'shelf' })
        done()
      })
      .catch(fail)
  }

  const hide = (): void => {
    const on = !isHidden
    done()
    shelfActions
      .hide(game.id, on)
      .then(() =>
        notify(on ? `${title} est masqué de l'Accueil et de la Bibliothèque` : `${title} s'affiche de nouveau`, {
          kind: on ? 'info' : 'success',
          id: 'shelf-hide',
          ...(on ? { action: { label: 'Annuler', onClick: () => void shelfActions.hide(game.id, false).catch(fail) } } : {})
        })
      )
      .catch(fail)
  }

  const onItemKey = (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('.menu-item') ?? [])
    const i = items.indexOf(e.currentTarget)
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Ranger ce jeu : collections, masquer"
        title="Ranger : collections, masquer"
        onMouseDown={(e) => open && e.stopPropagation()}
        onClick={toggle}
      >
        <Icon name="layers" size={20} />
      </button>
      {createPortal(
        <div ref={menuRef}>
          <Menu open={open} onClose={close} style={pos ?? {}} className="shelf-menu">
            <p className="shelf-menu-h" aria-hidden="true">
              Collections
            </p>
            {collections.map((c) => {
              const on = c.games.includes(game.id)
              return (
                <button
                  key={c.id}
                  className="menu-item"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => inCollection(c.id, !on, c.name)}
                  onKeyDown={onItemKey}
                >
                  <span className="picker-check">{on && <Icon name="check" size={16} />}</span>
                  <span className="picker-item-label">{c.name}</span>
                  <span className="picker-hint num">{c.games.length}</span>
                </button>
              )
            })}
            {naming ? (
              <form
                className="shelf-new"
                onSubmit={(e) => {
                  e.preventDefault()
                  create()
                }}
              >
                <label className="sr-only" htmlFor="shelf-new-name">
                  Nom de la nouvelle collection
                </label>
                <input
                  id="shelf-new-name"
                  className="shelf-new-input"
                  autoFocus
                  maxLength={40}
                  placeholder="Avec les potes, À finir…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      setNaming(false)
                    }
                  }}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim()}>
                  Créer
                </button>
              </form>
            ) : (
              <button className="menu-item" role="menuitem" onClick={() => setNaming(true)} onKeyDown={onItemKey}>
                <span className="picker-check">
                  <Icon name="plus" size={16} />
                </span>
                <span className="picker-item-label">Nouvelle collection</span>
              </button>
            )}
            <div className="menu-sep" />
            <button className="menu-item" role="menuitem" onClick={hide} onKeyDown={onItemKey}>
              <span className="picker-check">
                <Icon name={isHidden ? 'eye' : 'eye-off'} size={16} />
              </span>
              <span className="picker-item-label">{isHidden ? 'Réafficher ce jeu' : 'Masquer ce jeu'}</span>
            </button>
          </Menu>
        </div>,
        document.body
      )}
    </>
  )
}
