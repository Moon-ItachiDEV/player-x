// Carte de mise à jour, en bas à gauche du contenu (spec Séquence Réacteur §5–§6) : téléchargement, vérification de la
// signature, compte à rebours puis redémarrage ; refusée ou interrompue sinon. Pendant une partie, le téléchargement et la
// vérification deviennent une pastille immobile. Taille fixe dans toutes les phases : rien ne se redimensionne.
// Les phases, la file des étapes et toutes les images clés sont dans update/useCardPhase.ts.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { UpdateNoticeProps } from '../contracts'
import { tier, useUpdateState, VERSION } from '../update/session'
import { useCardPhase, play, type CardModel } from '../update/useCardPhase'
import { Reactor, type ReactorCenter } from '../update/Reactor'
import { TextSwap, useInSwapOut } from '../update/TextSwap'
import { KF } from '../update/keyframes'
import { fpShort, pair, pct, speed } from '../update/format'
import { Icon } from './ui/Icon'
import './update.css'

export { useUpdateState } from '../update/session'

const NB = ' '
const ABOUT_TITLE = 'Voir les détails dans Paramètres › À propos'
/** Nouvel essai du processus principal après une erreur (updater.ts, RETRY_DELAY = 30 min). */
const RETRY_LABEL = `nouvel essai dans 30${NB}min`

const INTERRUPTED_TITLE = {
  network: 'Connexion perdue',
  verify: 'Vérification impossible',
  other: 'Téléchargement interrompu',
  unsigned: 'Téléchargement interrompu'
} as const

const HOLD_SUB = {
  unfocused: 'En pause jusqu’à ton retour',
  hover: 'Redémarrage en pause',
  game: 'En pause pendant ta partie',
  blocked: 'Redémarre quand tu veux'
} as const

export function UpdateNotice({ onOpenAbout, inGame }: UpdateNoticeProps): React.JSX.Element {
  const [state] = useUpdateState()
  const cardRef = useRef<HTMLDivElement>(null)
  const api = useCardPhase(state, { inGame, cardRef })
  const m = api.model
  const announce = useAnnouncement(m)
  const mode = m.phase === 'hidden' ? 'none' : m.mini ? 'mini' : 'card'

  return (
    <div className="upd-dock" data-mode={mode}>
      {/* Une seule zone annoncée, toujours montée, écrite seulement aux changements de phase (§14.1). */}
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
      {mode === 'mini' && <MiniPill m={m} onOpen={onOpenAbout} />}
      {mode === 'card' && <Card key={m.id} m={m} api={api} cardRef={cardRef} onOpenAbout={onOpenAbout} />}
    </div>
  )
}

interface CardProps {
  m: CardModel
  api: ReturnType<typeof useCardPhase>
  cardRef: React.RefObject<HTMLDivElement | null>
  onOpenAbout: () => void
}

