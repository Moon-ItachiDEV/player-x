import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Store } from '@shared/types'
import { withViewTransition } from '../../motion'
import { Icon } from '../ui/Icon'
import { Menu } from '../ui/Overlay'
import { KIND_LABEL } from '../ui/StoreTag'

export type LibChip = 'all' | 'fav' | Store
export type LibSort = 'recent' | 'name' | 'launches'

export const SORT_LABEL: Record<LibSort, string> = { recent: 'Récents', name: 'Nom (A–Z)', launches: 'Plus lancés' }
export const STORES: Store[] = ['steam', 'epic', 'ea']

interface ToolbarProps {
  total: number
  /** Nombre de jeux affichés dans la grille (pour « Résultats pour … »). */
  resultCount: number
  counts: Record<LibChip, number>
  chip: LibChip
  sort: LibSort
  query: string
  scanning: boolean
  demo: boolean
  /** Premier scan sans aucun jeu : titre et bouton de scan seulement. */
  loading?: boolean
  onChip: (c: LibChip) => void
  onSort: (s: LibSort) => void
  onClearQuery: () => void
  onRescan: () => void
}

/** Barre collante : titre, puces de filtre, tri, relance du scan. Le filet n'apparaît qu'une fois collée. */
export function LibraryToolbar(props: ToolbarProps): React.JSX.Element {
  const { total, resultCount, counts, chip, sort, query, scanning, demo, loading, onChip, onSort, onClearQuery, onRescan } = props
  const sentinel = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const root = el.closest('.content')
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0)),
      { root }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const chips: { id: LibChip; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'fav', label: 'Favoris' },
    ...STORES.filter((s) => counts[s] > 0).map((s) => ({ id: s, label: KIND_LABEL[s] }))
  ]

  return (
    <>
      <div ref={sentinel} className="lib-sentinel" aria-hidden="true" />
      <div className={`lib-toolbar ${stuck ? 'is-stuck' : ''}`}>
        <div className="lib-tb-title">
          {query ? (
            <>
              <h2 title={query}>Résultats pour « {query} »</h2>
              <span className="num lib-tb-count" aria-live="polite">
                {resultCount}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={onClearQuery}>
                Effacer
              </button>
            </>
          ) : (
            <>
              <h2>Bibliothèque</h2>
              {!loading && <span className="num lib-tb-count">{total}</span>}
              {demo && <span className="pill pill-muted no-dot">Mode démo</span>}
            </>
          )}
        </div>

        {loading ? (
          <span className="caption">Recherche des jeux installés…</span>
        ) : (
          <div className="lib-chips" role="group" aria-label="Filtrer la bibliothèque">
            {chips.map((c) => (
              <button
                key={c.id}
                className={`chip ${chip === c.id ? 'active' : ''}`}
                aria-pressed={chip === c.id}
                // Les jaquettes glissent vers leur nouvelle place (transition de vue).
                onClick={() => c.id !== chip && withViewTransition(() => onChip(c.id), { kind: 'reorder' })}
              >
                {c.id === 'fav' && <Icon name="star" size={12} filled className="lib-chip-star" />}
                {c.id !== 'all' && c.id !== 'fav' && <span className="chip-dot" style={{ background: `var(--store-${c.id})` }} />}
                {c.label}
                <span className="chip-count">{counts[c.id]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="lib-tb-actions">
          {!loading && <SortButton sort={sort} onSort={onSort} />}
          <button
            className="icon-btn"
            aria-label="Relancer le scan"
            title={scanning ? 'Scan en cours…' : 'Relancer le scan'}
            aria-disabled={scanning}
            aria-busy={scanning}
            onClick={() => !scanning && onRescan()}
          >
            <Icon name="refresh" size={18} className={scanning ? 'spin' : ''} />
          </button>
        </div>
      </div>
    </>
  )
}

/** Bouton « Trier : Récents » et son menu (rendu dans body : le flou de la barre casserait le position: fixed). */
function SortButton({ sort, onSort }: { sort: LibSort; onSort: (s: LibSort) => void }): React.JSX.Element {
  const btn = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)
  const open = pos !== null
  const wasOpen = useRef(false)

  const close = (): void => setPos(null)
  const toggle = (): void => {
    if (open || !btn.current) return close()
    const r = btn.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
  }

  // Pas la place sous le bouton : on ouvre le menu au-dessus (hauteur réelle, mesurée avant affichage).
  useLayoutEffect(() => {
    const menu = document.querySelector<HTMLElement>('.lib-sort-menu')
    if (!open || !menu || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    if (r.bottom + 6 + menu.offsetHeight > window.innerHeight && r.top > window.innerHeight - r.bottom) {
      setPos({ bottom: window.innerHeight - r.top + 6, right: window.innerWidth - r.right })
    }
  }, [open])

  useEffect(() => {
    if (open) {
      document.querySelector<HTMLElement>('.lib-sort-menu [aria-checked="true"]')?.focus()
      // Le menu est fixe : on le ferme si la page défile ou si la fenêtre change de taille.
      const onMove = (e: Event): void => {
        if (!(e.target instanceof Node && document.querySelector('.lib-sort-menu')?.contains(e.target))) close()
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

  // Menu fermé d'abord : React l'applique à la fin du clic, avant la capture de l'ancien état.
  const pick = (s: LibSort): void => {
    close()
    btn.current?.focus()
    if (s !== sort) withViewTransition(() => onSort(s), { kind: 'reorder' })
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
        className="btn btn-ghost btn-sm lib-sort"
        aria-haspopup="menu"
        aria-expanded={open}
        // Sans ça, le clic hors menu le fermerait puis ce clic le rouvrirait.
        onMouseDown={(e) => open && e.stopPropagation()}
        onClick={toggle}
      >
        <Icon name="sort" size={16} />
        <span>
          Trier : <strong>{SORT_LABEL[sort]}</strong>
        </span>
        <Icon name="chevron-down" size={14} className={`lib-sort-chevron ${open ? 'is-open' : ''}`} />
      </button>
      {createPortal(
        <Menu open={open} onClose={close} style={pos ?? {}} className="lib-sort-menu">
          {(Object.keys(SORT_LABEL) as LibSort[]).map((s) => (
            <button key={s} className="menu-item" role="menuitemradio" aria-checked={s === sort} onClick={() => pick(s)} onKeyDown={onItemKey}>
              <span className="lib-menu-check">{s === sort && <Icon name="check" size={16} />}</span>
              {SORT_LABEL[s]}
            </button>
          ))}
        </Menu>,
        document.body
      )}
    </>
  )
}
