// Icônes au trait (24×24, épaisseur 1.75), dessinées à la main pour éviter une dépendance.

const PATHS = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  star: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  pencil: 'M4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16zM13.5 6.5l4 4',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  clipboard: 'M9 4h6v3H9zM9 5H6v16h12V5h-3',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off': 'M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  check: 'M20 6L9 17l-5-5',
  'check-circle': 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM8 12l3 3 5-6',
  x: 'M18 6L6 18M6 6l12 12',
  'alert-triangle': 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  'alert-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-left': 'M15 18l-6-6 6-6',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  'log-in': 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  'log-out': 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  'panel-right': 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM15 3v18',
  'external-link': 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  gamepad: 'M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-4 3.6l-.7 6A3 3 0 0 0 5 18c1 0 2-.5 2.6-1.4L9 15h6l1.4 1.6A3.3 3.3 0 0 0 19 18a3 3 0 0 0 3-3.4l-.7-6A4 4 0 0 0 17.3 5z',
  sort: 'M3 6h18M6 12h12M10 18h4',
  key: 'M15.5 7.5l3 3M21 2l-9.6 9.6M15.5 7.5L19 4M7.5 21a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  library: 'M4 19V5M9 19V5M14 19l-1-14M19.5 19L16 5.5',
  plus: 'M12 5v14M5 12h14',
  pause: 'M9 5v14M15 5v14',
  chart: 'M3 3v18h18M7 16v-4M12 16V8M17 16v-7',
  shield: 'M12 2.5l8 3v6c0 5.2-3.4 9-8 10.5C7.4 20.5 4 16.7 4 11.5v-6z',
  'shield-check': 'M12 2.5l8 3v6c0 5.2-3.4 9-8 10.5C7.4 20.5 4 16.7 4 11.5v-6zM8.5 12l2.5 2.5 4.5-5',
  'shield-x': 'M12 2.5l8 3v6c0 5.2-3.4 9-8 10.5C7.4 20.5 4 16.7 4 11.5v-6zM9.5 9.5l5 5M14.5 9.5l-5 5',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  // Fins de round de Counter-Strike 2 (frise du bilan) : élimination, bombe explosée, bombe désamorcée.
  crosshair: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 2v5M12 17v5M2 12h5M17 12h5',
  bomb: 'M3 9h18v11H3zM7 9V5h10v4M7 14.5h4M15 13v3',
  defuse: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
  trend: 'M3.5 16.5l6-6 4 4 7-7M15 7.5h5.5V13',
  'trend-down': 'M3.5 7.5l6 6 4-4 7 7M15 16.5h5.5V11',
  trophy: 'M8 21h8M12 16v5M7 4h10v6a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  news: 'M4 4h13v16H6a2 2 0 0 1-2-2zM17 8h3v10a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h3',
  // Vocal (salons Discord) : haut-parleur, micro coupé, casque coupé.
  volume: 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  'mic-off': 'M3 3l18 18M9 9v2a3 3 0 0 0 5.1 2.1M15 10V5a3 3 0 0 0-5.7-1.3M19 11a7 7 0 0 1-1.1 3.8M5 11a7 7 0 0 0 10.9 5.8M12 18v3',
  'headphones-off': 'M3 3l18 18M4 18v-6a8 8 0 0 1 16 0v6M4 15h3v6H5a1 1 0 0 1-1-1zM20 15h-3v6h2a1 1 0 0 0 1-1z',
  // Serveurs : un battement (état du matchmaking).
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  // Événements des jeux : calendrier, cloche de « Me prévenir ».
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  // Collections (« Ranger ») : des couches empilées, pour ne pas ressembler au dossier d'installation voisin.
  layers: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5'
} as const

export type IconName = keyof typeof PATHS | 'play'

interface Props {
  name: IconName
  size?: number
  className?: string
  /** Remplit l'icône (étoile favorite). */
  filled?: boolean
}

export function Icon({ name, size = 18, className, filled }: Props): React.JSX.Element {
  if (name === 'play') {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
      </svg>
    )
  }
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
