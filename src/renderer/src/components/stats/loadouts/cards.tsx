// Les trois cartes de loadout à comparer en vrai (choix « Carte » dans Mes loadouts et dans l'atelier) :
// - C « Appli BF6 » : la liste du profil équipement de l'appli Battlefield, aux couleurs de Player X ;
// - D « Écran du jeu » : le menu « Personnaliser » en carte, vignettes à points et « + » sur les emplacements libres ;
// - E « Fiche » : listes groupées, comme l'atelier, sobre et lisible.
// Ce qui est copié en image pour Discord, c'est la carte seule (les boutons sont à côté, jamais dedans).
import { useState } from 'react'
import { SLOT_ORDER } from '@shared/armory/engine'
import { CATEGORY_LABEL, CLASS_LABEL, SLOT_LABEL, SLOT_SHORT } from '@shared/armory/labels'
import type { WeaponCategory } from '@shared/armory/types'
import { loadoutPoints, type Bf6Loadout } from '@shared/bf6Loadouts'
import { ClassIcon } from '../ClassIcon'
import { BrandMark } from '../../ui/Brand'
import { DEFS_A, RIFLE_A, SNIPER_A } from './weaponArt'
import type { CardStyle } from './store'
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

const EQ_ICON: Record<string, string> = {
  pistol: '<path d="M3 7h16l1 3h-7l-1 2h-3l-1.5 6H4.5L6 10H3z"/><path d="M10 12l.5 2"/>',
  launcher: '<path d="M2 9h13v5H2zM15 10h6v3h-6"/><path d="M6 14l-1.5 5h3L9 14"/>',
  ammo: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M8 9V5h8v4M9 14h6"/>',
  frag: '<circle cx="11" cy="14" r="6"/><path d="M9 8V6h4v2M13 6l4-2.5M8 14h6M11 11v6"/>',
  smoke: '<rect x="8" y="7" width="8" height="14" rx="1.5"/><path d="M10 7V4h4v3M8 12h8"/>',
  knife: '<path d="M3 21l6-6M9 15l2 2M9 15l10-11c1.5 3 .5 7-3 9.5L11 17"/>',
  track: '<path d="M5 18l7-4.5 7 4.5M5 12.5 12 8l7 4.5M5 7l7-4.5L19 7"/>',
  beacon: '<path d="M12 8v8M8.5 8a4.5 4.5 0 0 1 7 0M5.5 5a9 9 0 0 1 13 0"/><rect x="8" y="16" width="8" height="5" rx="1"/>',
  sensor: '<circle cx="12" cy="12" r="2.5"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16"/>',
  medic: '<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M9 7V4h6v3M12 10.5v6M9 13.5h6"/>',
  tool: '<path d="M15 3a5 5 0 0 0-5.7 6.7L3 16l3 3 6.3-6.3A5 5 0 0 0 19 7l-3 3-2.5-.5L13 7z"/>',
  gadget: '<rect x="4" y="6" width="16" height="13" rx="2"/><path d="M9 6V4h6v2M8 12h8"/>'
}
function gadgetIcon(t: string): string {
  const s = t.toLowerCase()
  if (/lance|roquette|m320|launcher/.test(s)) return 'launcher'
  if (/munition|ammo/.test(s)) return 'ammo'
  if (/balise|beacon/.test(s)) return 'beacon'
  if (/capteur|drone|sensor/.test(s)) return 'sensor'
  if (/soin|défib|defib|médic|medic/.test(s)) return 'medic'
  if (/outil|répar|repar|mine|tool/.test(s)) return 'tool'
  return 'gadget'
}
const EqIcon = ({ name }: { name: string }): React.JSX.Element => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: EQ_ICON[name] }} />
)

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

type Gear = { label: string; value: string; icon: string }
function gearOf(d: CardData): Gear[] {
  const list: [string, string | undefined, string][] = [
    ['Secondaire', d.secondary, 'pistol'],
    ['Gadget 1', d.gadget1, gadgetIcon(d.gadget1 ?? '')],
    ['Gadget 2', d.gadget2, gadgetIcon(d.gadget2 ?? '')],
    ['Grenade', d.grenade, /fum|smoke/i.test(d.grenade ?? '') ? 'smoke' : 'frag'],
    ['Mêlée', d.melee, 'knife'],
    ['Voie', d.training, 'track']
  ]
  return list.filter(([, v]) => v?.trim()).map(([label, value, icon]) => ({ label, value: value!.trim(), icon }))
}
const filledOf = (d: CardData): typeof SLOT_ORDER => SLOT_ORDER.filter((s) => d.parts[s]?.name)

/* =====================  C · Appli BF6  ===================== */

