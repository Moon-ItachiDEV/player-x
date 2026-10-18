// Bandeau « mise à jour prête », en bas à gauche du contenu. Ne bloque rien : la mise à jour s'installe aussi à la fermeture.
import { useEffect, useState } from 'react'
import type { UpdateState } from '@shared/types'
import type { UpdateNoticeProps } from '../contracts'
import { Icon } from './ui/Icon'
import './update.css'

/** État des mises à jour (processus principal), tenu à jour par l'événement `update:state`. `null` tant qu'il n'est pas connu. */
export function useUpdateState(): [UpdateState | null, (s: UpdateState) => void] {
  const [state, setState] = useState<UpdateState | null>(null)
  useEffect(() => {
    let alive = true
    const off = window.launcher.onUpdateState((s) => alive && setState(s))
    // Un événement arrivé entre-temps est plus récent : on le garde.
    window.launcher
      .getUpdateState()
      .then((s) => alive && setState((cur) => cur ?? s))
      .catch(() => {})
    return () => {
      alive = false
      off()
    }
  }, [])
  return [state, setState]
}

export function UpdateNotice({ onOpenAbout }: UpdateNoticeProps): React.JSX.Element | null {
  const [state] = useUpdateState()
  // « Plus tard » masque le bandeau jusqu'au prochain changement d'état (autre version, nouvelle étape).
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)

  if (!state) return null
  const key = state.state === 'ready' || state.state === 'downloading' ? `${state.state}:${state.version}` : state.state
  if (dismissed === key) return null

  if (state.state === 'downloading') {
    return (
      <div className="upd-dock">
        <button
          className="upd-chip"
          onClick={onOpenAbout}
          title="Voir les détails dans Paramètres › À propos"
          aria-label={`Téléchargement de Player X ${state.version} en arrière-plan. Voir les détails`}
        >
          <span className="upd-chip-label" aria-hidden="true">
            Mise à jour <span className="num">{state.version}</span>
            <span className="upd-chip-pct num">{state.percent} %</span>
          </span>
          <span className="upd-chip-track" aria-hidden="true">
            <span className="upd-chip-fill" style={{ transform: `scaleX(${state.percent / 100})` }} />
          </span>
        </button>
      </div>
    )
  }

  if (state.state !== 'ready') return null

  const restart = async (): Promise<void> => {
    if (installing) return
    setInstalling(true)
    try {
      await window.launcher.installUpdate()
      // L'appli se ferme dans la foulée ; si rien ne se passe, le bouton redevient utilisable.
      setTimeout(() => setInstalling(false), 15_000)
    } catch {
      setInstalling(false)
    }
  }

  return (
    <div className="upd-dock">
      <div className="upd-card" role="status">
        <span className="upd-icon fx-loop" aria-hidden="true">
          <Icon name="refresh" size={16} />
        </span>
        <div className="upd-text">
          <div className="upd-title">
            Player X <span className="num">{state.version}</span> est prête
          </div>
          <div className="upd-sub">
            S'installe aussi à la fermeture ·{' '}
            <button className="link-btn upd-link" onClick={onOpenAbout}>
              Détails
            </button>
          </div>
        </div>
        <div className="upd-actions">
          <button className="btn btn-primary btn-sm" onClick={restart} disabled={installing}>
            {installing && <span className="spinner" />}
            {installing ? 'Redémarrage…' : 'Redémarrer'}
          </button>
          <button className="icon-btn icon-btn-sm upd-close" onClick={() => setDismissed(key)} aria-label="Plus tard" title="Plus tard">
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
