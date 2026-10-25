// Carte de mise à jour, en bas à droite de la fenêtre (maquette « Braise » Mise-a-jour) : l'icône dans son anneau, la
// version et sa taille, « Quoi de neuf » tiré des notes de la release, puis la progression, les étapes de la vérification
// ou les boutons. Téléchargement, vérification de la signature, compte à rebours puis redémarrage ; refusée ou interrompue
// sinon. Pendant une partie, le téléchargement et la vérification deviennent une pastille immobile. Hauteur fixe dans
// toutes les phases d'une même version : rien ne se redimensionne.
// Les phases, la file des étapes et toutes les images clés sont dans update/useCardPhase.ts.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { UpdateNoticeProps } from '../contracts'
import type { UpdateMeta, UpdateState } from '@shared/types'
import { tier, useUpdateState } from '../update/session'
import { useCardPhase, play, type CardModel } from '../update/useCardPhase'
import { Reactor, type ReactorCenter } from '../update/Reactor'
import { TextSwap, useInSwapOut } from '../update/TextSwap'
import { KF } from '../update/keyframes'
import { fpShort, mo, pair, pct, speed } from '../update/format'
import { Icon } from './ui/Icon'
import './update.css'

export { useUpdateState } from '../update/session'

const NB = ' '
const ABOUT_TITLE = 'Voir les détails dans Paramètres › À propos'
/** Nouvel essai du processus principal après une erreur (updater.ts, RETRY_DELAY = 30 min). */
const RETRY_LABEL = `Nouvel essai dans 30${NB}min`

const INTERRUPTED_TITLE = {
  network: 'Connexion perdue',
  verify: 'Vérification impossible',
  other: 'Téléchargement interrompu',
  unsigned: 'Téléchargement interrompu'
} as const

const HOLD_SUB = {
  unfocused: 'en pause jusqu’à ton retour',
  hover: 'redémarrage en pause',
  game: 'en pause pendant ta partie',
  launch: 'en pause pendant le lancement',
  blocked: 'installe-la maintenant ou plus tard'
} as const

/** Taille et résumé annoncés par le processus principal, seulement pour la version affichée (jamais pour l'aperçu). */
function metaOf(s: UpdateState | null, m: CardModel): UpdateMeta {
  if (m.preview || !s || !('version' in s) || s.version !== m.version) return {}
  return { size: s.size, summary: s.summary?.trim() || undefined }
}

export function UpdateNotice({ onOpenAbout, inGame, launching }: UpdateNoticeProps): React.JSX.Element {
  const [state] = useUpdateState()
  const cardRef = useRef<HTMLDivElement>(null)
  const api = useCardPhase(state, { inGame, launching, cardRef })
  const m = api.model
  const announce = useAnnouncement(m)
  const mode = m.phase === 'hidden' ? 'none' : m.mini ? 'mini' : 'card'
  // Le processus principal répète taille et résumé sur chaque état de la version : la carte garde sa hauteur jusqu'au bout.
  const meta = metaOf(state, m)

  return (
    <div className="upd-dock" data-mode={mode} data-notes={mode === 'card' && meta.summary ? '' : undefined}>
      {/* Une seule zone annoncée, toujours montée, écrite seulement aux changements de phase (§14.1). */}
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
      {mode === 'mini' && <MiniPill m={m} onOpen={onOpenAbout} />}
      {mode === 'card' && <Card key={m.id} m={m} meta={meta} api={api} cardRef={cardRef} onOpenAbout={onOpenAbout} />}
    </div>
  )
}

interface CardProps {
  m: CardModel
  meta: UpdateMeta
  api: ReturnType<typeof useCardPhase>
  cardRef: React.RefObject<HTMLDivElement | null>
  onOpenAbout: () => void
}

