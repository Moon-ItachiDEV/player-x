// Carte du lancement (spec launch-sequence.md §3.2), en bas à gauche du contenu, au-dessus de la carte de mise à jour.
// Elle dit où en est le lancement (envoyé à Steam, en attente du jeu, en jeu) sans rien inventer : aucune barre, aucun
// pourcentage, aucune animation qui tourne pendant l'attente. Taille fixe dans toutes les phases, jamais focalisée seule.
// La seule région annoncée du lancement vit ici, toujours montée.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cleanName } from '@shared/text'
import { Cover } from '../components/ui/Cover'
import { Icon } from '../components/ui/Icon'
import { StoreTag } from '../components/ui/StoreTag'
import { KF } from '../update/keyframes'
import { anim, fx, tier, useStore } from '../update/session'
import { TextSwap } from '../update/TextSwap'
import { play, useWindowActive } from '../update/useCardPhase'
import { cardCopy, elapsedLabel, type CardAction } from './copy'
import { LKF } from './keyframes'
import { ActiveClock, CARD_ACTIVE_MS, COUNTER_FROM_MS, isPending, nextBucketAt } from './phase'
import { cancelLaunch, dismissCard, dockRecord, focusSource, gameOf, launchAnnounce, launches, startLaunch, type LaunchView } from './store'
import './launch-dock.css'

/** Cartes déjà montées une fois : la suivante (revenue devant) entre simplement, sans rejouer la mise à feu. */
const mountedOnce = new Set<string>()

export function LaunchDock({ onRescan }: { onRescan: () => void }): React.JSX.Element {
  const all = useStore(launches)
  const announce = useStore(launchAnnounce)
  const rec = dockRecord(all)
  const dockRef = useRef<HTMLDivElement>(null)
  const id = rec?.launchId ?? null
  // Carte qui part (fermée, remplacée) : la même, gardée le temps de sa sortie. Décidé pendant le rendu, pour que
  // React garde son élément (et le focus qu'il tient) au lieu de le démonter puis d'en remonter une copie.
  const [curId, setCurId] = useState<string | null>(id)
  const [out, setOut] = useState<LaunchView | null>(null)
  if (id !== curId) {
    const prev = curId ? (all[curId] ?? null) : null
    setCurId(id)
    setOut(prev && prev.launchId !== id ? prev : null)
  }
  const outId = out && out.launchId !== id ? out.launchId : null

  // Sortie : rend le focus au contrôle d'origine si la carte le tenait, puis 200 ms de fondu (rien en réduit).
  useLayoutEffect(() => {
    if (!outId) return
    const el = dockRef.current?.querySelector<HTMLElement>(`.launch-card[data-launch-id="${CSS.escape(outId)}"]`)
    if (!el) return setOut(null)
    if (el.contains(document.activeElement)) {
      const src = focusSource(outId)
      if (src) src.focus({ preventScroll: true })
      else (document.activeElement as HTMLElement | null)?.blur()
    }
    el.inert = true
    const a = anim(el, KF.cardLeave.frames, { ...KF.cardLeave.opts, level: 'sober' })
    const done = (): void => setOut((o) => (o?.launchId === outId ? null : o))
    if (a) a.onfinish = done
    else done()
    return () => {
      a?.cancel()
      el.inert = false
    }
  }, [outId])

  return (
    <div className="launch-dock" ref={dockRef} data-open={rec ? '' : undefined}>
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
      {outId && <Card key={outId} v={all[outId] ?? out!} leaving onRescan={onRescan} />}
      {rec && <Card key={rec.launchId} v={rec} onRescan={onRescan} />}
    </div>
  )
}

interface CardProps {
  v: LaunchView
  leaving?: boolean
  onRescan: () => void
}

