// Stats › Battlefield 6 › Loadouts : le carnet de loadouts du joueur, par classe. Le jeu ne laisse pas lire les
// loadouts : on note les siens ici (gardés sur ce PC), on les retrouve dans la fiche du jeu avant de lancer, et on les
// copie en image ou en texte pour les membres du serveur Discord.
import { useEffect, useState } from 'react'
import { BF6_CLASSES, CLASS_LABEL, type Bf6ClassId } from '@shared/armory/labels'
import { MAX_LOADOUTS, type Bf6Loadout } from '@shared/bf6Loadouts'
import { ClassIcon } from '../ClassIcon'
import { Icon } from '../../ui/Icon'
import { Dialog } from '../../ui/Overlay'
import { errorMessage, useToast } from '../../ui/Toasts'
import { LoadoutCard, type WeaponHint } from './LoadoutCard'
import { LoadoutEditor } from './LoadoutEditor'
import { loadoutActions, takeLoadoutDraft, useLoadouts, type LoadoutDraft } from './store'
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
  const [editing, setEditing] = useState<LoadoutDraft | null>(() => takeLoadoutDraft())
  const [filter, setFilter] = useState<Filter>('all')
  const [deleting, setDeleting] = useState<Bf6Loadout | null>(null)

  useEffect(() => {
    document.querySelector('.content')?.scrollTo({ top: 0 })
  }, [editing])

  if (!list) return <div className="skel bf-skel" />

  if (editing) {
    return (
      <LoadoutEditor
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
    setEditing(filter === 'all' ? {} : { cls: filter })
  }

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
            <button type="button" className="btn btn-secondary" onClick={onOpenArmory}>
              Partir d’une config de l’Armurerie
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="lo-filters" role="group" aria-label="Classe">
            {(['all', ...BF6_CLASSES] as Filter[]).map((c) => (
              <button key={c} type="button" className={`chip ${filter === c ? 'active' : ''}`} aria-pressed={filter === c} onClick={() => setFilter(c)}>
                {c === 'all' ? 'Toutes' : CLASS_LABEL[c]}
                <span className="chip-count">{count(c)}</span>
              </button>
            ))}
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
            <div className="lo-grid">
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
