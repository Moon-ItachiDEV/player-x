// Champ avec suggestions (remplace les listes du navigateur, illisibles et peintes en bleu par Chromium) :
// la liste s'ouvre sous la rangée, se filtre en tapant (texte trouvé surligné), montre les points de chaque
// accessoire, et se pilote au clavier (flèches, Entrée, Échap). La saisie libre reste toujours possible.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ComboOption {
  value: string
  /** Petite ligne sous le nom (famille, catégorie…). */
  sub?: string
  pts?: number
}

interface Props {
  id: string
  value: string
  options: ComboOption[]
  onChange: (text: string) => void
  /** Choix dans la liste (sinon, la saisie reste telle quelle). */
  onPick: (o: ComboOption) => void
  /** Titre de la liste et source des suggestions (« Tes builds Z84M »). */
  title: string
  source?: string
  /** Proposer « Vider » quand le champ est rempli. */
  onClear?: () => void
  placeholder?: string
  maxLength?: number
  className?: string
  invalid?: boolean
  describedBy?: string
  onBlur?: () => void
  onFocus?: () => void
  inputRef?: React.Ref<HTMLInputElement>
}

const MAX_H = 300

function highlight(s: string, q: string): React.ReactNode {
  if (!q) return s
  const i = s.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return s
  return (
    <>
      {s.slice(0, i)}
      <mark>{s.slice(i, i + q.length)}</mark>
      {s.slice(i + q.length)}
    </>
  )
}

export function Combo(p: Props): React.JSX.Element {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<React.CSSProperties>({})

  const cur = p.value.trim().toLowerCase()
  const exact = p.options.some((o) => o.value.toLowerCase() === cur)
  const q = exact ? '' : query
  const shown = p.options.filter((o) => !q || o.value.toLowerCase().includes(q.toLowerCase()) || (o.sub ?? '').toLowerCase().includes(q.toLowerCase()))
  const items: (ComboOption | 'clear')[] = [...shown, ...(p.onClear && p.value.trim() && !q ? (['clear'] as const) : [])]

  const place = (): void => {
    const row = (inputRef.current?.closest('.la-row') ?? inputRef.current) as HTMLElement | null
    if (!row) return
    const r = row.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - 12
    const up = below < 200 && r.top > below
    setPos({
      left: Math.max(8, r.left),
      width: Math.min(r.width, window.innerWidth - 16),
      ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      maxHeight: Math.max(160, Math.min(MAX_H, (up ? r.top : below) - 12))
    })
  }

  const show = (fromTyping: boolean): void => {
    setQuery(fromTyping ? p.value : '')
    setOpen(true)
  }
  useLayoutEffect(() => {
    if (!open) return
    place()
    // Choix en cours présélectionné, sinon la première suggestion quand on tape.
    const sel = items.findIndex((o) => o !== 'clear' && o.value.toLowerCase() === cur)
    setActive(sel >= 0 ? sel : q && shown.length ? 0 : -1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q, p.options.length])
  useEffect(() => {
    if (!open) return
    const onScroll = (e: Event): void => {
      if (popRef.current?.contains(e.target as Node)) return
      place()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
    }
  })
  useEffect(() => {
    if (!open || active < 0) return
    popRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const choose = (i: number): void => {
    const o = items[i]
    if (!o) return
    if (o === 'clear') p.onClear?.()
    else p.onPick(o)
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      return show(false)
    }
    if (!open) return
    const n = items.length
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault()
      setActive((a) => (a + 1) % n)
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault()
      setActive((a) => (a - 1 + n) % n)
    } else if (e.key === 'Enter') {
      if (active >= 0) {
        e.preventDefault()
        choose(active)
      } else setOpen(false)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === 'Tab') setOpen(false)
  }

  const setRef = (el: HTMLInputElement | null): void => {
    inputRef.current = el
    if (typeof p.inputRef === 'function') p.inputRef(el)
    else if (p.inputRef) (p.inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el
  }

  const hasList = p.options.length > 0 || !!p.onClear
  return (
    <>
      <input
        ref={setRef}
        id={p.id}
        className={p.className}
        value={p.value}
        maxLength={p.maxLength}
        placeholder={p.placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && hasList}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={p.invalid || undefined}
        aria-describedby={p.describedBy}
        onFocus={() => {
          p.onFocus?.()
          if (hasList) show(false)
        }}
        onMouseDown={() => !open && hasList && document.activeElement === inputRef.current && show(false)}
        onBlur={() => {
          setOpen(false)
          p.onBlur?.()
        }}
        onChange={(e) => {
          p.onChange(e.target.value)
          setQuery(e.target.value)
          if (hasList) setOpen(true)
        }}
        onKeyDown={onKey}
      />
      {open &&
        hasList &&
        createPortal(
          <div ref={popRef} className="la-pick" id={listId} role="listbox" aria-label={p.title} style={pos} onMouseDown={(e) => e.preventDefault()}>
            <div className="la-pick-h">
              <span>{p.title}</span>
              {p.source && <b>{p.source}</b>}
            </div>
            {shown.map((o, i) => {
              const sel = o.value.toLowerCase() === cur
              return (
                <div
                  key={o.value}
                  id={`${listId}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={sel}
                  className={`la-opt ${i === active ? 'on' : ''}`}
                  onMouseMove={() => i !== active && setActive(i)}
                  onClick={() => choose(i)}
                >
                  <svg className="ck" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 8.5l3.2 3L13 4.5" />
                  </svg>
                  <span className="nm">
                    <b>{highlight(o.value, q)}</b>
                    {o.sub && o.sub.toLowerCase() !== o.value.toLowerCase() && <small>{o.sub}</small>}
                  </span>
                  {o.pts !== undefined ? <span className="pt num">{o.pts}</span> : <span />}
                </div>
              )
            })}
            {!shown.length && (
              <div className="la-pick-empty">
                {p.value.trim() ? (
                  <>
                    Aucune suggestion : <b>{p.value.trim()}</b> sera gardé tel quel.
                  </>
                ) : (
                  'Pas encore de suggestion : écris-le tel que le jeu l’affiche.'
                )}
              </div>
            )}
            {items[items.length - 1] === 'clear' && (
              <>
                <div className="la-pick-sep" />
                <div
                  id={`${listId}-${items.length - 1}`}
                  data-i={items.length - 1}
                  role="option"
                  aria-selected={false}
                  className={`la-opt clear ${active === items.length - 1 ? 'on' : ''}`}
                  onMouseMove={() => setActive(items.length - 1)}
                  onClick={() => choose(items.length - 1)}
                >
                  <span />
                  <span className="nm">
                    <b>Vider l’emplacement</b>
                  </span>
                  <span />
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  )
}
