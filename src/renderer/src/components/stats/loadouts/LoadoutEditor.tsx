// Nouveau loadout, ou modification d'un loadout : une sous-page de « Mes loadouts » (plus de trois champs). Nom, classe
// et arme principale sont obligatoires ; une erreur ne s'affiche qu'après avoir quitté le champ (ou à l'enregistrement).
// Une arme de l'Armurerie propose ses accessoires relevés, avec leurs points ; sinon chaque emplacement se note à la main.
import { useId, useMemo, useRef, useState } from 'react'
import { SLOT_ORDER, normalizeBuild, opticAccessories, pickAtt, slotsOf } from '@shared/armory/engine'
import { BF6_CLASSES, CLASS_LABEL, SLOT_LABEL } from '@shared/armory/labels'
import type { Build, SlotId } from '@shared/armory/types'
import { ARMORY_WEAPONS, armoryWeaponByName } from '@shared/armory/weapons'
import { NAME_MAX, NOTES_MAX, TEXT_MAX, loadoutPoints, suggestName, type Bf6ClassId, type Bf6Loadout, type Bf6LoadoutPart } from '@shared/bf6Loadouts'
import { AttachmentMenu } from '../armory/AttachmentMenu'
import { ClassIcon } from '../ClassIcon'
import { Icon } from '../../ui/Icon'
import { errorMessage, useToast } from '../../ui/Toasts'
import { loadoutActions, type LoadoutDraft } from './store'
import type { WeaponHint } from './LoadoutCard'

type GearKey = 'secondary' | 'gadget1' | 'gadget2' | 'grenade' | 'melee' | 'training'
const GEAR: { key: GearKey; label: string; hint: string }[] = [
  { key: 'secondary', label: 'Arme secondaire', hint: 'Pistolet, revolver…' },
  { key: 'gadget1', label: 'Gadget 1', hint: '' },
  { key: 'gadget2', label: 'Gadget 2', hint: '' },
  { key: 'grenade', label: 'Grenade', hint: '' },
  { key: 'melee', label: 'Mêlée', hint: 'Couteau, masse…' },
  { key: 'training', label: 'Voie d’entraînement', hint: '' }
]

interface Form {
  name: string
  cls: Bf6ClassId
  context: string
  weapon: string
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

interface Props {
  initial: LoadoutDraft
  list: Bf6Loadout[]
  hints: WeaponHint[]
  onCancel: () => void
  onSaved: (l: Bf6Loadout) => void
}

export function LoadoutEditor({ initial, list, hints, onCancel, onSaved }: Props): React.JSX.Element {
  const notify = useToast()
  const uid = useId()
  const [form, setForm] = useState<Form>(() => toForm(initial, list))
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  // Focus posé par l'enregistrement sur le premier champ en erreur : son message reste affiché.
  const focusingError = useRef(false)
  const weaponRef = useRef<HTMLInputElement>(null)
  const editing = !!initial.id && list.some((l) => l.id === initial.id)
  const armory = armoryWeaponByName(form.weapon)

  const set = (patch: Partial<Form>): void => setForm((f) => ({ ...f, ...patch }))
  const touch = (k: string): void => setTouched((t) => (t.has(k) ? t : new Set(t).add(k)))
  const untouch = (k: string): void => {
    if (!focusingError.current) setTouched((t) => (t.has(k) ? new Set([...t].filter((x) => x !== k)) : t))
  }

  // Erreurs : seulement pour un champ déjà quitté (ou après un essai d'enregistrement).
  const errors: Record<string, string> = {}
  if (!form.name.trim()) errors.name = 'Donne un nom à ce loadout, par exemple « Rush Conquête ».'
  if (!form.weapon.trim()) errors.weapon = 'Écris l’arme principale, par exemple « M433 ».'
  for (const s of SLOT_ORDER) if (form.parts[s] && ptsOf(form.parts[s]!.pts) === null) errors[`pts-${s}`] = 'Points de 0 à 100.'
  const shown = (k: string): string | undefined => (touched.has(k) ? errors[k] : undefined)

  // Accessoires d'une arme de l'Armurerie : la config relevée, points compris.
  const build: Build = useMemo(() => {
    if (!armory) return {}
    const b: Build = {}
    for (const s of SLOT_ORDER) if (form.parts[s]) b[s] = form.parts[s]!.name
    return normalizeBuild(armory, b)
  }, [armory, form.parts])
  const setArmoryPart = (s: SlotId, name: string | undefined): void => {
    if (!armory) return
    const next: Build = { ...build }
    if (name) next[s] = name
    else delete next[s]
    const clean = normalizeBuild(armory, next)
    const parts: Form['parts'] = {}
    for (const slot of slotsOf(armory)) {
      const a = pickAtt(armory, slot, clean[slot])
      if (a) parts[slot] = { name: a.name, pts: a.pts === null ? '' : String(a.pts) }
    }
    set({ parts })
  }
  const setFreePart = (s: SlotId, patch: Partial<{ name: string; pts: string }>): void => {
    const cur = form.parts[s] ?? { name: '', pts: '' }
    const next = { ...cur, ...patch }
    const parts = { ...form.parts }
    if (!next.name.trim() && !next.pts.trim()) delete parts[s]
    else parts[s] = next
    set({ parts })
  }

  // Le total : ce que montrent les champs (une arme de l'Armurerie suit sa config).
  const partsOut: Partial<Record<SlotId, Bf6LoadoutPart>> = {}
  for (const s of SLOT_ORDER) {
    const p = form.parts[s]
    if (!p?.name.trim()) continue
    const pts = ptsOf(p.pts)
    partsOut[s] = typeof pts === 'number' ? { name: p.name.trim(), pts } : { name: p.name.trim() }
  }
  const pts = loadoutPoints({ parts: partsOut })

  // Suggestions : armes vues dans tes stats et dans l'Armurerie ; équipement déjà noté dans tes loadouts.
  const weaponList = useMemo(() => [...new Set([...ARMORY_WEAPONS.map((w) => w.name), ...hints.map((h) => h.name)])].sort((a, b) => a.localeCompare(b, 'fr')), [hints])
  const seen = (k: GearKey): string[] =>
    [...new Set(list.flatMap((l) => (k === 'gadget1' || k === 'gadget2' ? [l.gadget1, l.gadget2] : [l[k]])).filter((v): v is string => !!v))].sort((a, b) =>
      a.localeCompare(b, 'fr')
    )

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
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
    const payload: LoadoutDraft = {
      ...(editing ? { id: initial.id } : {}),
      name: form.name,
      cls: form.cls,
      context: form.context,
      weapon: form.weapon,
      ...(armory ? { armoryId: armory.id } : {}),
      parts: partsOut,
      ...Object.fromEntries(GEAR.map((g) => [g.key, form.gear[g.key]])),
      notes: form.notes
    }
    try {
      const next = await loadoutActions.save(payload)
      const saved = (editing ? next.find((l) => l.id === initial.id) : next[0]) ?? next[0]
      notify(`Loadout « ${saved.name} » enregistré`, { kind: 'success', id: 'loadout-saved' })
      onSaved(saved)
    } catch (err) {
      notify(errorMessage(err), { kind: 'error' })
      setSaving(false)
    }
  }

