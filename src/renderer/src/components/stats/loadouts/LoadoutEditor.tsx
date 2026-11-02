// L'atelier : créer ou modifier un loadout, avec la carte en direct à côté (A « Gunsmith » ou B « Affiche »).
// - Rien ne se perd : chaque modification est gardée (brouillon) et se reprend après une fermeture ou un plantage.
// - Rien ne se ressaisit : les accessoires d'une arme déjà notée (« Mes armes »), relevés en jeu ou des builds
//   modèles sont proposés avec leurs points ; on peut aussi partir d'un build modèle.
// - Nom et arme obligatoires ; une erreur ne s'affiche qu'après avoir quitté le champ (ou à l'enregistrement).
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { SLOT_ORDER, opticAccessories, pickAtt } from '@shared/armory/engine'
import { BF6_CLASSES, CATEGORY_LABEL, CLASS_LABEL, SLOT_LABEL, SLOT_SHORT } from '@shared/armory/labels'
import type { Build, SlotId, WeaponCategory } from '@shared/armory/types'
import { ARMORY_WEAPONS, armoryWeaponByName } from '@shared/armory/weapons'
import {
  NAME_MAX,
  NOTES_MAX,
  TEXT_MAX,
  TIERS,
  WEAPON_CATEGORIES,
  type Bf6Tier,
  loadoutPoints,
  suggestName,
  type Bf6ClassId,
  type Bf6Loadout,
  type Bf6LoadoutPart
} from '@shared/bf6Loadouts'
import { BF6_WEAPONS, BUILD_TEMPLATES, knownCategory, myWeaponKey, suggestParts, type BuildTemplate } from '@shared/bf6Workshop'
import { timeAgo } from '@shared/text'
import { ClassIcon } from '../ClassIcon'
import { Icon } from '../../ui/Icon'
import { errorMessage, useToast } from '../../ui/Toasts'
import { LoadoutCardView, type CardData } from './cards'
import { Combo, type ComboOption } from './Combo'
import { draftActions, loadoutActions, useMyWeapons, type LoadoutDraft } from './store'
import { weaponImage, type WeaponHint } from './LoadoutCard'
import './atelier.css'

type GearKey = 'secondary' | 'gadget1' | 'gadget2' | 'grenade' | 'melee' | 'training'
const GEAR: { key: GearKey; label: string; empty: string; defaults: string[] }[] = [
  { key: 'secondary', label: 'Secondaire', empty: 'Aucune', defaults: ['P18', 'ES 5.7', 'M45A1', 'M44'] },
  { key: 'gadget1', label: 'Gadget 1', empty: 'Aucun', defaults: [] },
  { key: 'gadget2', label: 'Gadget 2', empty: 'Aucun', defaults: [] },
  { key: 'grenade', label: 'Grenade', empty: 'Aucune', defaults: ['Frag', 'Fumigène', 'Incendiaire', 'Flash'] },
  { key: 'melee', label: 'Mêlée', empty: 'Aucune', defaults: ['Couteau'] },
  { key: 'training', label: 'Voie', empty: 'Aucune', defaults: [] }
]
const GADGETS = [
  'Lance-grenades M320',
  'Pack de munitions',
  'Défibrillateur',
  'Caisse de soins',
  'Lance-roquettes',
  'Outil de réparation',
  'Balise de déploiement',
  'Capteur de mouvement'
]

interface Form {
  name: string
  cls: Bf6ClassId
  context: string
  weapon: string
  cat: WeaponCategory | ''
  tier: Bf6Tier | ''
  parts: Partial<Record<SlotId, { name: string; pts: string }>>
  gear: Record<GearKey, string>
  notes: string
}

function toForm(d: LoadoutDraft, list: Bf6Loadout[]): Form {
  const cls = d.cls ?? 'assault'
  const parts: Form['parts'] = {}
  for (const s of SLOT_ORDER) {
    const p = d.parts?.[s]
    if (p) parts[s] = { name: p.name, pts: p.pts === undefined ? '' : String(p.pts) }
  }
  return {
    name: d.name ?? suggestName(list, cls),
    cls,
    context: d.context ?? '',
    weapon: d.weapon ?? '',
    cat: d.cat ?? '',
    tier: d.tier ?? '',
    parts,
    gear: { secondary: d.secondary ?? '', gadget1: d.gadget1 ?? '', gadget2: d.gadget2 ?? '', grenade: d.grenade ?? '', melee: d.melee ?? '', training: d.training ?? '' },
    notes: d.notes ?? ''
  }
}

