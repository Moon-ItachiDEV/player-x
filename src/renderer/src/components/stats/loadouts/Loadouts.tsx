// Stats › Battlefield 6 › Loadouts : le carnet de loadouts du joueur, par classe. Le jeu ne laisse pas lire les
// loadouts : on note les siens ici (gardés sur ce PC), on les retrouve dans la fiche du jeu avant de lancer, et on les
// copie en image ou en texte pour les membres du serveur Discord.
import { useEffect, useMemo, useState } from 'react'
import { BF6_CLASSES, CATEGORY_LABEL } from '@shared/armory/labels'
import type { WeaponCategory } from '@shared/armory/types'
import { MAX_LOADOUTS, TIERS, WEAPON_CATEGORIES, tierRank, type Bf6Loadout, type Bf6Tier } from '@shared/bf6Loadouts'
import { BUILD_TEMPLATES, knownCategory, myWeaponKey, type MyWeapon } from '@shared/bf6Workshop'
import { timeAgo } from '@shared/text'
import { ClassIcon } from '../ClassIcon'
import { Icon } from '../../ui/Icon'
import { Dialog } from '../../ui/Overlay'
import { errorMessage, useToast } from '../../ui/Toasts'
import { WeaponArt } from './cards'
import { LoadoutCard, weaponImage, type WeaponHint } from './LoadoutCard'
import { LoadoutEditor } from './LoadoutEditor'
import { draftActions, loadoutActions, takeLoadoutDraft, useLoadouts, useMyWeapons, useSavedDraft, type LoadoutDraft } from './store'
import './loadouts.css'

/** Le type d'arme d'un loadout ; « other » : arme inconnue, sans catégorie choisie. */
type Cat = WeaponCategory | 'other'
const CAT_ORDER: Cat[] = [...WEAPON_CATEGORIES, 'other']
const CAT_PLURAL: Record<Cat, string> = {
  'assault-rifle': 'Fusils d’assaut',
  carbine: 'Carabines',
  smg: 'Mitraillettes',
  lmg: 'Mitrailleuses légères',
  dmr: 'Fusils de tireur d’élite',
  sniper: 'Fusils de précision',
  shotgun: 'Fusils à pompe',
  pistol: 'Pistolets',
  other: 'Autres armes'
}

/** Une arme du carnet et ses loadouts, du meilleur classement au moins bon (puis du plus récent). */
interface WeaponGroup {
  key: string
  name: string
  cat: Cat
  list: Bf6Loadout[]
  best?: Bf6Tier
}
const byTier = (a: Bf6Loadout, b: Bf6Loadout): number => tierRank(a.tier) - tierRank(b.tier) || b.updatedAt - a.updatedAt
const plural = (n: number): string => `${n} loadout${n > 1 ? 's' : ''}`

function groupByWeapon(list: Bf6Loadout[], mine: MyWeapon[]): WeaponGroup[] {
  const map = new Map<string, Bf6Loadout[]>()
  for (const l of list) {
    const key = myWeaponKey(l.weapon || '') || '?'
    map.set(key, [...(map.get(key) ?? []), l])
  }
  return [...map.entries()]
    .map(([key, ls]) => {
      const sorted = [...ls].sort(byTier)
      const recent = [...ls].sort((a, b) => b.updatedAt - a.updatedAt)[0]
      const cat: Cat = ls.find((l) => l.cat)?.cat ?? knownCategory(mine, recent.weapon) ?? 'other'
      return { key, name: recent.weapon?.trim() || 'Arme', cat, list: sorted, best: sorted[0].tier }
    })
    .sort((a, b) => tierRank(a.best) - tierRank(b.best) || b.list.length - a.list.length || a.name.localeCompare(b.name, 'fr'))
}

