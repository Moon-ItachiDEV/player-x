// Fenêtre « Quoi de neuf » (maquette « Braise » Changelog) : s'ouvre une fois au premier lancement d'une nouvelle version
// (après une mise à jour). À gauche, les versions dont les notes sont dans l'appli ; à droite, les notes de celle choisie.
// Les notes sont celles des releases GitHub (docs/release-notes/<version>.md), intégrées à l'appli au build : rien à télécharger.
// Après une mise à jour, elle attend la fin du retour (update/stage). Plus de pastilles (versions, empreinte, durées) :
// jugées inutiles par Breezydev (0.9.4-beta.6), la phrase d'accueil dit déjà la version.
// Aussi à la demande : Paramètres › À propos › Quoi de neuf (openWhatsNew). Lecture et dédoublonnage : @shared/releaseNotes.
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { compare, releasesUpTo, semver } from '@shared/releaseNotes'
import { useEscape } from './ui/Overlay'
import { BrandMark } from './ui/Brand'
import { Icon } from './ui/Icon'
import { anim, createStore, lastUpdate, PREVIOUS_VERSION, thisBootUpdate, useStore, VERSION } from '../update/session'
import { revealDone } from '../update/stage'
import { preview, stopPreview } from '../update/preview'
import { KF } from '../update/keyframes'
import { VersionRoll } from '../update/VersionRoll'
import './whatsnew.css'
import { useLeave } from '../motion'

