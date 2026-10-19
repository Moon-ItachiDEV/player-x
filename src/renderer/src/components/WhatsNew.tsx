// Fenêtre « Nouveautés » : s'ouvre une fois au premier lancement d'une nouvelle version (après une mise à jour).
// Les notes sont celles de la release GitHub (docs/release-notes/<version>.md), intégrées à l'appli au build : rien à télécharger.
// Après une mise à jour, elle attend la fin du retour (update/stage) et affiche les vrais chiffres de l'installation.
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import type { LastUpdate } from '@shared/types'
import { useEscape } from './ui/Overlay'
import { BrandMark } from './ui/Brand'
import { Icon } from './ui/Icon'
import { anim, gameRunning, isRealUpdateBusy, lastUpdate, PREVIOUS_VERSION, thisBootUpdate, useStore, useUpdateState, VERSION } from '../update/session'
import { revealDone } from '../update/stage'
import { preview, PREVIEW_INTRO, startPreview, stopPreview } from '../update/preview'
import { duration } from '../update/format'
import { KF } from '../update/keyframes'
import { VersionRoll } from '../update/VersionRoll'
import './whatsnew.css'

const NOTES = import.meta.glob('../../../../docs/release-notes/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const SEEN_KEY = 'pg.lastVersion'
const SETUP_KEY = 'pg.setup'
/** Sections propres à la page GitHub (téléchargement), sans intérêt une fois l'appli installée. */
const SKIP = /^(installer|télécharger)/i

interface Section {
  title: string
  items: string[]
}

function notesFor(version: string): Section[] {
  const raw = Object.entries(NOTES).find(([path]) => path.endsWith(`/${version}.md`))?.[1]
  if (!raw) return []
  const sections: Section[] = []
  for (const line of raw.split(/\r?\n/)) {
    const h = /^#{1,3}\s+(.+)/.exec(line)
    if (h) sections.push({ title: h[1].trim(), items: [] })
    else if (/^\s*[-*]\s+/.test(line) && sections.length) sections[sections.length - 1].items.push(line.replace(/^\s*[-*]\s+/, ''))
  }
  return sections.filter((s) => s.items.length && !SKIP.test(s.title))
}

/** **gras** et `code`, le reste en texte. */
function inline(text: string): React.ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .map((part, i) =>
      part.startsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : part.startsWith('`') ? (
        <code key={i}>{part.slice(1, -1)}</code>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      )
    )
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Écran de démarrage déjà passé AVANT ce lancement : lu au chargement de l'appli, avant que l'écran de démarrage
 * d'une installation neuve ne l'enregistre (sinon la fenêtre s'ouvrirait juste après ce premier écran).
 */
const SETUP_BEFORE_LAUNCH = read(SETUP_KEY) !== null

/** À ouvrir si la version a changé depuis le dernier lancement. Pas au tout premier lancement (installation neuve). */
function shouldOpen(version: string): boolean {
  const seen = read(SEEN_KEY)
  // Les versions d'avant cette fenêtre n'enregistraient rien : l'écran de démarrage déjà passé prouve une mise à jour.
  const updated = seen ? seen !== version : SETUP_BEFORE_LAUNCH
  try {
    localStorage.setItem(SEEN_KEY, version)
  } catch {
    /* stockage indisponible : la fenêtre ne s'ouvrira pas */
  }
  return updated
}

interface Chip {
  key: string
  node: React.ReactNode
  title?: string
}

/** Pastilles de l'installation, chacune seulement si sa valeur est connue (rien d'inventé). */
function chipsFor(from: string | null, u: LastUpdate | null): Chip[] {
  const chips: Chip[] = []
  if (from && from !== VERSION) {
    chips.push({
      key: 'from',
      node: (
        <>
          <span className="num">{from}</span> → <span className="num">{VERSION}</span>
        </>
      )
    })
  }
  // Une empreinte n'est enregistrée qu'après une signature valide.
  if (u?.fingerprint) {
    chips.push({
      key: 'fp',
      title: u.fingerprint,
      node: (
        <>
          <Icon name="shield-check" size={12} />
          Signée · <span className="wn-mono">{u.fingerprint.slice(0, 8)}</span>
        </>
      )
    })
  }
  if (u?.downloadMs) chips.push({ key: 'dl', node: <>Téléchargée en {duration(u.downloadMs)}</> })
  if (u?.backMs) chips.push({ key: 'back', node: <>De retour en {duration(u.backMs)}</> })
  return chips
}

export function WhatsNew(): React.JSX.Element | null {
  const version = VERSION
  const [sections] = useState(() => notesFor(version))
  const [open, setOpen] = useState(() => shouldOpen(version) && sections.length > 0)
  // Après un retour animé, la fenêtre s'ouvre quand le logo se pose ; sinon dès que la dernière mise à jour est connue (≤ 400 ms).
  const revealed = useStore(revealDone)
  const last = useStore(lastUpdate)
  const pv = useStore(preview)
  // « Voir l'aperçu » n'a rien à rejouer pendant une vraie mise à jour ou une partie (startPreview refuserait).
  const [upd] = useUpdateState()
  const inGame = useStore(gameRunning)
  const previewBlocked = isRealUpdateBusy(upd) || inGame
  // Aperçu : la fin de la séquence rejouée ouvre cette fenêtre, et la fermer termine l'aperçu.
  const inPreview = pv.active && pv.part === 'whatsnew'
  const shown = inPreview || (open && revealed && last.loaded)

  const close = (): void => {
    setOpen(false)
    if (inPreview) stopPreview()
  }
  useEscape(shown, close)

  const headRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const head = headRef.current
    if (!shown || !head) return
    // Effets riches seulement : un reflet traverse l'en-tête, les pastilles montent une à une. Sinon tout est déjà là.
    const played = [anim(head.querySelector('.wn-sheen'), KF.sheen.frames, { ...KF.sheen.opts, delay: 300 })]
    head.querySelectorAll('.wn-chip').forEach((el, k) => played.push(anim(el, KF.chip(k, 300).frames, KF.chip(k, 300).opts)))
    return () => played.forEach((a) => a?.cancel())
  }, [shown])

  if (!shown) return null

  // Aperçu : seulement un relevé enregistré pour la version qui tourne. Sinon : l'installation de ce lancement.
  const stored = last.value && last.value.to === version ? last.value : null
  const boot = thisBootUpdate()
  const chips = inPreview ? chipsFor(stored?.from ?? null, stored) : chipsFor(boot?.from ?? PREVIOUS_VERSION, boot)

  return (
    <div className="dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog wn" role="dialog" aria-modal="true" aria-labelledby="wn-title">
        <header className="wn-head" ref={headRef}>
          <div className="wn-glow" aria-hidden="true" />
          <span className="wn-sheen" aria-hidden="true" />
          <BrandMark height={22} />
          <span className="overline wn-kicker">{inPreview ? 'Aperçu · Mise à jour installée' : 'Mise à jour installée'}</span>
          <h2 id="wn-title" className="wn-title">
            Quoi de neuf dans la <VersionRoll value={version} base={120} />
          </h2>
          {chips.length > 0 && (
            <div className="wn-chips">
              {chips.map((c) => (
                <span key={c.key} className="wn-chip" title={c.title}>
                  {c.node}
                </span>
              ))}
            </div>
          )}
        </header>
        {sections.length > 0 && (
          <div className="wn-body">
            {sections.map((s) => (
              <section key={s.title} className="wn-section">
                <h3 className="overline">{s.title}</h3>
                <ul>
                  {s.items.map((item, i) => (
                    <li key={i}>{inline(item)}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <div className="dialog-actions">
          {version === PREVIEW_INTRO && !inPreview && (
            <button
              className="btn btn-ghost"
              disabled={previewBlocked}
              title={
                isRealUpdateBusy(upd)
                  ? 'Indisponible pendant une vraie mise à jour'
                  : inGame
                    ? 'Indisponible pendant une partie'
                    : "Rejoue l'animation de mise à jour, sans rien installer"
              }
              onClick={() => {
                setOpen(false)
                void startPreview({ from: 'whatsnew' })
              }}
            >
              Voir l'aperçu
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => window.launcher.openExternal(`https://github.com/Moon-ItachiDEV/player-x/releases/tag/v${version}`)}>
            Voir sur GitHub
          </button>
          <button className="btn btn-primary" onClick={close} autoFocus>
            C'est parti
          </button>
        </div>
      </div>
    </div>
  )
}