/** La tuile d'une arme : son image, son nom, combien de loadouts et le meilleur classement. */
function WeaponTile({ g, hints, onOpen }: { g: WeaponGroup; hints: WeaponHint[]; onOpen: () => void }): React.JSX.Element {
  const cat = g.cat === 'other' ? undefined : g.cat
  return (
    <button type="button" className="lo-wpn" onClick={onOpen} aria-label={`${g.name} : ${plural(g.list.length)}${g.best ? `, meilleur ${g.best} tier` : ''}`}>
      <span className="lo-wpn-art" aria-hidden="true">
        <WeaponArt image={weaponImage(g.name, hints)} cat={cat} label="" />
      </span>
      {g.best && <span className={`lc-tier is-${g.best} lo-wpn-tier`}>{g.best}</span>}
      <span className="lo-wpn-text">
        <b>{g.name}</b>
        <span>
          {cat ? CATEGORY_LABEL[cat] : 'Autre arme'} · {plural(g.list.length)}
        </span>
      </span>
      <Icon name="chevron-right" size={16} className="lo-wpn-go" />
    </button>
  )
}

interface Props {
  hints: WeaponHint[]
  /** Choix « Mes loadouts / Armurerie », en tête (pas pendant la modification d'un loadout). */
  switcher: React.ReactNode
  onOpenArmory: () => void
}