function Card({ v, leaving, onRescan }: CardProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const active = useWindowActive()
  const [now, setNow] = useState(() => Date.now())
  const [hovered, setHovered] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const s = v.status
  const game = gameOf(v.gameId)
  // Revenu après un rechargement avant la bibliothèque : le nom arrive avec elle.
  const name = v.name || (game ? cleanName(game.name) : '')
  const t = active ? Date.now() : now
  const c = cardCopy(s, { name, now: t })
  const elapsed = elapsedLabel(s, t, COUNTER_FROM_MS)
  const pending = isPending(s.phase)

  // ----- horloge : palier de texte, et compteur à 1 Hz seulement fenêtre active -----
  useEffect(() => {
    if (leaving || !active) return
    const at = Date.now()
    let next = nextBucketAt(s, at)
    // Prochaine seconde pleine depuis le clic : le compteur change en même temps que l'heure réelle.
    if (pending) next = Math.min(next, at + 1000 - ((at - s.clickAt) % 1000))
    if (!Number.isFinite(next)) return
    const id = setTimeout(() => setNow(Date.now()), Math.max(16, next - at))
    return () => clearTimeout(id)
  }, [leaving, active, s, pending, now])

  // ----- temps d'affichage d'une carte terminée, compté fenêtre active, ni survolée ni focalisée -----
  const budget = CARD_ACTIVE_MS[s.phase]
  const clock = useRef<{ key: string; c: ActiveClock } | null>(null)
  const clockKey = `${s.phase}:${v.changedAt}`
  if (budget !== undefined && clock.current?.key !== clockKey) clock.current = { key: clockKey, c: new ActiveClock(budget) }
  const counting = active && !hovered && !focusWithin
  useEffect(() => {
    const ck = clock.current
    if (leaving || budget === undefined || !ck || ck.key !== clockKey) return
    const at = Date.now()
    if (!counting) return ck.c.pause(at)
    ck.c.resume(at)
    const id = setTimeout(() => dismissCard(v.launchId), ck.c.remaining(at))
    return () => {
      clearTimeout(id)
      ck.c.pause(Date.now())
    }
  }, [leaving, budget, clockKey, counting, v.launchId])

  // ----- entrée -----
  useLayoutEffect(() => {
    if (leaving) return
    const first = !mountedOnce.has(v.launchId)
    mountedOnce.add(v.launchId)
    if (v.hydrated && first) return
    // La mise à feu et le glissé posent eux-mêmes la carte (sequence.ts), au premier affichage seulement.
    if (first && (v.entrance === 'stage' || v.entrance === 'glide' || v.entrance === 'none')) return
    const set = tier() === 'full' ? KF.cardIn : KF.cardInSober
    play(ref.current, set, { level: 'sober' })
    // Une seule fois par montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----- détection : une onde sur la vignette, seulement si la fenêtre est au premier plan -----
  const prevPhase = useRef(s.phase)
  useLayoutEffect(() => {
    const was = prevPhase.current
    prevPhase.current = s.phase
    if (leaving || was === s.phase) return
    if (s.phase === 'running' && isPending(was) && fx()) play(ref.current?.querySelector('.launch-ping'), KF.pingStage)
  }, [s.phase, leaving])

  // ----- clic sur un jeu déjà en cours de lancement : un reflet passe -----
  const prevBump = useRef(v.bump)
  useLayoutEffect(() => {
    const was = prevBump.current
    prevBump.current = v.bump
    if (leaving || v.bump <= was) return
    play(ref.current?.querySelector('.launch-card-sheen'), LKF.cardSheen)
  }, [v.bump, leaving])

  // ----- fenêtre en arrière-plan : tout passage en cours saute à sa fin -----
  useLayoutEffect(() => {
    if (active) return
    for (const a of ref.current?.getAnimations({ subtree: true }) ?? []) {
      if (a instanceof CSSAnimation || a instanceof CSSTransition) continue
      a.finish()
    }
  }, [active])

  const close = (): void => {
    if (leaving) return
    if (pending) cancelLaunch(v.launchId)
    else dismissCard(v.launchId)
  }

  const act = (a: CardAction): void => {
    if (leaving) return
    dismissCard(v.launchId)
    if (a.kind === 'rescan') return onRescan()
    if (game) startLaunch(game, null, a.kind)
  }

  const live = c.live
  const cls = ['launch-card', c.action ? 'has-action' : '', leaving ? 'is-leaving' : '']
  return (
    <div
      ref={ref}
      className={cls.filter(Boolean).join(' ')}
      data-launch-id={v.launchId}
      data-tone={c.tone}
      data-live={live || undefined}
      role="group"
      aria-label={c.groupLabel}
      aria-hidden={leaving || undefined}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.preventDefault()
        e.stopPropagation()
        close()
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false)
      }}
    >
      <span className="launch-ignite" aria-hidden="true" />
      <span className="launch-card-sheen" aria-hidden="true" />
      <span className="launch-thumb" aria-hidden="true">
        {game?.coverUrl ? (
          <Cover game={game} variant="portrait" showTitle={false} />
        ) : (
          <span className="launch-mono">{game ? <StoreTag kind={game.store} size={24} /> : null}</span>
        )}
        <span className="launch-ping" />
      </span>
      <TextSwap swapKey={`${c.kicker}|${c.sub}`}>
        <span className="upd-kicker launch-kicker-row">
          {live && <i className="launch-dot" aria-hidden="true" />}
          <span title={c.kicker}>{c.kicker}</span>
          {elapsed && (
            <span className="launch-elapsed num" aria-hidden="true">
              {elapsed}
            </span>
          )}
        </span>
        <span className="upd-title" title={name}>
          {name}
        </span>
        <span className="upd-sub" title={c.subTitle}>
          {c.sub}
        </span>
      </TextSwap>
      {c.action && (
        <button className="btn btn-secondary btn-sm launch-action" onClick={() => act(c.action!)} tabIndex={leaving ? -1 : undefined}>
          {c.action.label}
        </button>
      )}
      <button className="icon-btn icon-btn-sm launch-x" onClick={close} aria-label={c.closeLabel} title={c.closeLabel} tabIndex={leaving ? -1 : undefined}>
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}
