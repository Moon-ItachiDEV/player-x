// Scène plein écran (saut et retour), rendue dans <body> au-dessus de tout, hors de .shell (que le saut rend inert).
// Elle n'a pas de logique : stage.ts pose son état et joue ses chronologies. Dans ToastProvider pour le toast d'abandon.
import { useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/ui/Icon'
import { useToast } from '../components/ui/Toasts'
import { ConsoleMark } from './ConsoleMark'
import { useStore } from './session'
import { bindStageNotify, revealInfo, stage, stageAnnounce, stageCommitted, type RevealInfo } from './stage'
import './stage.css'

function WarpText({ version, preview }: { version: string; preview: boolean }): React.JSX.Element {
  if (preview) {
    return (
      <>
        <span className="stage-kicker">Aperçu</span>
        <span className="stage-line">Player X ne se ferme pas</span>
        <span className="stage-caption">C'est ce que tu verras au prochain redémarrage.</span>
      </>
    )
  }
  return (
    <>
      <span className="stage-kicker">Redémarrage</span>
      <span className="stage-line">
        Installation de la <span className="num">{version}</span>
      </span>
      <span className="stage-caption">Player X se ferme quelques secondes et revient tout seul.</span>
    </>
  )
}

function RevealText({ info }: { info: RevealInfo }): React.JSX.Element {
  return (
    <>
      <span className="stage-kicker">{info.kicker}</span>
      <span className="stage-versions">
        {info.from && (
          <>
            <span className="stage-from">{info.from}</span>
            <span className="stage-arrow" aria-hidden="true">
              →
            </span>
          </>
        )}
        {/* Un span par vrai caractère, dans l'ordre : ils montent l'un après l'autre (stage.ts). La version lue reste à côté. */}
        <span className="sr-only">{info.to}</span>
        <span className="stage-to">
          {[...info.to].slice(0, 16).map((ch, i) => (
            <span key={i} aria-hidden="true">
              {ch}
            </span>
          ))}
        </span>
      </span>
      {info.chips.length > 0 && (
        <span className="stage-chips">
          {info.chips.map((c) => (
            <span key={c.key} className="stage-chip" title={c.title}>
              {c.key === 'signed' && <Icon name="shield-check" size={12} />}
              <span>
                {c.label}
                {c.mono && <span className="num-mono">{c.mono}</span>}
              </span>
            </span>
          ))}
        </span>
      )}
    </>
  )
}

export function UpdateStage(): React.JSX.Element | null {
  const s = useStore(stage)
  const info = useStore(revealInfo)
  const announce = useStore(stageAnnounce)
  const notify = useToast()
  useEffect(() => bindStageNotify(notify), [notify])
  // Avant l'affichage : stage.ts démarre ses animations sur les éléments tout juste montés.
  useLayoutEffect(() => stageCommitted(), [s, info])

  return createPortal(
    <>
      {s.mode !== 'idle' && (
        <div key={s.mode} className="stage" data-mode={s.mode} data-phase={s.phase} data-tier={s.tier} data-preview={s.preview || undefined}>
          <div className="stage-veil" />
          <div className="stage-fx">
            <canvas className="stage-canvas" aria-hidden="true" />
            {s.mode === 'warp' && s.origin && <span className="stage-flash" style={{ left: s.origin.x, top: s.origin.y }} aria-hidden="true" />}
            <span className="stage-shock" aria-hidden="true" />
            {/* La console : son écran s'éteint au saut et se rallume au retour (stage.ts). */}
            <ConsoleMark className="stage-mark" />
            <div className="stage-text">
              {s.mode === 'warp' ? <WarpText version={s.version} preview={s.preview} /> : info && <RevealText info={info} />}
            </div>
            {s.mode === 'reveal' && info?.skipHint && <p className="stage-skip">Clique ou appuie sur une touche pour passer</p>}
            {s.preview && <span className="stage-badge">Aperçu · Échap pour arrêter</span>}
          </div>
        </div>
      )}
      {/* Toujours là, même scène fermée : « Aperçu terminé. » s'annonce après le démontage. */}
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </>,
    document.body
  )
}
