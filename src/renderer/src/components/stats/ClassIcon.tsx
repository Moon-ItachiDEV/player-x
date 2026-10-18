import { norm } from '@shared/text'

// Emblèmes de classe dessinés pour Player X (aucun visuel officiel) : même trait que components/ui/Icon.
const PATHS: Record<string, string> = {
  // Assaut : doubles chevrons, on avance.
  assault: 'M5 6l6 6-6 6M12 6l6 6-6 6',
  // Ingénieur : clé plate.
  engineer: 'M14.7 6.3a4 4 0 0 0-5.4 5.1L4 16.7 7.3 20l5.3-5.3a4 4 0 0 0 5.1-5.4l-2.5 2.5-2.5-.5-.5-2.5z',
  // Soutien : caisse de ravitaillement.
  support: 'M4 8l8-4 8 4v8l-8 4-8-4zM12 9v6M9 12h6',
  // Éclaireur : réticule de lunette.
  recon: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 2v5M12 17v5M2 12h5M17 12h5M12 12h.01',
  // Inconnue : écusson.
  other: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z'
}

/** Classe reconnue à partir de son nom (français ou anglais, tel que renvoyé par l'API). */
export function classKind(name: string): keyof typeof PATHS {
  const n = norm(name)
  if (n.includes('assau')) return 'assault'
  if (n.includes('ingen') || n.includes('engin')) return 'engineer'
  if (n.includes('soutien') || n.includes('support')) return 'support'
  if (n.includes('eclair') || n.includes('recon')) return 'recon'
  return 'other'
}

export function ClassIcon({ name, size = 20 }: { name: string; size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[classKind(name)]} />
    </svg>
  )
}
