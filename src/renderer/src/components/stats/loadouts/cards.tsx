// Les deux cartes de loadout à comparer en vrai (choix « Carte A / Carte B » dans Mes loadouts) :
// - A « Gunsmith » : l'arme au centre, chaque accessoire relié à sa place, comme le menu de personnalisation du jeu ;
// - B « Affiche » : un bloc à la couleur de la classe, le nom de l'arme en très grand, l'arme qui déborde.
// Ce qui est copié en image pour Discord, c'est la carte seule (les boutons sont à côté, jamais dedans).
import { useLayoutEffect, useRef, useState } from 'react'
import { SLOT_ORDER } from '@shared/armory/engine'
import { CATEGORY_LABEL, CLASS_LABEL, SLOT_LABEL, SLOT_SHORT } from '@shared/armory/labels'
import type { SlotId, WeaponCategory } from '@shared/armory/types'
import { loadoutPoints, type Bf6ClassId, type Bf6Loadout } from '@shared/bf6Loadouts'
import { ClassIcon } from '../ClassIcon'
import { BrandMark } from '../../ui/Brand'
import { DEFS_A, DEFS_B, RIFLE_A, RIFLE_B, SNIPER_A, SNIPER_B } from './weaponArt'
import './cards.css'

/** Ce qu'une carte affiche : un loadout enregistré, ou le formulaire de l'atelier en cours. */
export type CardData = Pick<Bf6Loadout, 'cls' | 'parts'> &
  Partial<Pick<Bf6Loadout, 'name' | 'weapon' | 'context' | 'cat' | 'secondary' | 'gadget1' | 'gadget2' | 'grenade' | 'melee' | 'training' | 'notes' | 'updatedAt'>>

const NSLOTS = SLOT_ORDER.length
const sniperLike = (c?: WeaponCategory): boolean => c === 'sniper' || c === 'dmr'

