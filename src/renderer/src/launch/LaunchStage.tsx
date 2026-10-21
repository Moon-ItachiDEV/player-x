// Scène de la mise à feu (spec launch-sequence.md §3.1) et calque du glissé, rendus dans <body> au-dessus du contenu.
// Sans logique : sequence.ts pose son état et joue les animations. Jamais focalisable, jamais modale, ne bloque aucun clic.
import { createPortal } from 'react-dom'
import { generatedBackground } from '../components/ui/Cover'
import { useStore } from '../update/session'
import { TextSwap } from '../update/TextSwap'
import { cardCopy } from './copy'
import { launchStage, type StageView } from './sequence'
import { launches } from './store'
import './launch-stage.css'

/** Jaquette déjà en mémoire (même adresse que la source) : affichée tout de suite, sans le fondu de chargement de Cover. */
function Art({ game, name }: { game: StageView['game']; name: string }): React.JSX.Element {
  return (
    <div className="cover cover-portrait" style={{ background: generatedBackground(game.name) }}>
      {game.coverUrl ? <img className="cover-img is-loaded" src={game.coverUrl} alt="" draggable={false} /> : <span className="cover-title">{name}</span>}
    </div>
  )
}

function StageText({ v }: { v: StageView }): React.JSX.Element {
  const s = useStore(launches)[v.launchId]?.status
  // Avant la mise à feu : le texte du clic (« Envoi à Steam… ») ; après : celui du lien transmis.
  const shown = s && !v.after ? { ...s, phase: 'sending' as const } : s
  const c = shown ? cardCopy(shown, { name: v.name, now: shown.phase === 'sending' ? shown.clickAt : Date.now() }) : null
  const kicker = c?.kicker || (v.demo ? 'Mode démo · Lancement' : 'Lancement')
  const sub = c?.sub ?? ''
  return (
    <div className="launch-text">
      <TextSwap swapKey={`k:${kicker}`}>
        <span className="launch-kicker">{kicker}</span>
      </TextSwap>
      <span className="launch-title">{v.name}</span>
      <TextSwap swapKey={`s:${sub}`}>
        <span className="launch-sub">{sub}</span>
      </TextSwap>
    </div>
  )
}

function Stage({ v }: { v: StageView }): React.JSX.Element {
  const { left, top, width, height } = v.content
  const narrow = width < 760 || height < 560
  const style = {
    '--cl': `${left}px`,
    '--ct': `${top}px`,
    '--cw': `${width}px`,
    '--ch': `${height}px`,
    '--cx': `${left + width / 2}px`,
    '--cy': `${top + height / 2}px`
  } as React.CSSProperties
  return (
    <div className="launch-stage" data-key={v.key} data-mode="stage" data-narrow={narrow || undefined} data-demo={v.demo || undefined} style={style} aria-hidden="true">
      <div className="launch-veil" />
      <div className="launch-band">
        {v.bandUrl ? <img src={v.bandUrl} alt="" draggable={false} /> : <div className="launch-band-gen" style={{ background: generatedBackground(v.game.name) }} />}
        <div className="launch-band-shade" />
      </div>
      <div className="launch-group">
        <div className="launch-art">
          <span className="launch-shock" />
          <div className="launch-poster">
            <Art game={v.game} name={v.name} />
            <span className="launch-sheen" />
          </div>
        </div>
        <StageText v={v} />
      </div>
    </div>
  )
}

function Glide({ v }: { v: StageView }): React.JSX.Element {
  const g = v.ghost!
  return (
    <div className="launch-stage" data-key={v.key} data-mode="glide" aria-hidden="true">
      <div className="launch-ghost" style={{ left: g.left, top: g.top, width: g.width, height: g.height }}>
        <Art game={v.game} name={v.name} />
      </div>
    </div>
  )
}

export function LaunchStage(): React.JSX.Element | null {
  const v = useStore(launchStage)
  if (!v) return null
  return createPortal(v.mode === 'stage' ? <Stage v={v} /> : <Glide v={v} />, document.body)
}
