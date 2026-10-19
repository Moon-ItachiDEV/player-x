// Bloc de trois lignes de la carte (surtitre, titre, détail) qui change en fondu quand `swapKey` change (spec §5.7).
// L'ancien bloc reste le temps de sa sortie dans un calque .upd-text.is-out posé par-dessus, puis disparaît.
// Une ligne qui change seule (pourcentage, octets, secondes) change en place : seul un changement de clé déclenche le fondu.
import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { anim, isIdle, tier } from './session'
import { KF } from './keyframes'

/** true dans le calque de sortie : ce qui s'y affiche ne rejoue pas son entrée (empreinte). */
const OutLayer = createContext(false)
export const useInSwapOut = (): boolean => useContext(OutLayer)

interface Outgoing {
  n: number
  children: ReactNode
}

let swaps = 0

export function TextSwap({ swapKey, hidden, children }: { swapKey: string; hidden?: boolean; children: ReactNode }): React.JSX.Element {
  const inRef = useRef<HTMLSpanElement>(null)
  const outRef = useRef<HTMLSpanElement>(null)
  const last = useRef<{ key: string; children: ReactNode } | null>(null)
  const inAnim = useRef<Animation | null>(null)
  const [out, setOut] = useState<Outgoing | null>(null)

  // Après chaque rendu : si la clé a changé, l'ancien contenu part dans le calque de sortie et le nouveau entre.
  useLayoutEffect(() => {
    const prev = last.current
    last.current = { key: swapKey, children }
    if (!prev || prev.key === swapKey) return
    inAnim.current?.cancel()
    inAnim.current = null
    const t = tier()
    // Réduit ou fenêtre en arrière-plan : échange instantané.
    if (t === 'reduced' || isIdle()) {
      setOut(null)
      return
    }
    const set = t === 'full' ? KF.textIn : KF.fade(160, 60)
    const a = anim(inRef.current, set.frames, { ...set.opts, level: 'sober' })
    if (a) a.onfinish = () => a.cancel() // l'état de repos est celui du CSS
    inAnim.current = a
    setOut({ n: ++swaps, children: prev.children })
  })

  // Sortie de l'ancien bloc, puis démontage.
  useLayoutEffect(() => {
    if (!out) return
    const set = tier() === 'full' ? KF.textOut : KF.fadeOut(100)
    const a = anim(outRef.current, set.frames, { ...set.opts, level: 'sober' })
    if (!a) {
      setOut(null)
      return
    }
    const n = out.n
    a.onfinish = () => setOut((o) => (o?.n === n ? null : o))
    return () => a.cancel()
  }, [out])

  useLayoutEffect(() => () => inAnim.current?.cancel(), [])

  return (
    <span className="upd-swap">
      <span className="upd-text" ref={inRef} aria-hidden={hidden || undefined}>
        {children}
      </span>
      {out && (
        <span className="upd-text is-out" ref={outRef} aria-hidden="true" inert>
          <OutLayer.Provider value={true}>{out.children}</OutLayer.Provider>
        </span>
      )}
    </span>
  )
}
