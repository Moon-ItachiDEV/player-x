// La carte de loadout (choisie par Breezydev le 02/11 : « un mix » de la liste de l'appli BF6 et de l'image de l'arme) :
// le nom du build en italique à la couleur de la classe, l'arme en scène, la jauge à hachures du jeu, puis chaque
// accessoire dans sa case (nom en capitales, emplacement et points). L'image copiée pour Discord est la carte seule.
import { useState } from 'react'
import { SLOT_ORDER } from '@shared/armory/engine'
import { CATEGORY_LABEL, CLASS_LABEL, SLOT_LABEL } from '@shared/armory/labels'
import type { WeaponCategory } from '@shared/armory/types'
import { loadoutPoints, type Bf6Loadout } from '@shared/bf6Loadouts'
import { ClassIcon } from '../ClassIcon'
import { BrandMark } from '../../ui/Brand'
import { DEFS_A, RIFLE_A, SNIPER_A } from './weaponArt'
import './cards.css'

/** Ce qu'une carte affiche : un loadout enregistré, ou le formulaire de l'atelier en cours. */
export type CardData = Pick<Bf6Loadout, 'cls' | 'parts'> &
  Partial<Pick<Bf6Loadout, 'name' | 'weapon' | 'context' | 'cat' | 'secondary' | 'gadget1' | 'gadget2' | 'grenade' | 'melee' | 'training' | 'notes' | 'updatedAt'>>

const NSLOTS = SLOT_ORDER.length
const sniperLike = (c?: WeaponCategory): boolean => c === 'sniper' || c === 'dmr'
const dateOf = (t?: number): string => {
  const d = t ? new Date(t) : new Date()
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`
}

/** L'arme : son image (512 × 256, fond transparent) si on l'a, sinon la silhouette dessinée. */
function WeaponArt({ image, cat, label }: { image?: string; cat?: WeaponCategory; label: string }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (image && !failed) return <img className="lc-img" src={image} alt={label} draggable={false} onError={() => setFailed(true)} />
  return (
    <svg
      className="lc-svg"
      viewBox="0 0 512 256"
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: `<defs>${DEFS_A}</defs>${sniperLike(cat) ? SNIPER_A : RIFLE_A}` }}
    />
  )
}

/** Le pictogramme des points du jeu (un carré à moitié plein). */
const PtsGlyph = (): React.JSX.Element => (
  <svg className="lc-pg" viewBox="0 0 10 10" aria-hidden="true">
    <rect x=".6" y=".6" width="8.8" height="8.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M.6 9.4 9.4 .6v8.8z" fill="currentColor" />
  </svg>
)
/** La jauge à hachures du jeu : 10 cases, une par tranche de 10 points. */
const Hatch = ({ total, className }: { total: number; className: string }): React.JSX.Element => {
  const on = Math.min(10, Math.round(total / 10))
  return (
    <span className={className} aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < on ? 'on' : ''} />
      ))}
    </span>
  )
}

type Gear = { label: string; value: string }
function gearOf(d: CardData): Gear[] {
  const list: [string, string | undefined][] = [
    ['Secondaire', d.secondary],
    ['Gadget 1', d.gadget1],
    ['Gadget 2', d.gadget2],
    ['Grenade', d.grenade],
    ['Mêlée', d.melee],
    ['Voie', d.training]
  ]
  return list.filter(([, v]) => v?.trim()).map(([label, value]) => ({ label, value: value!.trim() }))
}
const filledOf = (d: CardData): typeof SLOT_ORDER => SLOT_ORDER.filter((s) => d.parts[s]?.name)

/** La carte d'un loadout (un loadout enregistré, ou le formulaire de l'atelier en cours). */
export function LoadoutCardView({ d, image }: { d: CardData; image?: string }): React.JSX.Element {
  const pts = loadoutPoints(d)
  const filled = filledOf(d)
  const weapon = d.weapon?.trim() || 'Arme'
  const title = d.name?.trim() || weapon
  const gear = gearOf(d)
  return (
    <article className={`lc lcm is-${d.cls} ${pts.total > 100 ? 'is-over' : ''}`} aria-label={`${title}, ${weapon}, ${CLASS_LABEL[d.cls]}`}>
      <header className="lcm-h">
        <h3>{title}</h3>
        <span className="lcm-w">
          <ClassIcon name={d.cls} size={14} />
          {weapon}
        </span>
      </header>
      <div className="lcm-gun">
        <WeaponArt image={image} cat={d.cat} label={weapon} />
        {d.cat && <span className="lcm-cat">{CATEGORY_LABEL[d.cat]}</span>}
        <span className="lcm-n num">
          {filled.length}/{NSLOTS}
        </span>
      </div>
      <div className="lcm-pts">
        <Hatch total={pts.total} className="lc-hatch" />
        <b className="num">{pts.total}/100</b>
      </div>
      {filled.length ? (
        <ol className="lcm-rows">
          {filled.map((s) => {
            const p = d.parts[s]!
            return (
              <li key={s}>
                <b>{p.name}</b>
                <span>
                  {SLOT_LABEL[s]}
                  {p.pts !== undefined && (
                    <>
                      <PtsGlyph />
                      <span className="num">{p.pts}</span>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="lc-none">Aucun accessoire pour l’instant.</p>
      )}
      {gear.length > 0 && (
        <div className="lcm-eq">
          {gear.map((g) => (
            <span key={g.label}>
              <em>{g.label}</em>
              {g.value}
            </span>
          ))}
        </div>
      )}
      {d.notes && <p className="lc-notes">{d.notes}</p>}
      <footer className="lc-ft">
        <span className="mk">
          <BrandMark height={13} alt="" />
          Player X
        </span>
        <span>
          {CLASS_LABEL[d.cls]}
          {d.context ? ` · ${d.context}` : ''} · {dateOf(d.updatedAt)}
        </span>
      </footer>
    </article>
  )
}
