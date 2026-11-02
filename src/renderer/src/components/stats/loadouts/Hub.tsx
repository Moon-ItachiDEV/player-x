// Stats › Battlefield 6 › Loadouts : tes loadouts. L'Armurerie a été retirée le 02/11 à la demande de Breezydev
// (« plus besoin, garde juste Mes loadouts ») ; ses relevés d'accessoires restent proposés dans l'atelier.
import type { WeaponHint } from './LoadoutCard'
import { Loadouts } from './Loadouts'

export function LoadoutsHub({ hints }: { hints: WeaponHint[] }): React.JSX.Element {
  return <Loadouts hints={hints} />
}
