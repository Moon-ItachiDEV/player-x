// Paramètres › À propos : version et mises à jour. (Ébauche, remplacée par l'implémentation.)
import { SectionHead } from './parts'

export function AboutSection(): React.JSX.Element {
  return <SectionHead title="À propos">Player X {window.launcher.version}</SectionHead>
}