/** Points saisis : un entier de 0 à 100, ou rien. */
const ptsOf = (s: string): number | undefined | null => {
  const t = s.trim()
  if (!t) return undefined
  return /^\d{1,3}$/.test(t) && Number(t) <= 100 ? Number(t) : null
}

/** Le formulaire en loadout (ce qui est enregistré, gardé en brouillon et montré sur la carte). */
function toLoadout(f: Form): Omit<LoadoutDraft, 'id'> & { parts: Partial<Record<SlotId, Bf6LoadoutPart>> } {
  const parts: Partial<Record<SlotId, Bf6LoadoutPart>> = {}
  for (const s of SLOT_ORDER) {
    const p = f.parts[s]
    if (!p?.name.trim()) continue
    const pts = ptsOf(p.pts)
    parts[s] = typeof pts === 'number' ? { name: p.name.trim(), pts } : { name: p.name.trim() }
  }
  const armory = armoryWeaponByName(f.weapon)
  return {
    name: f.name,
    cls: f.cls,
    context: f.context,
    weapon: f.weapon,
    ...(f.cat ? { cat: f.cat } : {}),
    ...(f.tier ? { tier: f.tier } : {}),
    ...(armory ? { armoryId: armory.id } : {}),
    parts,
    ...f.gear,
    notes: f.notes
  }
}

interface Props {
  initial: LoadoutDraft
  list: Bf6Loadout[]
  hints: WeaponHint[]
  onCancel: () => void
  onSaved: (l: Bf6Loadout) => void
}

type Status = { kind: 'clean' } | { kind: 'pending' } | { kind: 'kept'; at: number } | { kind: 'error' }

