import { useState } from 'react'
import { plural } from '@shared/text'
import type { ScanReport } from '@shared/types'
import { Icon } from '../ui/Icon'
import { STORE_LONG, StoreTag } from '../ui/StoreTag'
import './library.css'

interface NoGamesProps {
  report: ScanReport[]
  onRescan: () => void
}

/** Aucun jeu détecté : relancer ou comprendre (dossiers examinés). */
export function NoGames({ report, onRescan }: NoGamesProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="empty-state lib-empty">
      <div className="empty-icon">
        <Icon name="gamepad" size={28} />
      </div>
      <h3>Aucun jeu détecté</h3>
      <p>On cherche les jeux installés via Steam, Epic Games et l'EA app sur ce PC.</p>
      <div className="empty-actions">
        <button className="btn btn-primary" onClick={onRescan}>
          <Icon name="refresh" size={16} />
          Relancer le scan
        </button>
        <button className="btn btn-secondary" aria-expanded={open} aria-controls="lib-scan-report" onClick={() => setOpen((o) => !o)}>
          Voir les dossiers examinés
          <Icon name="chevron-down" size={16} className={`lib-chevron ${open ? 'is-open' : ''}`} />
        </button>
      </div>
      {open && <ScanReportList id="lib-scan-report" report={report} />}
    </div>
  )
}

function ScanReportList({ id, report }: { id: string; report: ScanReport[] }): React.JSX.Element {
  if (report.length === 0) {
    return (
      <p id={id} className="caption lib-report-none">
        Aucun dossier examiné pour l'instant. Relance le scan.
      </p>
    )
  }
  return (
    <ul id={id} className="lib-report card-surface">
      {report.map((r) => (
        <li key={r.store} className="lib-report-row">
          <div className="lib-report-head">
            <StoreTag kind={r.store} />
            <span className="lib-report-store">{STORE_LONG[r.store]}</span>
            <span className={`pill ${r.error ? 'pill-danger' : r.found ? 'pill-success' : 'pill-muted'}`}>
              {r.error ? 'Erreur' : r.found ? plural(r.found, 'jeu trouvé', 'jeux trouvés') : 'Aucun jeu'}
            </span>
          </div>
          {r.error && <p className="lib-report-error">{r.error}</p>}
          {r.checked.length > 0 ? (
            <ul className="lib-report-paths">
              {r.checked.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="caption">Aucun dossier examiné.</p>
          )}
        </li>
      ))}
    </ul>
  )
}