/** Petit numéro de build stable (même loadout = même numéro), pour l'allure « fiche technique ». */
export function buildId(d: CardData): string {
  const s = d.cls + (d.weapon ?? '') + SLOT_ORDER.map((k) => d.parts[k]?.name ?? '').join('|')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 65536).toString(16).toUpperCase().padStart(4, '0')
}
const dateOf = (t?: number): string => {
  const d = t ? new Date(t) : new Date()
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`
}

/** L'arme : son image (512 × 256, fond transparent) si on l'a, sinon la silhouette dessinée. */
function WeaponArt({ style, image, cat, label }: { style: 'a' | 'b'; image?: string; cat?: WeaponCategory; label: string }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (image && !failed) return <img className="lc-img" src={image} alt={label} draggable={false} onError={() => setFailed(true)} />
  const art = style === 'a' ? (sniperLike(cat) ? SNIPER_A : RIFLE_A) : sniperLike(cat) ? SNIPER_B : RIFLE_B
  return (
    <svg className="lc-svg" viewBox="0 0 512 256" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: `<defs>${style === 'a' ? DEFS_A : DEFS_B}</defs>${art}` }} />
  )
}

/* =====================  A · Gunsmith  ===================== */

/** Points d'ancrage de chaque emplacement sur l'arme (repère 512 × 256). */
const ANCHOR: Record<'rifle' | 'sniper', Record<SlotId, [number, number]>> = {
  rifle: {
    optic: [170, 74],
    'optic-accessory': [230, 84],
    accessory: [350, 75],
    'left-accessory': [300, 104],
    muzzle: [492, 112],
    barrel: [444, 112],
    underbarrel: [355, 168],
    magazine: [266, 190],
    ammo: [240, 158],
    'right-accessory': [322, 124],
    ergonomics: [214, 172]
  },
  sniper: {
    optic: [216, 62],
    'optic-accessory': [288, 66],
    accessory: [312, 102],
    'left-accessory': [270, 104],
    muzzle: [491, 110],
    barrel: [420, 110],
    underbarrel: [318, 126],
    magazine: [209, 154],
    ammo: [209, 140],
    'right-accessory': [290, 116],
    ergonomics: [160, 168]
  }
}
const TOP: SlotId[] = ['optic', 'optic-accessory', 'accessory', 'left-accessory', 'muzzle']
const BOTTOM: SlotId[] = ['magazine', 'ammo', 'ergonomics', 'underbarrel', 'right-accessory', 'barrel']
const SHOT_W = 380

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

/** Répartit des emplacements (rangés de gauche à droite) en 3 colonnes au plus, voisins ensemble. */
function columns(list: SlotId[]): SlotId[][] {
  if (!list.length) return []
  const n = Math.min(list.length, 3)
  const groups: SlotId[][] = Array.from({ length: n }, () => [])
  list.forEach((k, i) => groups[Math.floor((i * n) / list.length)].push(k))
  return groups
}

export function CardGunsmith({ d, image }: { d: CardData; image?: string }): React.JSX.Element {
  const ref = useRef<HTMLElement>(null)
  const linesRef = useRef<SVGSVGElement>(null)
  const pts = loadoutPoints(d)
  const over = pts.total > 100
  const shape = sniperLike(d.cat) ? 'sniper' : 'rifle'
  const anc = ANCHOR[shape]
  const filled = SLOT_ORDER.filter((s) => d.parts[s]?.name)
  const byX = (a: SlotId, b: SlotId): number => anc[a][0] - anc[b][0]
  const top = columns(TOP.filter((s) => filled.includes(s)).sort(byX))
  const bot = columns(BOTTOM.filter((s) => filled.includes(s)).sort(byX))
  const empties = SLOT_ORDER.filter((s) => !filled.includes(s))
  const weapon = d.weapon?.trim() || 'Arme'
  const full = Math.floor(Math.min(pts.total, 100) / 10)
  const part = (Math.min(pts.total, 100) % 10) * 10
  const gear: [string, string, string | undefined][] = [
    ['pistol', 'Secondaire', d.secondary],
    [gadgetIcon(d.gadget1 ?? ''), 'Gadget 1', d.gadget1],
    [gadgetIcon(d.gadget2 ?? ''), 'Gadget 2', d.gadget2],
    [/fum|smoke/i.test(d.grenade ?? '') ? 'smoke' : 'frag', 'Grenade', d.grenade],
    ['knife', 'Mêlée', d.melee],
    ['track', 'Voie', d.training]
  ]
  const shownGear = gear.filter(([, , v]) => v?.trim())
  const sig = JSON.stringify([d.parts, d.cat, weapon, d.name, d.context, d.notes, shownGear.length])

  // Les traits : mesurés après la mise en page, de chaque point d'ancrage à la colonne de son étiquette.
  useLayoutEffect(() => {
    const card = ref.current
    const svg = linesRef.current
    const shot = card?.querySelector<HTMLElement>('.lca-shot')
    if (!card || !svg || !shot) return
    const draw = (): void => {
      const W = card.offsetWidth
      const H = card.offsetHeight
      const sl = shot.offsetLeft
      const st = shot.offsetTop
      const sb = st + shot.offsetHeight
      const sc = shot.offsetWidth / 512
      const ax = (k: SlotId): number => sl + anc[k][0] * sc
      const ay = (k: SlotId): number => st + anc[k][1] * sc
      let out = ''
      card.querySelectorAll<HTMLElement>('.lca-col').forEach((col) => {
        const right = col.classList.contains('r')
        const x = right ? col.offsetLeft + col.offsetWidth : col.offsetLeft
        const isTop = col.dataset.where === 'top'
        const yElbow = isTop ? st + 10 : sb - 6
        const yEnd = isTop ? col.offsetTop : col.offsetTop + col.offsetHeight
        out += `<path d="M${x} ${yEnd}V${yElbow}" class="ln"/>`
        for (const k of (col.dataset.slots ?? '').split(' ').filter(Boolean) as SlotId[]) {
          out += `<path d="M${ax(k)} ${ay(k)}L${x} ${yElbow}" class="ln"/><circle cx="${ax(k)}" cy="${ay(k)}" r="6" class="ring"/><circle cx="${ax(k)}" cy="${ay(k)}" r="2.6" class="dot"/>`
        }
      })
      for (const k of empties) out += `<circle cx="${ax(k)}" cy="${ay(k)}" r="4.5" class="empty"/>`
      svg.setAttribute('width', String(W))
      svg.setAttribute('height', String(H))
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
      svg.innerHTML = out
    }
    draw()
    // Polices chargées après coup : les étiquettes changent de taille, on retrace.
    let alive = true
    document.fonts?.ready.then(() => alive && draw())
    return () => {
      alive = false
    }
  }, [sig, anc, empties.join()])

  const col = (g: SlotId[], where: 'top' | 'bot', i: number, n: number): React.JSX.Element => {
    const right = n > 1 && i === n - 1
    const items = where === 'top' ? [...g].reverse() : g
    return (
      <div key={i} className={`lca-col ${right ? 'r' : ''}`} data-where={where} data-slots={g.join(' ')}>
        {items.map((s) => {
          const p = d.parts[s]!
          return (
            <div key={s} className="lca-co" title={`${SLOT_LABEL[s]} : ${p.name}`}>
              <span className="s">
                <span className="sl">{SLOT_SHORT[s]}</span>
                {p.pts !== undefined && <i>+{p.pts}</i>}
              </span>
              <span className="n">{p.name}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <article ref={ref} className={`lc lca ${over ? 'is-over' : ''}`} aria-label={`${d.name || weapon}, ${CLASS_LABEL[d.cls]}, carte Gunsmith`}>
      <span className="lc-crop tl" aria-hidden="true" />
      <span className="lc-crop br" aria-hidden="true" />
      <span className="lca-corner" aria-hidden="true" />
      <header className="lca-hd">
        <div className="lca-hd-main">
          <div className="lca-cls">
            <ClassIcon name={d.cls} size={16} />
            {CLASS_LABEL[d.cls]}
            {d.context && <span>· {d.context}</span>}
          </div>
          <h3 className={`lca-wn ${weapon.length > 8 ? 's' : ''}`}>{weapon}</h3>
          {d.name && <p className="lca-ln">{d.name}</p>}
        </div>
        <div className="lca-id">
          <b>Build #{buildId(d)}</b>
          {dateOf(d.updatedAt)}
          <br />
          {filled.length}/{NSLOTS} empl.
        </div>
      </header>
      {top.length > 0 && <div className="lca-cols top">{top.map((g, i) => col(g, 'top', i, top.length))}</div>}
      <div className="lca-shot" style={{ width: SHOT_W }}>
        <WeaponArt style="a" image={image} cat={d.cat} label={weapon} />
      </div>
      {bot.length > 0 && <div className="lca-cols bot">{bot.map((g, i) => col(g, 'bot', i, bot.length))}</div>}
      {!filled.length && <p className="lca-none">Aucun accessoire pour l’instant.</p>}
      <div className="lca-bud" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pts.total} aria-label="Points d’accessoires">
        <span className="l">Budget</span>
        <div className="lca-segs" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ ['--f' as string]: `${i < full ? 100 : i === full ? part : 0}%` }} />
          ))}
        </div>
        <span className="v num">
          {pts.total}
          <small>/100</small>
        </span>
      </div>
      {shownGear.length > 0 && (
        <dl className="lca-eq">
          {shownGear.map(([icon, k, v]) => (
            <div key={k}>
              <EqIcon name={icon} />
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {d.notes && <p className="lca-notes">{d.notes}</p>}
      <footer className="lca-ft">
        <span>BF6 · Loadout</span>
        <span className="mk">
          <BrandMark height={13} alt="" />
          Player X
        </span>
      </footer>
      <svg ref={linesRef} className="lca-lines" aria-hidden="true" />
    </article>
  )
}

/* =====================  B · Affiche  ===================== */

export function CardAffiche({ d, image }: { d: CardData; image?: string }): React.JSX.Element {
  const pts = loadoutPoints(d)
  const over = pts.total > 100
  const filled = SLOT_ORDER.filter((s) => d.parts[s]?.name)
  const free = SLOT_ORDER.filter((s) => !filled.includes(s))
  const weapon = d.weapon?.trim() || 'Arme'
  const on = Math.min(10, Math.round(pts.total / 10))
  const giant = weapon.split(/\s+/)[0].slice(0, 7)
  const gear: [string, string | undefined][] = [
    ['Sec.', d.secondary],
    ['', d.gadget1],
    ['', d.gadget2],
    ['Gren.', d.grenade],
    ['', d.melee]
  ]
  const shownGear = gear.filter(([, v]) => v?.trim())
  const odd = filled.length % 2 === 1
  const freeBox =
    free.length === 0 ? null : free.length > 4 ? (
      <div className="lcb-free">
        <b>{free.length} emplacements libres</b>
        {pts.total <= 100 && ` · ${100 - pts.total} points restants`}
      </div>
    ) : (
      <div className={`lcb-free ${odd ? 'in' : ''}`}>
        <b>
          {free.length} libre{free.length > 1 ? 's' : ''}
        </b>
        <br />
        {free.map((s) => SLOT_SHORT[s]).join(' · ')}
      </div>
    )
  const sub = [d.name, d.cat ? CATEGORY_LABEL[d.cat] : undefined].filter(Boolean)

  return (
    <article className={`lc lcb is-${d.cls as Bf6ClassId} ${over ? 'is-over' : ''}`} aria-label={`${d.name || weapon}, ${CLASS_LABEL[d.cls]}, carte Affiche`}>
      <div className="lcb-block">
        <span className="lc-crop tl" aria-hidden="true" />
        <span className="lc-crop br" aria-hidden="true" />
        <div className="lcb-giant" aria-hidden="true">
          {giant}
        </div>
        <div className="lcb-tag">
          <ClassIcon name={d.cls} size={16} />
          {CLASS_LABEL[d.cls]}
          {d.context && (
            <>
              <span className="sep" />
              <span className="ctx">{d.context}</span>
            </>
          )}
        </div>
        <div className="lcb-serial">BUILD #{buildId(d)}</div>
      </div>
      <div className={`lcb-gun ${sniperLike(d.cat) ? 'sn' : ''} ${image ? 'has-img' : ''}`}>
        <WeaponArt style="b" image={image} cat={d.cat} label={weapon} />
      </div>
      <div className="lcb-body">
        <div className="lcb-title">
          <div className="lcb-title-main">
            <h3 className={`lcb-wname ${weapon.length > 8 ? 's' : ''}`}>{weapon}</h3>
            {sub.length > 0 && (
              <p className="lcb-lname">
                {d.name && <b>{d.name}</b>}
                {d.name && d.cat && ' · '}
                {d.cat && CATEGORY_LABEL[d.cat]}
              </p>
            )}
          </div>
          <div className="lcb-budget">
            <div className="lcb-big num">
              {pts.total}
              <small>/100</small>
            </div>
            <div className="lcb-gauge" role="img" aria-label={`${pts.total} points sur 100`}>
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} className={i < on ? 'on' : ''} />
              ))}
            </div>
          </div>
        </div>
        <div className="lcb-label">
          Accessoires{' '}
          <span className="n">
            {filled.length}/{NSLOTS}
          </span>
        </div>
        {filled.length > 0 ? (
          <>
            <div className="lcb-grid">
              {filled.map((s) => {
                const p = d.parts[s]!
                return (
                  <div key={s} className="lcb-att">
                    <span className="s">{SLOT_LABEL[s]}</span>
                    <span className="v" title={p.name}>
                      {p.name}
                    </span>
                    <span className={`p num ${p.pts === 0 ? 'z' : ''}`}>{p.pts ?? '–'}</span>
                  </div>
                )
              })}
              {free.length > 0 && free.length <= 4 && odd && freeBox}
            </div>
            {(free.length > 4 || (free.length > 0 && !odd)) && freeBox}
          </>
        ) : (
          freeBox
        )}
        {(shownGear.length > 0 || d.training) && (
          <>
            <div className="lcb-label">Équipement</div>
            <div className="lcb-gear">
              {shownGear.map(([k, v], i) => (
                <span key={i} className="lcb-pill">
                  {k && <em>{k}</em>}
                  {v}
                </span>
              ))}
              {d.training && (
                <span className="lcb-pill path">
                  <em>Voie</em>
                  {d.training}
                </span>
              )}
            </div>
          </>
        )}
        {d.notes && <p className="lcb-notes">{d.notes}</p>}
      </div>
      <footer className="lcb-foot">
        <span className="px">
          <BrandMark height={13} alt="" />
          Player X
        </span>
        <span>BF6 · Loadout · {dateOf(d.updatedAt)}</span>
      </footer>
    </article>
  )
}
