// Paramètres › Bibliothèque : les collections (renommer, supprimer) et les jeux masqués (réafficher).
import { useState } from 'react'
import { cleanName, plural } from '@shared/text'
import type { Game } from '@shared/types'
import { SettingsCard } from '../components/settings/parts'
import { errorMessage, useToast } from '../components/ui/Toasts'
import { KIND_LABEL } from '../components/ui/StoreTag'
import { shelfActions, useShelves } from './store'
import './shelves.css'

/** `games` : la bibliothèque et les jeux du compte Steam pas installés (pour retrouver le nom des jeux masqués). */
export function ShelvesCard({ games }: { games: Game[] }): React.JSX.Element {
  const notify = useToast()
  const { collections, hidden } = useShelves()
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const byId = new Map(games.map((g) => [g.id, g]))
  const fail = (e: unknown): void => notify(errorMessage(e), { kind: 'error' })

  const rename = (): void => {
    if (!editing) return
    const { id, name } = editing
    shelfActions
      .rename(id, name)
      .then(() => setEditing(null))
      .catch(fail)
  }
  const remove = (id: string, name: string): void => {
    shelfActions
      .remove(id)
      .then(() => {
        setDeleting(null)
        notify(`Collection « ${name} » supprimée`, { kind: 'success', id: 'shelf' })
      })
      .catch(fail)
  }

  return (
    <SettingsCard title="Collections et jeux masqués" meta={`${plural(collections.length, 'collection', 'collections')} · ${plural(hidden.length, 'jeu masqué', 'jeux masqués')}`}>
      {collections.length === 0 && hidden.length === 0 && (
        <p className="set-help">Range tes jeux depuis leur fiche, avec le bouton « Ranger » : collections, ou masquer un jeu de l'Accueil et de la Bibliothèque.</p>
      )}
      {collections.length > 0 && (
        <ul className="shelf-list" aria-label="Tes collections">
          {collections.map((c) => (
            <li key={c.id} className="shelf-row">
              {editing?.id === c.id ? (
                <form
                  className="shelf-edit"
                  onSubmit={(e) => {
                    e.preventDefault()
                    rename()
                  }}
                >
                  <label className="sr-only" htmlFor={`shelf-name-${c.id}`}>
                    Nouveau nom de « {c.name} »
                  </label>
                  <input
                    id={`shelf-name-${c.id}`}
                    className="shelf-new-input"
                    autoFocus
                    maxLength={40}
                    value={editing.name}
                    onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!editing.name.trim()}>
                    Renommer
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                    Annuler
                  </button>
                </form>
              ) : deleting === c.id ? (
                <div className="shelf-confirm" role="group" aria-label={`Supprimer « ${c.name} »`}>
                  <span className="shelf-confirm-text">Supprimer « {c.name} » ? Ses jeux restent dans ta bibliothèque.</span>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(c.id, c.name)}>
                    Supprimer la collection
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleting(null)}>
                    Annuler
                  </button>
                </div>
              ) : (
                <>
                  <span className="shelf-name">{c.name}</span>
                  <span className="shelf-count num">{plural(c.games.length, 'jeu', 'jeux')}</span>
                  <span className="shelf-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: c.id, name: c.name })}>
                      Renommer
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleting(c.id)}>
                      Supprimer
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {hidden.length > 0 && (
        <p className="shelf-sub" id="shelf-hidden-h">
          Masqués de l'Accueil et de la Bibliothèque
        </p>
      )}
      {hidden.length > 0 && (
        <ul className="set-hidden-list" aria-labelledby="shelf-hidden-h">
          {hidden.map((id) => {
            const g = byId.get(id)
            const name = g ? cleanName(g.name) : id
            return (
              <li key={id} className="set-hidden-chip">
                <span className="set-hidden-text">
                  <span className="set-hidden-name">{name}</span>
                  <span className="set-hidden-why">{g ? KIND_LABEL[g.store] : 'Plus dans ta bibliothèque'}</span>
                </span>
                <button
                  className="set-hidden-btn"
                  aria-label={`Réafficher ${name}`}
                  onClick={() =>
                    void shelfActions
                      .hide(id, false)
                      .then(() => notify(`${name} s'affiche de nouveau`, { kind: 'success', id: 'shelf-hide' }))
                      .catch(fail)
                  }
                >
                  Réafficher
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </SettingsCard>
  )
}
