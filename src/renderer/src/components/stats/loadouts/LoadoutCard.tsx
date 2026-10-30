// Une carte de loadout : classe, nom, arme et accessoires (points), équipement, notes. Version complète (Stats, avec
// ses actions) ou compacte (fiche du jeu). « Copier l'image » copie la carte telle qu'affichée, sans ses boutons.
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SLOT_ORDER } from '@shared/armory/engine'
import { CLASS_LABEL, SLOT_LABEL } from '@shared/armory/labels'
import { WEAPON_IMAGE, armoryWeaponByName, weaponKey } from '@shared/armory/weapons'
import { loadoutPoints, loadoutText, type Bf6Loadout } from '@shared/bf6Loadouts'
import { ClassIcon } from '../ClassIcon'
import { Icon } from '../../ui/Icon'
import { Menu } from '../../ui/Overlay'
import { errorMessage, useToast } from '../../ui/Toasts'

/** Arme vue dans les stats gametools du joueur : son image. */
export interface WeaponHint {
  name: string
  image?: string
}

export function weaponImage(name: string, hints: WeaponHint[]): string | undefined {
  const k = weaponKey(name)
  const armory = armoryWeaponByName(name)
  return hints.find((h) => h.image && weaponKey(h.name) === k)?.image ?? (armory ? WEAPON_IMAGE[armory.id] : undefined)
}

/** Hauteur du menu « Plus d'actions » (3 actions et un séparateur). */
const MENU_H = 150

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

interface Props {
  l: Bf6Loadout
  hints: WeaponHint[]
  compact?: boolean
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

export function LoadoutCard({ l, hints, compact, onEdit, onDuplicate, onDelete }: Props): React.JSX.Element {
  const notify = useToast()
  const ref = useRef<HTMLElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const [menu, setMenu] = useState<{
    top?: number
    bottom?: number
    right: number
  } | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const image = weaponImage(l.weapon, hints)
  const pts = loadoutPoints(l)
  const parts = SLOT_ORDER.filter((s) => l.parts[s])
  const gear: [string, string | undefined][] = [
    ['Arme secondaire', l.secondary],
    ['Gadgets', [l.gadget1, l.gadget2].filter(Boolean).join(' · ') || undefined],
    ['Grenade', l.grenade],
    ['Mêlée', l.melee],
    ['Voie d’entraînement', l.training]
  ]
  const shownGear = gear.filter(([, v]) => v)

  const copyImage = async (): Promise<void> => {
    const el = ref.current
    if (!el) return
    setCapturing(true)
    try {
      el.scrollIntoView({ block: 'center' })
      await nextFrame()
      const r = el.getBoundingClientRect()
      await window.launcher.copyAreaImage({
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height
      })
      notify(`Image de « ${l.name} » copiée : colle-la sur Discord avec Ctrl V`, { kind: 'success', id: 'loadout-copy' })
    } catch (e) {
      notify(errorMessage(e), { kind: 'error' })
    } finally {
      setCapturing(false)
    }
  }
  const copyText = (): void => {
    navigator.clipboard
      .writeText(loadoutText(l))
      .then(() =>
        notify(`Texte de « ${l.name} » copié`, {
          kind: 'success',
          id: 'loadout-copy'
        })
      )
      .catch((e) => notify(errorMessage(e), { kind: 'error' }))
  }
  const openMenu = (): void => {
    if (menu || !moreRef.current) return setMenu(null)
    const r = moreRef.current.getBoundingClientRect()
    const right = Math.max(12, window.innerWidth - r.right)
    // Le menu (trois actions) tient sous le bouton, sinon il s'ouvre au-dessus.
    setMenu(r.bottom + 6 + MENU_H > window.innerHeight ? { bottom: window.innerHeight - r.top + 6, right } : { top: r.bottom + 6, right })
  }
  const run = (fn?: () => void): void => {
    setMenu(null)
    fn?.()
  }

  return (
    <article ref={ref} className={`lo-card is-${l.cls} ${compact ? 'is-compact' : ''} ${capturing ? 'is-capturing' : ''}`} aria-label={`${l.name}, ${CLASS_LABEL[l.cls]}`}>
      <header className="lo-card-head">
        <span className="lo-class">
          <ClassIcon name={l.cls} size={18} />
          {CLASS_LABEL[l.cls]}
        </span>
        {l.context && <span className="lo-context">{l.context}</span>}
      </header>
      <h3 className="lo-name">{l.name}</h3>

      <div className="lo-weapon">
        <span className="lo-weapon-art" aria-hidden="true">
          {image && !imgFailed ? (
            <img src={image} alt="" loading="lazy" draggable={false} onError={() => setImgFailed(true)} />
          ) : (
            <span className="lo-weapon-ghost">{l.weapon}</span>
          )}
        </span>
        <span className="lo-weapon-text">
          <span className="lo-weapon-name">{l.weapon}</span>
          {pts.count > 0 && (
            <span className={`lo-pts ${pts.total > 100 ? 'is-over' : ''}`}>
              <span className="num">{pts.total}</span> / 100 points
              {pts.missing > 0 && <span className="caption"> · {pts.missing} sans points</span>}
            </span>
          )}
        </span>
      </div>

      {parts.length > 0 && (
        <ul className="lo-parts">
          {parts.map((s) => (
            <li key={s}>
              <span className="lo-part-slot">{SLOT_LABEL[s]}</span>
              <span className="lo-part-name">{l.parts[s]!.name}</span>
              <span className="lo-part-pts num">{l.parts[s]!.pts ?? ''}</span>
            </li>
          ))}
        </ul>
      )}

      {shownGear.length > 0 && (
        <dl className="lo-gear">
          {shownGear.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {l.notes && !compact && <p className="lo-notes">{l.notes}</p>}

      {!compact && (
        <footer className="lo-card-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
            <Icon name="pencil" size={15} />
            Modifier
          </button>
          <button type="button" className="icon-btn" aria-label={`Copier l’image de « ${l.name} »`} title="Copier l’image (pour Discord)" onClick={() => void copyImage()}>
            <Icon name="image" size={17} />
          </button>
          <button
            ref={moreRef}
            type="button"
            className="icon-btn"
            aria-haspopup="menu"
            aria-expanded={!!menu}
            aria-label={`Plus d’actions pour « ${l.name} »`}
            title="Plus d’actions"
            onMouseDown={(e) => menu && e.stopPropagation()}
            onClick={openMenu}
          >
            <Icon name="more" size={18} />
          </button>
          {createPortal(
            <Menu open={!!menu} onClose={() => setMenu(null)} style={menu ?? {}} className="lo-menu">
              <button className="menu-item" role="menuitem" onClick={() => run(copyText)}>
                <span className="picker-check">
                  <Icon name="clipboard" size={16} />
                </span>
                Copier le texte
              </button>
              <button className="menu-item" role="menuitem" onClick={() => run(onDuplicate)}>
                <span className="picker-check">
                  <Icon name="copy" size={16} />
                </span>
                Dupliquer
              </button>
              <div className="menu-sep" />
              <button className="menu-item is-danger" role="menuitem" onClick={() => run(onDelete)}>
                <span className="picker-check">
                  <Icon name="trash" size={16} />
                </span>
                Supprimer…
              </button>
            </Menu>,
            document.body
          )}
        </footer>
      )}
    </article>
  )
}
