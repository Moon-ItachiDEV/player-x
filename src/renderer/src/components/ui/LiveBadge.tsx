import './live.css'

/** Pastille cyan « En jeu » : le jeu tourne sur ce PC (le cyan est réservé à cet état). */
export function LiveBadge({ className = '', label = 'En jeu' }: { className?: string; label?: string }): React.JSX.Element {
  return (
    <span className={`live-badge ${className}`}>
      <span className="live-dot fx-loop" aria-hidden="true" />
      {label}
    </span>
  )
}