function Card({ m, meta, api, cardRef, onOpenAbout }: CardProps): React.JSX.Element {
  const { phase, version: v, preview } = m
  const hasHit = !preview && (phase === 'download' || phase === 'verify')
  const ready = phase === 'lock' || phase === 'armed' || phase === 'installing'
  const busy = phase === 'installing' || m.leaving
  const rows = rowsFor(m, meta)
  const summary = preview ? undefined : meta.summary

  let center: ReactorCenter = 'none'
  if (phase === 'verify') center = 'shield'
  else if (phase === 'lock') center = 'check'
  else if (phase === 'armed') center = m.hold === 'unfocused' || m.hold === 'game' || m.hold === 'launch' ? 'pause' : m.hold === 'blocked' ? 'check' : 'sec'
  else if (phase === 'installing') center = 'check'
  else if (phase === 'interrupted') center = 'alert'
  else if (phase === 'refused') center = 'refused'

  // Anneau : le téléchargement le remplit, le compte à rebours le vide ; plein entre les deux.
  let ring = 100
  if (phase === 'download' || phase === 'interrupted') ring = m.percent
  else if (phase === 'armed') ring = (m.left / m.countdown) * 100

  // × en haut à droite : arrêter l'aperçu (sauf une fois prête, où « Plus tard » l'arrête), ou fermer une erreur.
  let close: React.ReactNode = null
  if (preview && !ready)
    close = (
      <button className="icon-btn upd-x" onClick={api.close} disabled={m.leaving} aria-label="Arrêter l’aperçu" title="Arrêter l’aperçu">
        <Icon name="x" size={14} />
      </button>
    )
  else if (!preview && (phase === 'refused' || phase === 'interrupted'))
    close = (
      <button className="icon-btn upd-x" onClick={api.close} disabled={m.leaving} aria-label="Fermer" title="Fermer">
        <Icon name="x" size={14} />
      </button>
    )

  let foot: React.ReactNode
  if (ready) {
    foot = (
      <div className="upd-actions">
        <button
          className="btn btn-primary btn-lg upd-go"
          onClick={api.restart}
          disabled={busy}
          title={preview ? undefined : `Player X redémarre et installe la ${v}`}
        >
          {/* Remplissage du compte à rebours : position statique ici, animée par useCardPhase quand c'est permis. */}
          <span className="upd-charge" aria-hidden="true" style={{ transform: `translateX(${(-(m.left / m.countdown) * 100).toFixed(2)}%)` }} />
          Installer maintenant
        </button>
        <button
          className="btn btn-lg upd-later"
          onClick={api.later}
          disabled={busy}
          title={preview ? 'Arrêter l’aperçu' : 'Elle s’installera quand tu fermeras Player X'}
        >
          Plus tard
        </button>
      </div>
    )
  } else if (phase === 'refused' || phase === 'interrupted') {
    foot = (
      <div className="upd-actions">
        <span className="upd-foot-note">{phase === 'refused' ? 'Non signée par Player X : rien n’est installé.' : `${RETRY_LABEL}.`}</span>
        <button className="btn btn-lg upd-more" onClick={onOpenAbout} disabled={m.leaving} title={ABOUT_TITLE}>
          Voir les détails
        </button>
      </div>
    )
  } else if (phase === 'download') foot = <Meter m={m} hidden={hasHit} />
  else foot = <Steps m={m} hidden={hasHit} />

  const cls = [
    'upd-card',
    summary ? 'has-notes' : '',
    m.critical ? 'is-critical' : '',
    m.locking ? 'is-locking' : '',
    m.hold === 'hover' ? 'is-held' : '',
    m.leaving ? 'is-leaving' : ''
  ]
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
      <div className="upd-head">
        <Reactor value={ring} center={center} seconds={m.left} />
        <TextSwap swapKey={m.textKey} hidden={hasHit}>
          <span className="upd-title" title={rows.title}>
            {rows.title}
          </span>
          <span className="upd-sub" title={rows.sub}>
            {rows.sub}
          </span>
        </TextSwap>
        {close}
      </div>
      {summary && (
        <p className="upd-notes" title={summary}>
          <b>Quoi de neuf{NB}:</b> {summary}
        </p>
      )}
      <div className="upd-foot">{foot}</div>
      {hasHit && <button className="upd-hit" onClick={onOpenAbout} aria-label={hitLabel} title={ABOUT_TITLE} />}
    </div>
  )
}

interface Rows {
  title: string
  sub: string
}

/** Les deux lignes de l'en-tête, phase par phase. Aperçu : aucune version, taille ni empreinte inventée. */
function rowsFor(m: CardModel, meta: UpdateMeta): Rows {
  const { phase, version: v, preview } = m
  const product = preview ? 'Exemple de mise à jour' : meta.size ? `Player X ${v} · ${mo(meta.size)}` : `Player X ${v}`
  // Pendant le verrouillage, les lignes de la vérification restent jusqu'au fondu (300 ms).
  const showVerify = phase === 'verify' || (phase === 'lock' && m.textKey === 'verify')

  if (phase === 'download') return { title: preview ? 'Aperçu de la mise à jour' : 'Mise à jour disponible', sub: product }
  if (showVerify) return { title: 'Vérification…', sub: product }

  if (phase === 'installing') return { title: 'Redémarrage…', sub: preview ? 'Redémarrage simulé' : `À tout de suite dans Player X ${v}` }
  if (phase === 'lock' || phase === 'armed') {
    let status: string
    if (m.hold) status = preview ? 'aperçu en pause' : HOLD_SUB[m.hold]
    else status = `${preview ? 'redémarrage simulé dans' : 'redémarrage dans'} ${m.left}${NB}s`
    return { title: preview ? 'Prête à installer' : 'Nouvelle mise à jour', sub: `${preview ? 'Exemple' : v} · ${status}` }
  }

  if (phase === 'refused') return { title: 'Mise à jour refusée', sub: product }
  // Interrompue
  return { title: INTERRUPTED_TITLE[m.errorCode ?? 'other'], sub: product }
}

