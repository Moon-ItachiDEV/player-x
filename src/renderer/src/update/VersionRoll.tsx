// Numéro de version qui monte caractère par caractère (retour d'une mise à jour, Quoi de neuf). Les vrais caractères, dans l'ordre.
import { useLayoutEffect, useRef } from 'react'
import { anim } from './session'
import { KF } from './keyframes'

export function VersionRoll({ value, base = 350, className = '' }: { value: string; base?: number; className?: string }): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const spans = ref.current?.querySelectorAll<HTMLElement>(':scope > span')
    if (!spans) return
    const played: Array<Animation | null> = []
    spans.forEach((el, i) => played.push(anim(el, KF.toChar(i, base).frames, KF.toChar(i, base).opts)))
    // Effets coupés : un seul fondu pour tout le numéro.
    if (!played.some(Boolean)) played.push(anim(ref.current, KF.fade(200, base).frames, { ...KF.fade(200, base).opts, level: 'sober' }))
    return () => played.forEach((a) => a?.cancel())
  }, [value, base])
  return (
    <span ref={ref} className={`vroll num ${className}`} aria-label={value}>
      {[...value].slice(0, 16).map((ch, i) => (
        <span key={i} aria-hidden="true" style={{ display: 'inline-block' }}>
          {ch}
        </span>
      ))}
    </span>
  )
}
