// Fiche de Battlefield 6 › Loadouts : tes loadouts avant de lancer, en cartes compactes. Les modifier (et en créer)
// se fait dans Stats › Battlefield 6 › Loadouts.
import { useEffect, useState } from 'react'
import { BF6_CLASSES, CLASS_LABEL } from '@shared/armory/labels'
import { Icon } from '../../ui/Icon'
import { presetBf6Tab } from '../bf6'
import { LoadoutCard, type WeaponHint } from './LoadoutCard'
import { setLoadoutDraft, useLoadouts } from './store'
import './loadouts.css'

/** Images des armes vues dans les stats du profil relié (lues dans le cache des stats, comme le résumé de la fiche). */
export function useWeaponHints(): WeaponHint[] {
  const [hints, setHints] = useState<WeaponHint[]>([])
  useEffect(() => {
    let live = true
    window.launcher
      .bf6GetTracked()
      .then(async ({ me }) => {
        if (!me) return
        const { stats } = await window.launcher.bf6Stats(me)
        if (live) setHints(stats.weapons.filter((w) => w.image).map((w) => ({ name: w.name, image: w.image })))
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  return hints
}

export function SheetLoadouts({ onOpenStats }: { onOpenStats: () => void }): React.JSX.Element {
  const list = useLoadouts()
  const hints = useWeaponHints()
  const manage = (): void => {
    presetBf6Tab('loadouts')
    onOpenStats()
  }
  const create = (): void => {
    setLoadoutDraft({})
    manage()
  }
  if (!list) return <div className="skel sheet-lo-skel" />
  if (!list.length) {
    return (
      <section className="sheet-card lo-sheet-empty" aria-labelledby="lo-sheet-h">
        <h3 id="lo-sheet-h" className="sheet-h">
          Tes loadouts
        </h3>
        <p className="bf-text">Note les loadouts que tu joues (arme, accessoires et leurs points, gadgets) pour les retrouver ici avant de lancer.</p>
        <div className="lo-empty-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={create}>
            <Icon name="plus" size={15} />
            Créer un loadout
          </button>
        </div>
      </section>
    )
  }
  const ordered = [...list].sort((a, b) => BF6_CLASSES.indexOf(a.cls) - BF6_CLASSES.indexOf(b.cls) || b.updatedAt - a.updatedAt)
  return (
    <div className="lo-sheet">
      <div className="lo-sheet-head">
        <p className="caption">
          {list.length} loadout{list.length > 1 ? 's' : ''} ·{' '}
          {BF6_CLASSES.filter((c) => list.some((l) => l.cls === c))
            .map((c) => CLASS_LABEL[c])
            .join(', ')}
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={manage}>
          <Icon name="pencil" size={15} />
          Gérer mes loadouts
        </button>
      </div>
      <div className="lo-grid is-sheet">
        {ordered.map((l) => (
          <LoadoutCard key={l.id} l={l} hints={hints} compact />
        ))}
      </div>
    </div>
  )
}