function Card({ m, api, cardRef, onOpenAbout }: CardProps): React.JSX.Element {
  const { phase, version: v, preview } = m
  const hasHit = !preview && (phase === 'download' || phase === 'verify')
  const ready = phase === 'lock' || phase === 'armed' || phase === 'installing'
  const busy = phase === 'installing' || m.leaving
  const rows = rowsFor(m)

  let center: ReactorCenter = 'none'
  if (phase === 'download' || phase === 'verify') center = 'pct'
  else if (phase === 'lock') center = 'sec'
  else if (phase === 'armed') center = m.hold === 'unfocused' || m.hold === 'game' ? 'pause' : m.hold === 'blocked' ? 'check' : 'sec'
  else if (phase === 'installing') center = 'check'
  else if (phase === 'interrupted') center = 'alert'

  const stop = (
    <button className="icon-btn icon-btn-sm upd-x" onClick={api.close} disabled={m.leaving} aria-label="Arrêter l’aperçu" title="Arrêter l’aperçu">
      <Icon name="x" size={14} />
    </button>
  )
  // Aperçu : × « Arrêter l'aperçu » partout sauf quand il est prêt, où « Plus tard » l'arrête (un × de plus ne laisserait
  // que 157 px au texte, « Redémarrage simulé dans 5 s » en fait 168).
  let actions: React.ReactNode = null
  if (ready) {
    actions = (
      <>
        <button
          className="btn btn-primary btn-sm upd-go"
          onClick={api.restart}
          disabled={busy}
          title={preview ? undefined : `Installer la ${v} maintenant`}
        >
          {/* Remplissage du compte à rebours : position statique ici, animée par useCardPhase quand c'est permis. */}
          <span className="upd-charge" aria-hidden="true" style={{ transform: `translateX(${(-(m.left / m.countdown) * 100).toFixed(2)}%)` }} />
          Redémarrer
        </button>
        <button
          className="btn btn-ghost btn-sm upd-later"
          onClick={api.later}
          disabled={busy}
          title={preview ? undefined : 'Elle s’installera quand tu fermeras Player X'}
        >
          Plus tard
        </button>
      </>
    )
  } else if (phase === 'refused' || phase === 'interrupted') {
    actions = preview ? (
      stop
    ) : (
      <>
        <button className="btn btn-ghost btn-sm" onClick={onOpenAbout} disabled={m.leaving} title={ABOUT_TITLE}>
          Détails
        </button>
        <button className="icon-btn icon-btn-sm upd-x" onClick={api.close} disabled={m.leaving} aria-label="Fermer" title="Fermer">
          <Icon name="x" size={14} />
        </button>
      </>
    )
  } else if (preview) actions = stop

  const cls = ['upd-card', actions ? 'has-actions' : '', m.critical ? 'is-critical' : '', m.locking ? 'is-locking' : '', m.hold === 'hover' ? 'is-held' : '', m.leaving ? 'is-leaving' : '']
  const hitLabel =
    phase === 'download' ? `Téléchargement de Player X ${v} : ${m.percent}${NB}%. Voir les détails` : `Vérification de Player X ${v}. Voir les détails`

  return (
    <div
      ref={cardRef}
      className={cls.filter(Boolean).join(' ')}
      data-phase={phase}
      data-step={phase === 'verify' ? m.step : undefined}
      data-rate={m.rate}
      style={{ '--p': m.p.toFixed(3) } as React.CSSProperties}
      role="group"
      aria-label="Mise à jour de Player X"
      onPointerEnter={() => api.setHovered(true)}
      onPointerLeave={() => api.setHovered(false)}
      onFocus={() => api.setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) api.setFocusWithin(false)
      }}
    >
      <span className="upd-sheen" aria-hidden="true" />
      <span className="upd-hover" aria-hidden="true" />
      <Reactor lit={m.lit} cellsOn={m.cellsOn} hashP={m.hashP} center={center} percent={m.percent} seconds={m.left} />
      <TextSwap swapKey={m.textKey} hidden={hasHit}>
        <span className="upd-kicker" title={rows.kicker}>
          {rows.kickerIcon && <Icon name={rows.kickerIcon} size={12} />}
          <span>{rows.kicker}</span>
        </span>
        <span className="upd-title" title={rows.title}>
          {rows.title}
        </span>
        <span className="upd-sub" title={rows.subTitle}>
          {rows.sub}
        </span>
      </TextSwap>
      {actions && <div className="upd-actions">{actions}</div>}
      {phase === 'download' && <Stream />}
      {hasHit && <button className="upd-hit" onClick={onOpenAbout} aria-label={hitLabel} title={ABOUT_TITLE} />}
    </div>
  )
}

interface Rows {
  kicker: string
  kickerIcon?: 'shield-check' | 'shield-x'
  title: string
  sub: React.ReactNode
  subTitle: string
}

/** Les trois lignes de la carte, phase par phase (copie §13.1–§13.4, aperçu §13.7). */
function rowsFor(m: CardModel): Rows {
  const { phase, version: v, preview } = m
  const product = preview ? 'Exemple de mise à jour' : `Player X ${v}`
  // Pendant le verrouillage, les lignes de la vérification restent jusqu'au fondu (300 ms).
  const showVerify = phase === 'verify' || (phase === 'lock' && m.textKey === 'verify')

  if (phase === 'download') {
    let sub = 'Téléchargement en arrière-plan'
    if (preview) sub = 'Aucun téléchargement réel'
    else if (m.bytes) {
      // Figé : la vitesse disparaît (c'est une moyenne, elle mentirait).
      const tail = m.stalled ? 'en attente du réseau' : m.bytes.bps ? speed(m.bytes.bps) : ''
      sub = tail ? `${pair(m.bytes.done, m.bytes.total)} · ${tail}` : pair(m.bytes.done, m.bytes.total)
    } else if (m.stalled) sub = `${sub} · en attente du réseau`
    return { kicker: preview ? 'Aperçu · téléchargement' : 'Téléchargement', title: product, sub, subTitle: sub }
  }

  if (showVerify) {
    const step = m.step ?? 'check'
    const n = step === 'signature' ? 1 : step === 'hash' ? 2 : 3
    const kicker = preview ? `Aperçu · vérification · ${n}/3` : `Vérification · ${n}/3`
    let sub: React.ReactNode
    let subTitle: string
    if (preview) {
      if (step === 'check' && m.fingerprint) {
        subTitle = `Empreinte de ta version${NB}: ${fpShort(m.fingerprint)}`
        sub = <Fingerprint label={`Empreinte de ta version${NB}:`} hex={m.fingerprint} />
      } else sub = subTitle = 'Aucune vérification réelle'
    } else if (step === 'signature') sub = subTitle = 'Récupération de la signature…'
    else if (step === 'hash') sub = subTitle = `Empreinte SHA-512 · ${pct(Math.floor(m.hashP * 100))}`
    else if (m.fingerprint) {
      subTitle = `SHA-512 ${fpShort(m.fingerprint)}`
      sub = <Fingerprint label="SHA-512" hex={m.fingerprint} />
    } else sub = subTitle = 'SHA-512'
    return { kicker, title: product, sub, subTitle }
  }

  if (phase === 'lock' || phase === 'armed' || phase === 'installing') {
    let sub: string
    if (phase === 'installing') sub = 'Redémarrage…'
    else if (m.hold) sub = preview ? 'Aperçu en pause' : HOLD_SUB[m.hold]
    else sub = `${preview ? 'Redémarrage simulé dans' : 'Redémarrage dans'} ${m.left}${NB}s`
    return {
      kicker: preview ? 'Aperçu · prête' : 'Signée et prête',
      kickerIcon: preview ? undefined : 'shield-check',
      title: preview ? product : `${VERSION} → ${v}`,
      sub,
      subTitle: sub
    }
  }

  if (phase === 'refused') {
    const sub = 'Non signée · rien n’est installé'
    return { kicker: 'Refusée', kickerIcon: 'shield-x', title: product, sub, subTitle: sub }
  }

  // Interrompue
  const sub = `${v} · ${RETRY_LABEL}`
  return { kicker: 'Interrompue', title: INTERRUPTED_TITLE[m.errorCode ?? 'other'], sub, subTitle: sub }
}

