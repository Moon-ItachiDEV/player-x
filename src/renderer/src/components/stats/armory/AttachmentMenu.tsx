// Choix d'un accessoire dans un emplacement : bouton (emplacement, accessoire, points) et liste déroulante qui défile,
// avec la famille de chaque accessoire, ses effets et ses points. Rendue dans body (comme PickMenu) ; flèches haut/bas
// entre les choix, Échap ferme et rend le focus au bouton.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SLOT_LABEL, tagLabel } from '@shared/armory/labels'
import type { ArmoryAttachment, SlotId } from '@shared/armory/types'
import { Icon } from '../../ui/Icon'
import { Menu } from '../../ui/Overlay'

interface Props {
  slot: SlotId
  options: ArmoryAttachment[]
  value: string | undefined
  /** Emplacement qui peut rester vide (« Aucun »). */
  allowNone: boolean
  onPick: (name: string | undefined) => void
  /** Rien à choisir ici (accessoire d'optique avec une optique qui n'en accepte pas) : la raison. */
  unavailable?: string
  /** Pièce marquée (diffère d'une autre config). */
  marked?: boolean
}

/** Les effets d'un accessoire en pastilles courtes (vert : aide, orange : gêne). */
export function EffectChips({ tags, max = 4 }: { tags?: string[]; max?: number }): React.JSX.Element | null {
  const list = (tags ?? []).map(tagLabel).filter((t): t is NonNullable<ReturnType<typeof tagLabel>> => !!t)
  if (!list.length) return null
  return (
    <span className="ar-chips">
      {list.slice(0, max).map((t, i) => (
        <span key={i} className={`ar-chip ${t.good === true ? 'is-good' : t.good === false ? 'is-bad' : ''}`}>
          {t.text}
        </span>
      ))}
      {list.length > max && <span className="ar-chip">+{list.length - max}</span>}
    </span>
  )
}

export function AttachmentMenu({ slot, options, value, allowNone, onPick, unavailable, marked }: Props): React.JSX.Element {
  const btn = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null)
  const open = pos !== null
  const current = options.find((o) => o.name === value)

  const close = (): void => setPos(null)
  const toggle = (): void => {
    if (open || !btn.current) return close()
    const r = btn.current.getBoundingClientRect()
    const width = Math.max(r.width, 320)
    const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12))
    const below = window.innerHeight - r.bottom - 18
    const above = r.top - 18
    // Assez de place sous le bouton (ou plus que dessus) : en dessous ; sinon au-dessus. La liste défile.
    if (below >= 260 || below >= above) setPos({ top: r.bottom + 6, left, width, maxHeight: Math.max(160, Math.min(440, below)) })
    else setPos({ bottom: window.innerHeight - r.top + 6, left, width, maxHeight: Math.max(160, Math.min(440, above)) })
  }

  useLayoutEffect(() => {
    if (!open) return
    const on = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menuRef.current?.querySelector<HTMLElement>('.menu-item')
    on?.focus({ preventScroll: true })
    on?.scrollIntoView({ block: 'nearest' })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onMove = (e: Event): void => {
      if (!(e.target instanceof Node && menuRef.current?.contains(e.target))) close()
    }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      if (document.activeElement === document.body || document.activeElement === null) btn.current?.focus()
    }
  }, [open])

  const pick = (name: string | undefined): void => {
    close()
    btn.current?.focus()
    if (name !== value) onPick(name)
  }

  const onItemKey = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('.menu-item') ?? [])
    const i = items.indexOf(e.currentTarget)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length
    items[next]?.focus()
    items[next]?.scrollIntoView({ block: 'nearest' })
  }

  const label = SLOT_LABEL[slot]
  if (unavailable) {
    return (
      <div className="ar-pick is-off">
        <span className="ar-pick-slot">{label}</span>
        <span className="ar-pick-name">{unavailable}</span>
      </div>
    )
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`ar-pick ${current ? '' : 'is-empty'} ${marked ? 'is-marked' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} : ${current?.name ?? 'aucun'}${current?.pts != null ? `, ${current.pts} points` : ''}`}
        onMouseDown={(e) => open && e.stopPropagation()}
        onClick={toggle}
      >
        <span className="ar-pick-slot">{label}</span>
        <span className="ar-pick-name">{current?.name ?? 'Aucun'}</span>
        <span className="ar-pick-pts num">{current ? (current.pts ?? '—') : ''}</span>
        <Icon name="chevron-down" size={14} className={`picker-chevron ${open ? 'is-open' : ''}`} />
      </button>
      {createPortal(
        <div ref={menuRef}>
          <Menu open={open} onClose={close} className="ar-menu" style={pos ? { top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight } : {}}>
            <p className="ar-menu-h" aria-hidden="true">
              {label}
              <span>Points</span>
            </p>
            {allowNone && (
              <button className="menu-item ar-opt" role="menuitemradio" aria-checked={!current} onClick={() => pick(undefined)} onKeyDown={onItemKey}>
                <span className="picker-check">{!current && <Icon name="check" size={16} />}</span>
                <span className="ar-opt-text">
                  <span className="ar-opt-name">Aucun</span>
                </span>
                <span className="ar-opt-pts num">0</span>
              </button>
            )}
            {options.map((o) => (
              <button key={o.name} className="menu-item ar-opt" role="menuitemradio" aria-checked={o.name === value} onClick={() => pick(o.name)} onKeyDown={onItemKey}>
                <span className="picker-check">{o.name === value && <Icon name="check" size={16} />}</span>
                <span className="ar-opt-text">
                  <span className="ar-opt-name">{o.name}</span>
                  <span className="ar-opt-type">{o.type}</span>
                  <EffectChips tags={o.tags} max={3} />
                </span>
                <span className="ar-opt-pts num">{o.pts ?? '—'}</span>
              </button>
            ))}
          </Menu>
        </div>,
        document.body
      )}
    </>
  )
}