export function CardListe({ d }: { d: CardData; image?: string }): React.JSX.Element {
  const pts = loadoutPoints(d)
  const filled = filledOf(d)
  const weapon = d.weapon?.trim() || 'Arme'
  const title = d.name?.trim() || weapon
  const gear = gearOf(d)
  return (
    <article className={`lc lcc is-${d.cls} ${pts.total > 100 ? 'is-over' : ''}`} aria-label={`${title}, ${weapon}, ${CLASS_LABEL[d.cls]}`}>
      <header className="lcc-h">
        <h3>{title}</h3>
        <span className="lcc-w">
          <ClassIcon name={d.cls} size={14} />
          {weapon}
        </span>
      </header>
      <div className="lcc-pts">
        <Hatch total={pts.total} className="lc-hatch" />
        <b className="num">{pts.total}/100</b>
      </div>
      {filled.length ? (
        <ol className="lcc-rows">
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
        <div className="lcc-eq">
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
          {d.context ? ` · ${d.context}` : ''}
        </span>
      </footer>
    </article>
  )
}

/* =====================  D · Écran du jeu  ===================== */

export function CardEcran({ d, image }: { d: CardData; image?: string }): React.JSX.Element {
  const pts = loadoutPoints(d)
  const filled = filledOf(d)
  const weapon = d.weapon?.trim() || 'Arme'
  const gear = gearOf(d)
  return (
    <article className={`lc lcd is-${d.cls} ${pts.total > 100 ? 'is-over' : ''}`} aria-label={`${d.name || weapon}, ${weapon}, ${CLASS_LABEL[d.cls]}`}>
      <div className="lcd-top">
        <span className="lcd-eye">Personnaliser {weapon}</span>
        <h3>{d.name?.trim() || 'Usine'}</h3>
        <span className="lcd-cls">
          <ClassIcon name={d.cls} size={14} />
          {CLASS_LABEL[d.cls]}
          {d.context ? ` · ${d.context}` : ''}
        </span>
        <div className="lcd-pts">
          <b className="num">{pts.total}/100</b>
          <Hatch total={pts.total} className="lc-hatch" />
        </div>
      </div>
      <div className="lcd-gun">
        <WeaponArt image={image} cat={d.cat} label={weapon} />
      </div>
      <div className="lcd-tiles">
        {SLOT_ORDER.map((s) => {
          const p = d.parts[s]
          return p?.name ? (
            <div key={s} className="lcd-tile on" title={`${SLOT_LABEL[s]} : ${p.name}`}>
              {p.pts !== undefined && (
                <span className="tp num">
                  {p.pts}
                  <PtsGlyph />
                </span>
              )}
              <b>{p.name}</b>
              <small>{SLOT_SHORT[s]}</small>
            </div>
          ) : (
            <div key={s} className="lcd-tile">
              <span className="plus" aria-hidden="true">
                +
              </span>
              <small>{SLOT_SHORT[s]}</small>
            </div>
          )
        })}
      </div>
      {gear.length > 0 && (
        <div className="lcd-eq">
          {gear.map((g) => (
            <span key={g.label} title={g.label}>
              <EqIcon name={g.icon} />
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
          BF6 · {filled.length}/{NSLOTS} · {dateOf(d.updatedAt)}
        </span>
      </footer>
    </article>
  )
}

/* =====================  E · Fiche Player X  ===================== */

export function CardFiche({ d, image }: { d: CardData; image?: string }): React.JSX.Element {
  const pts = loadoutPoints(d)
  const filled = filledOf(d)
  const weapon = d.weapon?.trim() || 'Arme'
  const gear = gearOf(d)
  const sub = [d.name?.trim(), d.context?.trim()].filter(Boolean).join(' · ') || (d.cat ? CATEGORY_LABEL[d.cat] : '')
  return (
    <article
      className={`lc lce is-${d.cls} ${pts.total > 100 ? 'is-over' : ''}`}
      style={{ ['--pct' as string]: Math.min(100, pts.total) }}
      aria-label={`${d.name || weapon}, ${weapon}, ${CLASS_LABEL[d.cls]}`}
    >
      <header className="lce-h">
        <div className="lce-thumb">
          <WeaponArt image={image} cat={d.cat} label={weapon} />
        </div>
        <div className="lce-id">
          <span className="lce-cls">
            <ClassIcon name={d.cls} size={13} />
            {CLASS_LABEL[d.cls]}
          </span>
          <h3>{weapon}</h3>
          {sub && <p>{sub}</p>}
        </div>
        <div className="lce-ring" role="img" aria-label={`${pts.total} points sur 100`}>
          <b className="num">{pts.total}</b>
          <small>/100</small>
        </div>
      </header>
      {filled.length ? (
        <div className="lce-list">
          {filled.map((s) => {
            const p = d.parts[s]!
            return (
              <div key={s} className="lce-row">
                <span className="k">{SLOT_SHORT[s]}</span>
                <span className="v" title={p.name}>
                  {p.name}
                </span>
                <span className="p num">{p.pts ?? '–'}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="lc-none">Aucun accessoire pour l’instant.</p>
      )}
      {gear.length > 0 && (
        <div className="lce-list">
          {gear.map((g) => (
            <div key={g.label} className="lce-row g">
              <EqIcon name={g.icon} />
              <span className="k">{g.label}</span>
              <span className="v">{g.value}</span>
            </div>
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
          {filled.length}/{NSLOTS} emplacements · {dateOf(d.updatedAt)}
        </span>
      </footer>
    </article>
  )
}

/** La carte au style choisi. */
export function LoadoutCardView({ style, d, image }: { style: CardStyle; d: CardData; image?: string }): React.JSX.Element {
  return style === 'd' ? <CardEcran d={d} image={image} /> : style === 'e' ? <CardFiche d={d} image={image} /> : <CardListe d={d} image={image} />
}

export const CARD_STYLES: { value: CardStyle; label: string }[] = [
  { value: 'c', label: 'C · Appli BF6' },
  { value: 'd', label: 'D · Écran du jeu' },
  { value: 'e', label: 'E · Fiche' }
]
