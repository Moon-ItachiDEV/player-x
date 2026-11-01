// Stats › Battlefield 6 › Loadouts : le carnet de loadouts du joueur, par classe. Le jeu ne laisse pas lire les
// loadouts : on note les siens ici (gardés sur ce PC), on les retrouve dans la fiche du jeu avant de lancer, et on les
// copie en image ou en texte pour les membres du serveur Discord.
import { useEffect, useState } from 'react'
import { BF6_CLASSES, CLASS_LABEL, type Bf6ClassId } from '@shared/armory/labels'
import { MAX_LOADOUTS, type Bf6Loadout } from '@shared/bf6Loadouts'
import { BUILD_TEMPLATES } from '@shared/bf6Workshop'
import { timeAgo } from '@shared/text'
import { ClassIcon } from '../ClassIcon'
import { Icon } from '../../ui/Icon'
import { Dialog, Segmented } from '../../ui/Overlay'
import { errorMessage, useToast } from '../../ui/Toasts'
import { LoadoutCard, type WeaponHint } from './LoadoutCard'
import { LoadoutEditor } from './LoadoutEditor'
import { draftActions, loadoutActions, setCardStyle, takeLoadoutDraft, useCardStyle, useLoadouts, useMyWeapons, useSavedDraft, type CardStyle, type LoadoutDraft } from './store'
import './loadouts.css'

type Filter = 'all' | Bf6ClassId

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
  const [filter, setFilter] = useState<Filter>('all')
  const [deleting, setDeleting] = useState<Bf6Loadout | null>(null)
  const [adding, setAdding] = useState(false)
  const style = useCardStyle()
  const draft = useSavedDraft()
  useMyWeapons()

  useEffect(() => {
    document.querySelector('.content')?.scrollTo({ top: 0 })
  }, [editing])

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
          setFilter((f) => (f === 'all' || f === l.cls ? f : 'all'))
        }}
      />
    )
  }

  const count = (c: Filter): number => (c === 'all' ? list.length : list.filter((l) => l.cls === c).length)
  const shown = filter === 'all' ? list : list.filter((l) => l.cls === filter)
  const full = list.length >= MAX_LOADOUTS
  const create = (): void => {
    if (full) return notify(`Tu as déjà ${MAX_LOADOUTS} loadouts : supprimes-en un pour en ajouter un autre.`, { kind: 'error' })
    // Un nouveau loadout commencé et pas enregistré : on le reprend plutôt que de l'écraser.
    if (draft && !draft.id) {
      setEditing({ ...draft.loadout, resumed: true } as LoadoutDraft)
      return notify('Ton brouillon est repris', {
        id: 'loadout-draft',
        action: { label: 'Repartir de zéro', onClick: () => void draftActions.clear().then(() => setEditing(filter === 'all' ? {} : { cls: filter })) }
      })
    }
    setEditing(filter === 'all' ? {} : { cls: filter })
  }

  const addTemplates = (): void => {
    if (adding) return
    const room = MAX_LOADOUTS - list.length
    if (room <= 0) return notify(`Tu as déjà ${MAX_LOADOUTS} loadouts : supprimes-en un pour en ajouter d’autres.`, { kind: 'error' })
    setAdding(true)
    const picked = BUILD_TEMPLATES.slice(0, room).map((t) => ({ ...t.loadout, name: t.loadout.name }))
    loadoutActions
      .saveMany(picked)
      .then(() => notify(`${picked.length} builds ajoutés : CZ3A1, MK 24 et Z84M`, { kind: 'success', id: 'loadout-saved' }))
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
            Nouveau loadout
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
          <div className="lo-tools">
            <div className="lo-filters" role="group" aria-label="Classe">
              {(['all', ...BF6_CLASSES] as Filter[]).map((c) => (
                <button key={c} type="button" className={`chip ${filter === c ? 'active' : ''}`} aria-pressed={filter === c} onClick={() => setFilter(c)}>
                  {c === 'all' ? 'Toutes' : CLASS_LABEL[c]}
                  <span className="chip-count">{count(c)}</span>
                </button>
              ))}
            </div>
            <div className="lo-cardstyle">
              <span className="caption">Carte</span>
              <Segmented<CardStyle>
                label="Style des cartes"
                value={style}
                onChange={setCardStyle}
                options={[
                  { value: 'a', label: 'A · Gunsmith' },
                  { value: 'b', label: 'B · Affiche' }
                ]}
              />
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="lo-none">
              <p className="bf-text">Aucun loadout {filter === 'all' ? '' : `pour la classe ${CLASS_LABEL[filter as Bf6ClassId]}`}.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={create}>
                <Icon name="plus" size={15} />
                Créer un loadout {filter === 'all' ? '' : CLASS_LABEL[filter as Bf6ClassId]}
              </button>
            </div>
          ) : (
            <div className="lo-grid is-cards">
              {shown.map((l) => (
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