export function Loadouts({ hints, switcher, onOpenArmory }: Props): React.JSX.Element {
  const notify = useToast()
  const list = useLoadouts()
  // Un brouillon venu de l'Armurerie ouvre l'éditeur tout de suite.
  const [editing, setEditingState] = useState<LoadoutDraft | null>(() => takeLoadoutDraft())
  // Chaque ouverture repart d'un éditeur neuf (un brouillon repris puis « Repartir de zéro », par exemple).
  const [seq, setSeq] = useState(0)
  const setEditing = (d: LoadoutDraft | null): void => {
    if (d) setSeq((s) => s + 1)
    setEditingState(d)
  }
  // Rangé par type d'arme ; une arme ouverte montre ses loadouts du S tier au C tier.
  const [cat, setCat] = useState<'all' | Cat>('all')
  const [weaponKey, setWeaponKey] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Bf6Loadout | null>(null)
  const [adding, setAdding] = useState(false)
  const draft = useSavedDraft()
  const mine = useMyWeapons()
  const groups = useMemo(() => groupByWeapon(list ?? [], mine), [list, mine])

  useEffect(() => {
    document.querySelector('.content')?.scrollTo({ top: 0 })
  }, [editing, weaponKey])

  if (!list) return <div className="skel bf-skel" />

  if (editing) {
    return (
      <LoadoutEditor
        key={seq}
        initial={editing}
        list={list}
        hints={hints}
        onCancel={() => setEditing(null)}
        onSaved={(l) => {
          setEditing(null)
          // On retrouve le loadout enregistré avec les autres de son arme.
          setWeaponKey(myWeaponKey(l.weapon || '') || '?')
        }}
      />
    )
  }

  const group = weaponKey ? groups.find((g) => g.key === weaponKey) : undefined
  const cats = CAT_ORDER.filter((c) => groups.some((g) => g.cat === c))
  const shownCats = cat === 'all' || !cats.includes(cat) ? cats : [cat]
  const full = list.length >= MAX_LOADOUTS
  /** Un loadout neuf ; depuis la page d'une arme, il part de cette arme. */
  const create = (): void => {
    if (full) return notify(`Tu as déjà ${MAX_LOADOUTS} loadouts : supprimes-en un pour en ajouter un autre.`, { kind: 'error' })
    const base: LoadoutDraft = group ? { weapon: group.name, ...(group.cat !== 'other' ? { cat: group.cat } : {}) } : {}
    // Un nouveau loadout commencé et pas enregistré : on le reprend plutôt que de l'écraser.
    if (draft && !draft.id) {
      setEditing({ ...draft.loadout, resumed: true } as LoadoutDraft)
      return notify('Ton brouillon est repris', {
        id: 'loadout-draft',
        action: { label: 'Repartir de zéro', onClick: () => void draftActions.clear().then(() => setEditing(base)) }
      })
    }
    setEditing(base)
  }

  const addTemplates = (): void => {
    if (adding) return
    const room = MAX_LOADOUTS - list.length
    if (room <= 0) return notify(`Tu as déjà ${MAX_LOADOUTS} loadouts : supprimes-en un pour en ajouter d’autres.`, { kind: 'error' })
    setAdding(true)
    const picked = BUILD_TEMPLATES.slice(0, room).map((t) => ({ ...t.loadout, name: t.loadout.name }))
    loadoutActions
      .saveMany(picked)
      .then(() => notify(`${picked.length} builds ajoutés : ${[...new Set(picked.map((l) => l.weapon))].join(', ')}`, { kind: 'success', id: 'loadout-saved' }))
      .catch((e) => notify(errorMessage(e), { kind: 'error' }))
      .finally(() => setAdding(false))
  }
  const resume = (): void => {
    if (!draft) return
    setEditing({ ...draft.loadout, id: draft.id, resumed: true } as LoadoutDraft)
  }
  const dropDraft = (): void => {
    void draftActions.clear().then(() => notify('Brouillon jeté', { id: 'loadout-draft' }))
  }
  const draftLabel = draft ? [draft.loadout.weapon, draft.loadout.name].filter(Boolean).join(' · ') || 'Loadout sans nom' : ''

  const remove = (l: Bf6Loadout): void => {
    setDeleting(null)
    loadoutActions
      .remove(l.id)
      .then(() => notify(`Loadout « ${l.name} » supprimé`, { kind: 'success', id: 'loadout-saved' }))
      .catch((e) => notify(errorMessage(e), { kind: 'error' }))
  }

  return (
    <div className="lo">
      <header className="lo-head">
        <div className="lo-head-text">
          {switcher}
          <h2 className="sr-only">Mes loadouts</h2>
          <p className="caption">Gardés sur ce PC. Le jeu ne laisse pas lire tes loadouts : note ici ceux que tu joues.</p>
        </div>
        {list.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={create}>
            <Icon name="plus" size={16} />
            {group ? `Nouveau loadout ${group.name}` : 'Nouveau loadout'}
          </button>
        )}
      </header>

      {draft && (
        <section className="lo-resume" aria-label="Brouillon en cours">
          <div className="lo-resume-text">
            <b>Brouillon en cours : {draftLabel}</b>
            <span>
              {draft.id ? 'Modification non enregistrée' : 'Nouveau loadout non enregistré'}, gardé {timeAgo(draft.savedAt)}.
            </span>
          </div>
          <div className="lo-resume-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={resume}>
              Reprendre
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={dropDraft}>
              Jeter
            </button>
          </div>
        </section>
      )}

      {list.length === 0 ? (
        <section className="bf-card lo-empty" aria-labelledby="lo-empty-title">
          <div className="lo-empty-icons" aria-hidden="true">
            {BF6_CLASSES.map((c) => (
              <span key={c} className={`lo-empty-icon is-${c}`}>
                <ClassIcon name={c} size={22} />
              </span>
            ))}
          </div>
          <h3 id="lo-empty-title" className="lo-empty-title">
            Ton premier loadout
          </h3>
          <p className="bf-text">
            Classe, arme et accessoires avec leurs points, gadgets, grenade : retrouve-les dans la fiche de Battlefield 6 avant de lancer, et partage-les en image.
          </p>
          <div className="lo-empty-actions">
            <button type="button" className="btn btn-primary" onClick={create}>
              <Icon name="plus" size={16} />
              Créer un loadout
            </button>
            <button type="button" className="btn btn-secondary" onClick={addTemplates} aria-busy={adding || undefined}>
              <Icon name="download" size={16} />
              Ajouter mes {BUILD_TEMPLATES.length} builds
            </button>
            <button type="button" className="btn btn-ghost" onClick={onOpenArmory}>
              Partir d’une config de l’Armurerie
            </button>
          </div>
        </section>
      ) : (
        <>
          {group ? (
            <section className="lo-wv" aria-labelledby="lo-wv-title">
              <div className="lo-wv-head">
                <button type="button" className="btn btn-ghost btn-sm lo-wv-back" onClick={() => setWeaponKey(null)}>
                  <Icon name="chevron-left" size={16} />
                  Toutes les armes
                </button>
                <div className="lo-wv-title">
                  <h3 id="lo-wv-title">{group.name}</h3>
                  <span className="caption">
                    {group.cat === 'other' ? 'Autre arme' : CATEGORY_LABEL[group.cat]} · {plural(group.list.length)}, du meilleur au moins bon
                  </span>
                </div>
              </div>
              {[...TIERS, undefined].map((t) => {
                const ls = group.list.filter((l) => l.tier === t)
                if (!ls.length) return null
                return (
                  <section key={t ?? 'none'} className="lo-tier-sec" aria-label={t ? `${t} tier` : 'Sans classement'}>
                    <h4 className="lo-sec">
                      {t ? <span className={`lc-tier is-${t}`}>{t}</span> : null}
                      {t ? 'tier' : 'Sans classement'}
                      <span className="lo-sec-n num">{ls.length}</span>
                    </h4>
                    <div className="lo-grid is-cards">
                      {ls.map((l) => (
                        <LoadoutCard
                          key={l.id}
                          l={l}
                          hints={hints}
                          onEdit={() => setEditing(l)}
                          onDuplicate={() => {
                            if (full) return notify(`Tu as déjà ${MAX_LOADOUTS} loadouts : supprimes-en un pour en ajouter un autre.`, { kind: 'error' })
                            setEditing({ ...l, id: undefined, name: `${l.name} (copie)`.slice(0, 40) })
                          }}
                          onDelete={() => setDeleting(l)}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </section>
          ) : (
            <>
              {cats.length > 1 && (
                <div className="lo-filters" role="group" aria-label="Type d’arme">
                  {(['all', ...cats] as ('all' | Cat)[]).map((c) => (
                    <button key={c} type="button" className={`chip ${cat === c ? 'active' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
                      {c === 'all' ? 'Toutes' : CAT_PLURAL[c]}
                      <span className="chip-count">{c === 'all' ? groups.length : groups.filter((g) => g.cat === c).length}</span>
                    </button>
                  ))}
                </div>
              )}
              {shownCats.map((c) => {
                const gs = groups.filter((g) => g.cat === c)
                return (
                  <section key={c} className="lo-cat" aria-labelledby={`lo-cat-${c}`}>
                    <h3 id={`lo-cat-${c}`} className="lo-sec">
                      {CAT_PLURAL[c]}
                      <span className="lo-sec-n num">{gs.length}</span>
                    </h3>
                    <div className="lo-wpns">
                      {gs.map((g) => (
                        <WeaponTile key={g.key} g={g} hints={hints} onOpen={() => setWeaponKey(g.key)} />
                      ))}
                    </div>
                  </section>
                )
              })}
            </>
          )}
        </>
      )}

      <Dialog
        open={!!deleting}
        title={deleting ? `Supprimer le loadout « ${deleting.name} » ?` : ''}
        onClose={() => setDeleting(null)}
        actions={
          <>
            <button type="button" className="btn btn-ghost" autoFocus onClick={() => setDeleting(null)}>
              Annuler
            </button>
            <button type="button" className="btn btn-danger" onClick={() => deleting && remove(deleting)}>
              Supprimer le loadout
            </button>
          </>
        }
      >
        <p className="bf-text">Il disparaît de ce PC. Tes loadouts dans le jeu ne changent pas.</p>
      </Dialog>
    </div>
  )
}
