// Stats › Battlefield 6 › Loadouts : tes loadouts (carnet) et l'Armurerie (meilleures configs), au choix en haut.
import { useState } from 'react'
import { Segmented } from '../../ui/Overlay'
import { Armory } from '../armory/Armory'
import type { WeaponHint } from './LoadoutCard'
import { Loadouts } from './Loadouts'

export type LoadoutsView = 'mine' | 'armory'
export const VIEW_KEY = 'pg.stats.loadouts.view'

function loadView(): LoadoutsView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'armory' ? 'armory' : 'mine'
  } catch {
    return 'mine'
  }
}

export function LoadoutsHub({ hints }: { hints: WeaponHint[] }): React.JSX.Element {
  const [view, setViewState] = useState<LoadoutsView>(loadView)
  const setView = (v: LoadoutsView): void => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
    document.querySelector('.content')?.scrollTo({ top: 0 })
  }
  const switcher = (
    <Segmented<LoadoutsView>
      label="Loadouts"
      value={view}
      onChange={setView}
      className="lo-switch"
      options={[
        { value: 'mine', label: 'Mes loadouts' },
        { value: 'armory', label: 'Armurerie' }
      ]}
    />
  )
  return view === 'mine' ? (
    <Loadouts hints={hints} switcher={switcher} onOpenArmory={() => setView('armory')} />
  ) : (
    <Armory switcher={switcher} onOpenLoadouts={() => setView('mine')} />
  )
}