  const field = (k: string): { 'aria-invalid'?: true; 'aria-describedby'?: string } => (shown(k) ? { 'aria-invalid': true, 'aria-describedby': `${uid}-${k}-err` } : {})

  return (
    <form className="lo-editor" onSubmit={(e) => void submit(e)} noValidate>
      <div className="lo-editor-head">
        <button type="button" className="btn btn-ghost btn-sm lo-back" onClick={onCancel}>
          <Icon name="chevron-left" size={16} />
          Mes loadouts
        </button>
        <h2 className="lo-editor-title">{editing ? `Modifier « ${initial.name} »` : 'Nouveau loadout'}</h2>
      </div>

      <section className="bf-card lo-section" aria-labelledby={`${uid}-s1`}>
        <h3 id={`${uid}-s1`} className="lo-section-title">
          Le loadout
        </h3>
        <div className="lo-row-2">
          <div className="lo-field">
            <label htmlFor={`${uid}-name`}>Nom</label>
            <input
              ref={nameRef}
              id={`${uid}-name`}
              className="input"
              value={form.name}
              maxLength={NAME_MAX}
              required
              autoComplete="off"
              onChange={(e) => set({ name: e.target.value })}
              onBlur={() => touch('name')}
              onFocus={() => untouch('name')}
              {...field('name')}
            />
            {shown('name') && (
              <p id={`${uid}-name-err`} className="lo-err" role="alert">
                {shown('name')}
              </p>
            )}
          </div>
          <div className="lo-field">
            <label htmlFor={`${uid}-context`}>
              Mode ou carte <span className="lo-optional">facultatif</span>
            </label>
            <input
              id={`${uid}-context`}
              className="input"
              value={form.context}
              maxLength={TEXT_MAX}
              placeholder="Conquête, Percée…"
              autoComplete="off"
              onChange={(e) => set({ context: e.target.value })}
            />
          </div>
        </div>
        <fieldset className="lo-field lo-classes-field">
          <legend>Classe</legend>
          <div className="lo-classes">
            {BF6_CLASSES.map((c) => (
              <label key={c} className={`lo-class-opt is-${c}`}>
                <input type="radio" name={`${uid}-cls`} value={c} checked={form.cls === c} onChange={() => set({ cls: c })} />
                <ClassIcon name={c} size={20} />
                <span>{CLASS_LABEL[c]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="bf-card lo-section" aria-labelledby={`${uid}-s2`}>
        <div className="lo-section-head">
          <h3 id={`${uid}-s2`} className="lo-section-title">
            Arme principale
          </h3>
          {pts.count > 0 && (
            <span className={`lo-total ${pts.total > 100 ? 'is-over' : ''}`}>
              <span className="num">{pts.total}</span> / 100 points
              {pts.missing > 0 && <span className="caption"> · {pts.missing} sans points</span>}
            </span>
          )}
        </div>
        <div className="lo-field lo-weapon-field">
          <label htmlFor={`${uid}-weapon`}>Arme</label>
          <input
            ref={weaponRef}
            id={`${uid}-weapon`}
            className="input"
            list={`${uid}-weapons`}
            value={form.weapon}
            maxLength={TEXT_MAX}
            required
            autoComplete="off"
            placeholder="M433, SG 553R…"
            onChange={(e) => set({ weapon: e.target.value })}
            onBlur={() => touch('weapon')}
            onFocus={() => untouch('weapon')}
            {...field('weapon')}
          />
          <datalist id={`${uid}-weapons`}>
            {weaponList.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {shown('weapon') ? (
            <p id={`${uid}-weapon-err`} className="lo-err" role="alert">
              {shown('weapon')}
            </p>
          ) : (
            <p className="lo-help">
              {armory
                ? `${armory.name} est dans l’Armurerie : choisis ses accessoires dans les listes, les points se remplissent.`
                : 'Pour chaque emplacement, écris l’accessoire tel que le jeu l’affiche, et ses points si tu veux le total.'}
            </p>
          )}
        </div>

        {armory ? (
          <ul className="lo-slots is-armory">
            {slotsOf(armory).map((s) => {
              const options = s === 'optic-accessory' ? opticAccessories(armory, build) : (armory.attachments[s] ?? [])
              return (
                <li key={s}>
                  <AttachmentMenu
                    slot={s}
                    options={options}
                    value={build[s]}
                    allowNone={!['optic', 'barrel', 'magazine', 'ammo'].includes(s)}
                    onPick={(name) => setArmoryPart(s, name)}
                    unavailable={s === 'optic-accessory' && !options.length ? 'Pas avec cette optique' : undefined}
                  />
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="lo-slots">
            {SLOT_ORDER.map((s) => {
              const p = form.parts[s] ?? { name: '', pts: '' }
              const err = shown(`pts-${s}`)
              return (
                <li key={s} className="lo-slot">
                  <label className="lo-slot-label" htmlFor={`${uid}-part-${s}`}>
                    {SLOT_LABEL[s]}
                  </label>
                  <input
                    id={`${uid}-part-${s}`}
                    className="input"
                    value={p.name}
                    maxLength={TEXT_MAX}
                    autoComplete="off"
                    onChange={(e) => setFreePart(s, { name: e.target.value })}
                  />
                  <label className="sr-only" htmlFor={`${uid}-pts-${s}`}>
                    Points : {SLOT_LABEL[s]}
                  </label>
                  <input
                    id={`${uid}-pts-${s}`}
                    className="input lo-pts-input num"
                    inputMode="numeric"
                    placeholder="pts"
                    value={p.pts}
                    maxLength={3}
                    autoComplete="off"
                    onChange={(e) => setFreePart(s, { pts: e.target.value })}
                    onBlur={() => touch(`pts-${s}`)}
                    onFocus={() => untouch(`pts-${s}`)}
                    {...field(`pts-${s}`)}
                  />
                  {err && (
                    <p id={`${uid}-pts-${s}-err`} className="lo-err lo-slot-err" role="alert">
                      {err}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="bf-card lo-section" aria-labelledby={`${uid}-s3`}>
        <h3 id={`${uid}-s3`} className="lo-section-title">
          Équipement <span className="lo-optional">facultatif</span>
        </h3>
        <div className="lo-gear-grid">
          {GEAR.map((g) => {
            const sugg = seen(g.key)
            return (
              <div key={g.key} className="lo-field">
                <label htmlFor={`${uid}-${g.key}`}>{g.label}</label>
                <input
                  id={`${uid}-${g.key}`}
                  className="input"
                  list={sugg.length ? `${uid}-${g.key}-list` : undefined}
                  value={form.gear[g.key]}
                  maxLength={TEXT_MAX}
                  placeholder={g.hint}
                  autoComplete="off"
                  onChange={(e) => set({ gear: { ...form.gear, [g.key]: e.target.value } })}
                />
                {sugg.length > 0 && (
                  <datalist id={`${uid}-${g.key}-list`}>
                    {sugg.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                )}
              </div>
            )
          })}
        </div>
        <div className="lo-field">
          <label htmlFor={`${uid}-notes`}>Notes</label>
          <textarea id={`${uid}-notes`} className="input lo-notes-input" value={form.notes} maxLength={NOTES_MAX} rows={3} onChange={(e) => set({ notes: e.target.value })} />
        </div>
      </section>

      <div className="lo-editor-actions">
        <button type="submit" className="btn btn-primary" aria-busy={saving || undefined}>
          {editing ? 'Enregistrer les modifications' : 'Enregistrer le loadout'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  )
}