const NOTES = import.meta.glob('../../../../docs/release-notes/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const SEEN_KEY = 'pg.lastVersion'
const SETUP_KEY = 'pg.setup'
/** Toutes les releases (même adresse que Paramètres › À propos). */
const RELEASES_URL = 'https://github.com/Moon-ItachiDEV/player-x/releases'
/** Couleur du point d'une section : nouveautés (braise), correctifs (vert), le reste (lavande). */
function sectionKind(title: string): 'new' | 'fix' | 'info' {
  if (/nouveaut|changement/i.test(title)) return 'new'
  if (/correct/i.test(title)) return 'fix'
  return 'info'
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

/** Ouverte à la demande (Paramètres › À propos › Quoi de neuf), hors mise à jour. */
const asked = createStore(false)
export const openWhatsNew = (): void => asked.set(true)

export function WhatsNew(): React.JSX.Element | null {
  const version = VERSION
  const [releases] = useState(() => releasesUpTo(NOTES, version))
  const [open, setOpen] = useState(() => shouldOpen(version) && releases.some((r) => r.version === version))
  const [selected, setSelected] = useState(version)
  // Après un retour animé, la fenêtre s'ouvre quand le logo se pose ; sinon dès que la dernière mise à jour est connue (≤ 400 ms).
  const revealed = useStore(revealDone)
  const last = useStore(lastUpdate)
  const pv = useStore(preview)
  const manual = useStore(asked) && !open
  // Aperçu : la fin de la séquence rejouée ouvre cette fenêtre, et la fermer termine l'aperçu.
  const inPreview = pv.active && pv.part === 'whatsnew'
  const shown = (inPreview && releases.length > 0) || (open && revealed && last.loaded) || (manual && releases.length > 0)

  // Fermeture : sortie animée (motion.ts useLeave), puis la fenêtre disparaît.
  const scrim = useRef<HTMLDivElement>(null)
  const close = useLeave(scrim, () => {
    setOpen(false)
    asked.set(false)
    if (inPreview) stopPreview()
  })
  useEscape(shown, close)

  const headRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const head = headRef.current
    if (!shown || !head) return
    // Effets riches seulement : un reflet traverse l'en-tête. Sinon tout est déjà là.
    const played = [anim(head.querySelector('.wn-sheen'), KF.sheen.frames, { ...KF.sheen.opts, delay: 300 })]
    return () => played.forEach((a) => a?.cancel())
  }, [shown])

  // Une autre version : les notes repartent du haut.
  const notesRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (notesRef.current) notesRef.current.scrollTop = 0
  }, [selected])

  if (!shown) return null

  // Version d'avant, pour « Nouveau ». Aperçu : seulement un relevé enregistré pour la version qui tourne ; sinon l'installation de ce lancement.
  const stored = last.value && last.value.to === version ? last.value : null
  const boot = thisBootUpdate()
  // Ouverte à la demande : pas d'installation à raconter, la version qui tourne est marquée « Installée ».
  const from = manual ? null : inPreview ? (stored?.from ?? null) : (boot?.from ?? PREVIOUS_VERSION)

  // « Nouveau » : chaque version arrivée depuis celle d'avant (seulement celle qui tourne si on ne la connaît pas).
  const fromSv = from ? semver(from) : null
  const isNew = (v: string): boolean => {
    const sv = semver(v)
    return v === version || (!!sv && !!fromSv && compare(sv, fromSv) > 0)
  }
  const cur = releases.find((r) => r.version === selected) ?? releases[0]

  /** Flèches haut et bas dans la liste des versions. */
  const onNavKey = (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const i = releases.findIndex((r) => r.version === cur.version)
    const next = releases[Math.max(0, Math.min(releases.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]
    if (!next || next === cur) return
    e.preventDefault()
    setSelected(next.version)
    e.currentTarget.querySelector<HTMLElement>(`[data-v="${CSS.escape(next.version)}"]`)?.focus()
  }

  return (
    <div ref={scrim} className="dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog wn" role="dialog" aria-modal="true" aria-labelledby="wn-title" aria-describedby="wn-lead">
        <header className="wn-head" ref={headRef}>
          <span className="wn-sheen" aria-hidden="true" />
          <BrandMark height={56} />
          <div className="wn-head-text">
            <h2 id="wn-title" className="wn-title">
              Quoi de neuf
              {inPreview && <span className="wn-tag">Aperçu</span>}
            </h2>
            {manual ? (
              <p id="wn-lead" className="wn-lead">
                Tu as{' '}
                <b>
                  Player X <span className="num">{version}</span>
                </b>
                . Voici ce qui a changé, version par version.
              </p>
            ) : (
              <p id="wn-lead" className="wn-lead">
                Tu es passé en{' '}
                <b>
                  Player X <VersionRoll value={version} base={120} />
                </b>
                . Voici ce qui change.
              </p>
            )}
          </div>
          <button className="icon-btn wn-close" onClick={close} aria-label="Fermer" title="Fermer">
            <Icon name="x" size={14} />
          </button>
        </header>
        <div className="wn-main">
          <nav className="wn-versions" aria-label="Versions" onKeyDown={onNavKey}>
            {releases.map((r) => (
              <button
                key={r.version}
                type="button"
                className="wn-ver"
                data-v={r.version}
                aria-pressed={r.version === cur.version}
                tabIndex={r.version === cur.version ? 0 : -1}
                onClick={() => setSelected(r.version)}
              >
                <span className="wn-ver-row">
                  <span className="wn-ver-num num">{r.version}</span>
                  {isNew(r.version) && <span className="wn-badge">{manual ? 'Installée' : 'Nouveau'}</span>}
                </span>
                <span className="wn-ver-tag" title={r.tag}>
                  {r.tag}
                </span>
              </button>
            ))}
          </nav>
          <div className="wn-notes" ref={notesRef} tabIndex={-1}>
            <div className="wn-notes-head" key={`h-${cur.version}`}>
              <h3 className="wn-notes-title num">{cur.version}</h3>
              <span className="wn-notes-meta">{cur.beta ? 'Version de test · Bêta' : 'Stable'}</span>
              <button
                className="btn btn-ghost btn-sm wn-gh"
                onClick={() => window.launcher.openExternal(`${RELEASES_URL}/tag/v${cur.version}`)}
                title={`Ouvrir la page de la ${cur.version} sur GitHub`}
              >
                Voir sur GitHub
                <Icon name="external-link" size={13} />
              </button>
            </div>
            {cur.sections.map((s, si) => (
              <section key={`${cur.version}-${si}`} className="wn-section">
                <h4 className="wn-section-title" data-kind={sectionKind(s.title)}>
                  {s.title}
                </h4>
                <ul>
                  {s.items.map((item, i) => (
                    <li key={i} className="wn-item">
                      {item.title && <span className="wn-item-title">{inline(item.title)}</span>}
                      <span className="wn-item-text">{inline(item.text)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
        <div className="wn-foot">
          <button className="wn-all" onClick={() => window.launcher.openExternal(RELEASES_URL)}>
            Toutes les versions sur GitHub
          </button>
          <div className="wn-foot-actions">
            <button className="btn btn-primary btn-lg wn-go" onClick={close} autoFocus>
              {manual ? 'Fermer' : "C'est parti"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