/** « 3f9a1c0e…a77d8b21 » : les vrais caractères, dans l'ordre, qui entrent un par un (rien n'est brouillé). */
function Fingerprint({ label, hex }: { label: string; hex: string }): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  const still = useInSwapOut()
  useLayoutEffect(() => {
    const el = ref.current
    if (still || !el) return
    const played: Array<Animation | null> = []
    if (tier() === 'full') el.querySelectorAll(':scope > span').forEach((ch, i) => played.push(play(ch, KF.fpChar(i))))
    else played.push(play(el, KF.fade(160), { level: 'sober' }))
    return () => played.forEach((a) => a?.cancel())
  }, [hex, still])
  return (
    <>
      <span className="upd-fp-label">{label}</span>
      <span className="upd-fp" ref={ref} title={hex}>
        {[...fpShort(hex)].map((ch, i) => (
          <span key={i}>{ch}</span>
        ))}
      </span>
    </>
  )
}

/** Barre de flux : le dégradé reste épinglé à la barre (fenêtre et remplissage se déplacent en sens inverse). */
function Stream(): React.JSX.Element {
  return (
    <span className="upd-stream" aria-hidden="true">
      <span className="upd-stream-win">
        <span className="upd-stream-fill" />
      </span>
      <span className="upd-stream-head">
        <i />
      </span>
      <span className="upd-pk">
        <i />
      </span>
      <span className="upd-pk">
        <i />
      </span>
      <span className="upd-pk">
        <i />
      </span>
    </span>
  )
}

/** Pastille pendant une partie (§5.8) : 188 × 40, aucune animation ni transition, un bouton vers À propos. */
function MiniPill({ m, onOpen }: { m: CardModel; onOpen: () => void }): React.JSX.Element {
  const verify = m.phase === 'verify'
  const value = verify ? 100 : m.percent
  const label = verify ? `Mise à jour ${m.version} : vérification. Voir les détails` : `Mise à jour ${m.version} : ${m.percent}${NB}%. Voir les détails`
  return (
    <button className="upd-mini" onClick={onOpen} aria-label={label} title={ABOUT_TITLE}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <circle className="upd-mini-track" cx="12" cy="12" r="10" />
        <circle
          className="upd-mini-val"
          cx="12"
          cy="12"
          r="10"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - value}
          transform="rotate(-90 12 12)"
        />
      </svg>
      <span className="upd-mini-text num">
        {m.version} · {verify ? 'vérification' : pct(m.percent)}
      </span>
    </button>
  )
}

/** Annonces polies (§13.9), une par changement de phase et par version. L'aperçu a les siennes (preview.ts). */
function useAnnouncement(m: CardModel): string {
  const [text, setText] = useState('')
  const last = useRef('')
  const v = m.version
  // Prête pendant une partie : le compte attend la fin de la partie, l'annonce le dit (puis annonce le compte à la reprise).
  const ready = m.phase === 'armed' && m.hold === 'game' ? 'ready-game' : 'ready'
  const group = m.preview ? '' : m.phase === 'lock' || m.phase === 'armed' ? ready : m.phase === 'installing' || m.phase === 'hidden' ? '' : m.phase
  useEffect(() => {
    if (!group || `${group}:${v}` === last.current) return
    last.current = `${group}:${v}`
    setText(
      group === 'download'
        ? `Téléchargement de Player X ${v} en arrière-plan.`
        : group === 'verify'
          ? `Vérification de la mise à jour ${v}.`
          : group === 'ready-game'
            ? `Player X ${v} est prête et signée. Le redémarrage attendra la fin de ta partie, ou choisis Plus tard.`
            : group === 'ready'
              ? `Player X ${v} est prête et signée. Redémarrage automatique dans 10 secondes, ou choisis Plus tard.`
              : group === 'refused'
                ? `Mise à jour ${v} refusée : elle n’est pas signée par Player X. Rien n’est installé.`
                : `Mise à jour ${v} interrompue. Nouvel essai dans 30 minutes.`
    )
  }, [group, v])
  return text
}
