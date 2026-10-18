// Écran de démarrage : analyse du PC puis choix des jeux favoris en grand. (Ébauche, remplacée par l'implémentation.)
import type { SetupProps } from '../../contracts'

export function Setup({ games, onDone, onSkip }: SetupProps): React.JSX.Element {
  return (
    <div className="setup">
      <p>{games.length} jeux</p>
      <button className="btn btn-primary" onClick={() => onDone(games.filter((g) => g.favorite).map((g) => g.id))}>
        C’est parti
      </button>
      <button className="btn btn-ghost" onClick={onSkip}>
        Passer
      </button>
    </div>
  )
}