export function LoadoutEditor({ initial, list, hints, onCancel, onSaved }: Props): React.JSX.Element {
  const notify = useToast()
  const uid = useId()
  const resumed = !!(initial as { resumed?: boolean }).resumed
  const [form, setForm] = useState<Form>(() => toForm(initial, list))
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(resumed ? { kind: 'kept', at: Date.now() } : { kind: 'clean' })
  const [, tick] = useState(0)
  const nameRef = useRef<HTMLInputElement>(null)
  const weaponRef = useRef<HTMLInputElement>(null)
  const focusingError = useRef(false)
  const dirty = useRef(resumed)
  const mine = useMyWeapons()
  const editing = !!initial.id && list.some((l) => l.id === initial.id)
  const original = editing ? list.find((l) => l.id === initial.id) : undefined
  const armory = armoryWeaponByName(form.weapon)

  const update = useCallback((fn: (f: Form) => Form): void => {
    dirty.current = true
    setStatus({ kind: 'pending' })
    setForm(fn)
  }, [])
  const set = (patch: Partial<Form>): void => update((f) => ({ ...f, ...patch }))
  const touch = (k: string): void => setTouched((t) => (t.has(k) ? t : new Set(t).add(k)))
  const untouch = (k: string): void => {
    if (!focusingError.current) setTouched((t) => (t.has(k) ? new Set([...t].filter((x) => x !== k)) : t))
  }

  // Brouillon : gardé 600 ms après la dernière modification.
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(() => {
      draftActions
        .set({ ...(editing ? { id: initial.id } : {}), loadout: toLoadout(form) })
        .then(() => setStatus({ kind: 'kept', at: Date.now() }))
        .catch(() => setStatus({ kind: 'error' }))
    }, 600)
    return () => clearTimeout(t)
  }, [form, editing, initial.id])
  // « gardé il y a 2 min » reste juste.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // Erreurs : seulement pour un champ déjà quitté (ou après un essai d'enregistrement).
  const errors: Record<string, string> = {}
  if (!form.name.trim()) errors.name = 'Donne un nom à ce loadout, par exemple « Rush Conquête ».'
  if (!form.weapon.trim()) errors.weapon = 'Écris l’arme principale, par exemple « MK 24 ».'
  for (const s of SLOT_ORDER) if (form.parts[s] && ptsOf(form.parts[s]!.pts) === null) errors[`pts-${s}`] = 'Points de 0 à 100.'
  const shown = (k: string): string | undefined => (touched.has(k) ? errors[k] : undefined)

  const loadout = toLoadout(form)
  const pts = loadoutPoints(loadout)
  const cardData: CardData = { ...loadout, cls: form.cls, updatedAt: original?.updatedAt }
  const image = form.weapon.trim() ? weaponImage(form.weapon, hints) : undefined

  /* ---------- suggestions ---------- */
  const build: Build = {}
  for (const s of SLOT_ORDER) if (form.parts[s]?.name.trim()) build[s] = form.parts[s]!.name.trim()
  const slotOptions = (s: SlotId): { options: ComboOption[]; source: string } => {
    if (armory) {
      const list = s === 'optic-accessory' ? opticAccessories(armory, build) : (armory.attachments[s] ?? [])
      return { options: list.map((a) => ({ value: a.name, sub: a.type, pts: a.pts ?? undefined })), source: `Relevé en jeu · ${armory.name}` }
    }
    const sugg = suggestParts(mine, form.weapon, s)
    const own = mine.some((w) => w.key === myWeaponKey(form.weapon))
    return { options: sugg.map((p) => ({ value: p.name, pts: p.pts })), source: own ? `Mes armes · ${form.weapon.trim()}` : `Builds ${form.weapon.trim()}` }
  }
  const weaponOptions: ComboOption[] = useMemo(() => {
    const seen = new Set<string>()
    const out: ComboOption[] = []
    const add = (name: string, sub: string): void => {
      const k = myWeaponKey(name)
      if (!k || seen.has(k)) return
      seen.add(k)
      out.push({ value: name, sub })
    }
    for (const w of mine) add(w.name, `Mes armes${w.cat ? ` · ${CATEGORY_LABEL[w.cat]}` : ''}`)
    for (const t of BUILD_TEMPLATES) add(t.weapon, `Tes builds · ${t.loadout.cat ? CATEGORY_LABEL[t.loadout.cat] : ''}`)
    for (const w of ARMORY_WEAPONS) add(w.name, CATEGORY_LABEL[w.category])
    for (const w of BF6_WEAPONS) add(w.name, CATEGORY_LABEL[w.cat])
    for (const h of hints) add(h.name, 'Vue dans tes stats')
    return out
  }, [mine, hints])
  const gearOptions = (k: GearKey): ComboOption[] => {
    const used = list.flatMap((l) => (k === 'gadget1' || k === 'gadget2' ? [l.gadget1, l.gadget2] : [l[k]])).filter((v): v is string => !!v)
    const base = k === 'gadget1' || k === 'gadget2' ? GADGETS : (GEAR.find((g) => g.key === k)?.defaults ?? [])
    const seen = new Set<string>()
    const out: ComboOption[] = []
    for (const [v, sub] of [...used.map((u) => [u, 'Déjà dans tes loadouts'] as const), ...base.map((b) => [b, ''] as const)]) {
      if (seen.has(v.toLowerCase())) continue
      seen.add(v.toLowerCase())
      out.push(sub ? { value: v, sub } : { value: v })
    }
    return out
  }

  /* ---------- modifications ---------- */
  const setWeapon = (name: string): void =>
    update((f) => {
      const a = armoryWeaponByName(name)
      const cat = a?.category ?? knownCategory(mine, name)
      return { ...f, weapon: name, cat: cat ?? f.cat }
    })
  const setPart = (s: SlotId, patch: Partial<{ name: string; pts: string }>): void =>
    update((f) => {
      const cur = f.parts[s] ?? { name: '', pts: '' }
      const next = { ...cur, ...patch }
      const parts = { ...f.parts }
      if (!next.name.trim() && !next.pts.trim()) delete parts[s]
      else parts[s] = next
      // Une optique relevée en jeu qui n'accepte plus l'accessoire d'optique choisi le retire.
      if (s === 'optic' && armory && parts['optic-accessory']) {
        const ok = (pickAtt(armory, 'optic', next.name)?.enables ?? []).includes(parts['optic-accessory'].name)
        if (!ok) delete parts['optic-accessory']
      }
      return { ...f, parts }
    })
  const pickPart = (s: SlotId, o: ComboOption): void => setPart(s, { name: o.value, pts: o.pts === undefined ? (form.parts[s]?.pts ?? '') : String(o.pts) })
  const clearPart = (s: SlotId): void => setPart(s, { name: '', pts: '' })

  const applyTemplate = (t: BuildTemplate): void => {
    const before = form
    update(() => ({ ...toForm({ ...t.loadout, name: t.loadout.name }, list), gear: form.gear, notes: form.notes, context: form.context }))
    notify(`Build « ${t.weapon} · ${t.label} » appliqué`, { id: 'loadout-template', action: { label: 'Annuler', onClick: () => update(() => before) } })
  }

  /* ---------- enregistrer ---------- */
  const submit = async (e?: React.FormEvent): Promise<void> => {
    e?.preventDefault()
    if (saving) return
    if (Object.keys(errors).length) {
      setTouched(new Set(Object.keys(errors)))
      const first = errors.name ? nameRef.current : errors.weapon ? weaponRef.current : document.getElementById(`${uid}-pts-${Object.keys(errors)[0].slice(4)}`)
      focusingError.current = true
      first?.focus()
      focusingError.current = false
      first?.scrollIntoView({ block: 'center' })
      return
    }
    setSaving(true)
    try {
      const next = await loadoutActions.save({ ...(editing ? { id: initial.id } : {}), ...loadout })
      const saved = (editing ? next.find((l) => l.id === initial.id) : next[0]) ?? next[0]
      dirty.current = false
      await draftActions.clear().catch(() => undefined)
      const learned = !armory && form.weapon.trim()
      notify(`Loadout « ${saved.name} » enregistré${learned ? ` · ${form.weapon.trim()} retenue dans Mes armes` : ''}`, { kind: 'success', id: 'loadout-draft' })
      onSaved(saved)
    } catch (err) {
      notify(errorMessage(err), { kind: 'error' })
      setSaving(false)
    }
  }
  const submitRef = useRef(submit)
  submitRef.current = submit
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void submitRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const leave = (): void => {
    if (dirty.current) notify('Brouillon gardé : reprends-le depuis Mes loadouts', { id: 'loadout-draft' })
    onCancel()
  }

  const field = (k: string): { invalid?: boolean; describedBy?: string } => (shown(k) ? { invalid: true, describedBy: `${uid}-${k}-err` } : {})
  const statusText =
    status.kind === 'pending'
      ? 'Modification…'
      : status.kind === 'kept'
        ? `Brouillon gardé ${timeAgo(status.at)}`
        : status.kind === 'error'
          ? 'Brouillon non gardé'
          : editing
            ? 'Aucune modification'
            : 'Rien de saisi'
  const on = Math.min(10, Math.round(pts.total / 10))
  const groups = [...new Set(BUILD_TEMPLATES.map((t) => t.weapon))]

  return (
    <form className="la" onSubmit={(e) => void submit(e)} noValidate>
      <header className="la-head">
        <button type="button" className="btn btn-ghost btn-sm la-back" onClick={leave}>
          <Icon name="chevron-left" size={16} />
          Mes loadouts
        </button>
        <div className="la-head-title">
          <h2>{editing ? `Modifier « ${original?.name ?? initial.name} »` : 'Nouveau loadout'}</h2>
          <span className={`la-status is-${status.kind}`} role="status">
            <i aria-hidden="true" />
            {statusText}
          </span>
        </div>
        <div className="la-head-actions">
          <button type="button" className="btn btn-ghost" onClick={leave}>
            {dirty.current ? 'Fermer' : 'Annuler'}
          </button>
          <button type="submit" className="btn btn-primary" aria-busy={saving || undefined} title="Ctrl + S">
            <Icon name="check" size={16} />
            {editing ? 'Enregistrer' : 'Enregistrer le loadout'}
          </button>
        </div>
      </header>

      <div className="la-body">
        <div className="la-form">
          {!editing && (
            <section className="la-grp" aria-labelledby={`${uid}-tpl`}>
              <h3 id={`${uid}-tpl`} className="la-grp-h">
                Partir d’un de tes builds
              </h3>
              <div className="la-tpls">
                {groups.map((g) => (
                  <div key={g} className="la-tpl-row">
                    <span className="la-tpl-w">{g}</span>
                    <div className="la-tpl-chips">
                      {BUILD_TEMPLATES.filter((t) => t.weapon === g).map((t) => (
                        <button key={t.id} type="button" className="la-chip" onClick={() => applyTemplate(t)}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="la-grp" aria-labelledby={`${uid}-cls`}>
            <h3 id={`${uid}-cls`} className="la-grp-h">
              Classe
            </h3>
            <div className="la-classes" role="radiogroup" aria-labelledby={`${uid}-cls`}>
              {BF6_CLASSES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={form.cls === c}
                  tabIndex={form.cls === c ? 0 : -1}
                  className={`la-class is-${c}`}
                  onClick={() => set({ cls: c })}
                  onKeyDown={(e) => {
                    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
                    if (!d) return
                    e.preventDefault()
                    const next = BF6_CLASSES[(BF6_CLASSES.indexOf(form.cls) + d + 4) % 4]
                    set({ cls: next })
                    ;(e.currentTarget.parentElement?.querySelector(`.is-${next}`) as HTMLElement | null)?.focus()
                  }}
                >
                  <ClassIcon name={c} size={18} />
                  {CLASS_LABEL[c]}
                </button>
              ))}
            </div>
          </section>

          <section className="la-grp" aria-labelledby={`${uid}-s1`}>
            <h3 id={`${uid}-s1`} className="la-grp-h">
              Loadout
            </h3>
            <div className="la-list">
              <div className={`la-row ${shown('name') ? 'is-invalid' : ''}`}>
                <label htmlFor={`${uid}-name`}>Nom</label>
                <input
                  ref={nameRef}
                  id={`${uid}-name`}
                  value={form.name}
                  maxLength={NAME_MAX}
                  autoComplete="off"
                  placeholder="Rush Conquête"
                  onChange={(e) => set({ name: e.target.value })}
                  onBlur={() => touch('name')}
                  onFocus={() => untouch('name')}
                  aria-invalid={shown('name') ? true : undefined}
                  aria-describedby={shown('name') ? `${uid}-name-err` : undefined}
                />
              </div>
              <div className="la-row">
                <label htmlFor={`${uid}-context`}>Mode ou carte</label>
                <input
                  id={`${uid}-context`}
                  value={form.context}
                  maxLength={TEXT_MAX}
                  autoComplete="off"
                  placeholder="Facultatif"
                  onChange={(e) => set({ context: e.target.value })}
                />
              </div>
              <div className={`la-row ${shown('weapon') ? 'is-invalid' : ''}`}>
                <label htmlFor={`${uid}-weapon`}>Arme</label>
                <Combo
                  id={`${uid}-weapon`}
                  inputRef={weaponRef}
                  value={form.weapon}
                  maxLength={TEXT_MAX}
                  placeholder="MK 24, Z84M…"
                  title="Arme principale"
                  options={weaponOptions}
                  onChange={(v) => setWeapon(v)}
                  onPick={(o) => setWeapon(o.value)}
                  onBlur={() => touch('weapon')}
                  onFocus={() => untouch('weapon')}
                  {...field('weapon')}
                />
              </div>
              <div className="la-row">
                <label htmlFor={`${uid}-cat`}>Catégorie</label>
                <select id={`${uid}-cat`} value={form.cat} onChange={(e) => set({ cat: e.target.value as WeaponCategory | '' })}>
                  <option value="">Non précisée</option>
                  {WEAPON_CATEGORIES.filter((c) => c !== 'pistol').map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="la-row">
                <span className="la-k" id={`${uid}-tier`}>
                  Classement
                </span>
                <div className="la-tiers" role="radiogroup" aria-labelledby={`${uid}-tier`}>
                  {[...TIERS, ''].map((tr) => (
                    <button
                      key={tr || 'none'}
                      type="button"
                      role="radio"
                      aria-checked={form.tier === tr}
                      className={`la-tier ${tr ? `is-${tr}` : 'is-none'}`}
                      title={tr ? `${tr} tier` : 'Sans classement'}
                      onClick={() => set({ tier: tr as Bf6Tier | '' })}
                    >
                      {tr || '—'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {(shown('name') || shown('weapon')) && (
              <div className="la-errs">
                {shown('name') && (
                  <p id={`${uid}-name-err`} className="lo-err" role="alert">
                    {shown('name')}
                  </p>
                )}
                {shown('weapon') && (
                  <p id={`${uid}-weapon-err`} className="lo-err" role="alert">
                    {shown('weapon')}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="la-grp" aria-labelledby={`${uid}-s2`}>
            <div className="la-grp-h">
              <h3 id={`${uid}-s2`}>Accessoires</h3>
              <span className={`la-meter ${pts.total > 100 ? 'is-over' : ''}`} role="img" aria-label={`${pts.total} points sur 100`}>
                <span className="bar" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => (
                    <i key={i} className={i < on ? 'on' : ''} />
                  ))}
                </span>
                <b className="num">{pts.total}</b>
                <small>/ 100</small>
              </span>
            </div>
            <div className="la-list">
              {SLOT_ORDER.map((s) => {
                const p = form.parts[s] ?? { name: '', pts: '' }
                const filled = !!p.name.trim()
                const { options, source } = slotOptions(s)
                const err = shown(`pts-${s}`)
                return (
                  <div key={s} className={`la-row la-slot ${filled ? 'on' : ''} ${err ? 'is-invalid' : ''}`}>
                    <label htmlFor={`${uid}-part-${s}`} title={SLOT_LABEL[s]}>
                      {SLOT_SHORT[s]}
                    </label>
                    <Combo
                      id={`${uid}-part-${s}`}
                      className="nm"
                      value={p.name}
                      maxLength={TEXT_MAX}
                      placeholder="Vide"
                      title={SLOT_LABEL[s]}
                      source={options.length ? source : undefined}
                      options={options}
                      onChange={(v) => {
                        const hit = options.find((o) => o.value.toLowerCase() === v.trim().toLowerCase())
                        setPart(s, hit && hit.pts !== undefined ? { name: v, pts: String(hit.pts) } : { name: v })
                      }}
                      onPick={(o) => pickPart(s, o)}
                      onClear={() => clearPart(s)}
                    />
                    <input
                      id={`${uid}-pts-${s}`}
                      className="pts num"
                      inputMode="numeric"
                      placeholder="—"
                      value={p.pts}
                      maxLength={3}
                      autoComplete="off"
                      aria-label={`Points : ${SLOT_LABEL[s]}`}
                      onChange={(e) => setPart(s, { pts: e.target.value.replace(/[^\d]/g, '') })}
                      onBlur={() => touch(`pts-${s}`)}
                      onFocus={() => untouch(`pts-${s}`)}
                      aria-invalid={err ? true : undefined}
                    />
                    <button
                      type="button"
                      className="la-clr"
                      tabIndex={filled ? 0 : -1}
                      aria-hidden={!filled || undefined}
                      aria-label={`Vider : ${SLOT_LABEL[s]}`}
                      onClick={() => clearPart(s)}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
            <p className={`la-note ${pts.total > 100 ? 'is-warn' : ''}`}>
              {pts.total > 100
                ? `${pts.total - 100} points de trop : le jeu refusera ce loadout.`
                : pts.missing
                  ? `${pts.missing} accessoire${pts.missing > 1 ? 's' : ''} sans points : le total n’en tient pas compte.`
                  : armory
                    ? `${armory.name} : ses accessoires et leurs points sont relevés en jeu.`
                    : form.weapon.trim()
                      ? `Enregistre ce loadout : ${form.weapon.trim()} et ses accessoires seront proposés la prochaine fois.`
                      : 'Choisis l’arme : ses accessoires connus seront proposés avec leurs points.'}
            </p>
          </section>

          <section className="la-grp" aria-labelledby={`${uid}-s3`}>
            <h3 id={`${uid}-s3`} className="la-grp-h">
              Équipement
            </h3>
            <div className="la-list">
              {GEAR.map((g) => (
                <div key={g.key} className="la-row">
                  <label htmlFor={`${uid}-${g.key}`}>{g.label}</label>
                  <Combo
                    id={`${uid}-${g.key}`}
                    value={form.gear[g.key]}
                    maxLength={TEXT_MAX}
                    placeholder={g.empty}
                    title={g.label}
                    options={gearOptions(g.key)}
                    onChange={(v) => update((f) => ({ ...f, gear: { ...f.gear, [g.key]: v } }))}
                    onPick={(o) => update((f) => ({ ...f, gear: { ...f.gear, [g.key]: o.value } }))}
                  />
                </div>
              ))}
              <div className="la-row la-tall">
                <label htmlFor={`${uid}-notes`}>Notes</label>
                <textarea
                  id={`${uid}-notes`}
                  value={form.notes}
                  maxLength={NOTES_MAX}
                  rows={3}
                  placeholder="Rester sur les toits côté B…"
                  onChange={(e) => set({ notes: e.target.value })}
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="la-preview" aria-label="Aperçu de la carte">
          <div className="la-preview-bar">
            <span className="la-live">
              <i aria-hidden="true" />
              En direct
            </span>
          </div>
          <div className="la-preview-card">
            <LoadoutCardView d={cardData} image={image} />
          </div>
          <p className="caption la-preview-hint">C’est cette carte, seule, que « Copier l’image » colle sur Discord.</p>
        </aside>
      </div>
    </form>
  )
}