/** Téléchargement : octets et vitesse réels, pourcentage, barre dont le dégradé reste épinglé. */
function Meter({ m, hidden }: { m: CardModel; hidden: boolean }): React.JSX.Element {
  let label = 'Téléchargement en arrière-plan'
  if (m.preview) label = 'Aucun téléchargement réel'
  else if (m.bytes) {
    // Figé : la vitesse disparaît (c'est une moyenne, elle mentirait).
    const tail = m.stalled ? 'en attente du réseau' : m.bytes.bps ? speed(m.bytes.bps) : ''
    label = tail ? `${pair(m.bytes.done, m.bytes.total)} · ${tail}` : pair(m.bytes.done, m.bytes.total)
  } else if (m.stalled) label = `${label} · en attente du réseau`
  return (
    <div className="upd-meter" aria-hidden={hidden || undefined}>
      <span className="upd-meter-row">
        <span className="upd-meter-label" title={label}>
          {label}
        </span>
        <span className="upd-meter-pct num">{pct(m.percent)}</span>
      </span>
      <span className="upd-bar">
        <span className="upd-bar-win">
          <span className="upd-bar-fill" />
        </span>
      </span>
    </div>
  )
}

const STEP_LABELS = ['Téléchargée', 'Signature vérifiée', 'Prête à installer'] as const

/** Vérification : les trois étapes de la maquette (la deuxième en cours), et le détail réel de l'étape. */
function Steps({ m, hidden }: { m: CardModel; hidden: boolean }): React.JSX.Element {
  const step = m.step ?? 'check'
  const n = step === 'signature' ? 1 : step === 'hash' ? 2 : 3
  let detail: React.ReactNode
  let detailTitle: string
  if (m.preview) {
    if (step === 'check' && m.fingerprint) {
      detailTitle = `Empreinte de ta version${NB}: ${fpShort(m.fingerprint)}`
      detail = <Fingerprint label={`Empreinte de ta version${NB}:`} hex={m.fingerprint} />
    } else detail = detailTitle = 'Aucune vérification réelle'
  } else if (step === 'signature') detail = detailTitle = 'Récupération de la signature…'
  else if (step === 'hash') detail = detailTitle = `Empreinte SHA-512 · ${pct(Math.floor(m.hashP * 100))}`
  else if (m.fingerprint) {
    detailTitle = `SHA-512 ${fpShort(m.fingerprint)}`
    detail = <Fingerprint label="SHA-512" hex={m.fingerprint} />
  } else detail = detailTitle = 'SHA-512'
  return (
    <div className="upd-steps" aria-hidden={hidden || undefined}>
      <ol className="upd-steps-row">
        {STEP_LABELS.map((label, i) => (
          <li key={label} data-s={i === 0 ? 'done' : i === 1 ? 'now' : 'todo'}>
            <span className="upd-step-mark">{i === 0 && <Icon name="check" size={10} />}</span>
            {label}
          </li>
        ))}
      </ol>
      <span className="upd-steps-detail" title={detailTitle}>
        <span className="upd-steps-n num">{n}/3</span>
        {detail}
      </span>
    </div>
  )
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
  const ready = m.phase === 'armed' && m.hold === 'game' ? 'ready-game' : m.phase === 'armed' && m.hold === 'launch' ? 'ready-launch' : 'ready'
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
            ? `Player X ${v} est prête et signée. Installe-la maintenant ou plus tard.`
            : group === 'ready-launch'
              ? `Player X ${v} est prête et signée. Installe-la maintenant ou plus tard.`
            : group === 'ready'
              ? `Player X ${v} est prête et signée. Installe-la maintenant ou plus tard.`
              : group === 'refused'
                ? `Mise à jour ${v} refusée : elle n’est pas signée par Player X. Rien n’est installé.`
                : `Mise à jour ${v} interrompue. Nouvel essai dans 30 minutes.`
    )
  }, [group, v])
  return text
}
