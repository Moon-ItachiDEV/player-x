// Fenêtre « Quoi de neuf » (maquette « Braise » Changelog) : s'ouvre une fois au premier lancement d'une nouvelle version
// (après une mise à jour). À gauche, les versions dont les notes sont dans l'appli ; à droite, les notes de celle choisie.
// Les notes sont celles des releases GitHub (docs/release-notes/<version>.md), intégrées à l'appli au build : rien à télécharger.
// Après une mise à jour, elle attend la fin du retour (update/stage) et affiche les vrais chiffres de l'installation.
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import type { LastUpdate } from '@shared/types'
import { useEscape } from './ui/Overlay'
import { BrandMark } from './ui/Brand'
import { Icon } from './ui/Icon'
import { anim, busyTitle, gameRunning, isRealUpdateBusy, lastUpdate, PREVIOUS_VERSION, thisBootUpdate, useStore, useUpdateState, VERSION } from '../update/session'
import { revealDone } from '../update/stage'
import { preview, PREVIEW_INTRO, startPreview, stopPreview } from '../update/preview'
import { duration } from '../update/format'
import { KF } from '../update/keyframes'
import { VersionRoll } from '../update/VersionRoll'
import './whatsnew.css'
import { useLeave } from '../motion'

const NOTES = import.meta.glob('../../../../docs/release-notes/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const SEEN_KEY = 'pg.lastVersion'
const SETUP_KEY = 'pg.setup'
/** Toutes les releases (même adresse que Paramètres › À propos). */
const RELEASES_URL = 'https://github.com/Moon-ItachiDEV/player-x/releases'
/** Sections propres à la page GitHub (téléchargement), sans intérêt une fois l'appli installée. */
const SKIP = /^(installer|télécharger)/i

/** Un élément des notes : son nom en gras quand il en a un (« **Canal Bêta** : … »), puis le texte. */
interface Item {
  title?: string
  text: string
}

interface Section {
  title: string
  items: Item[]
}

/** « **Nom** : texte » ou « **Nom.** Texte » : le nom à part. Un gras pris dans la phrase reste dans le texte. */
function splitItem(line: string): Item {
  const m = /^\*\*([^*]+)\*\*\s*(:?)\s*(.*)$/.exec(line)
  if (!m || !m[3] || (!m[2] && !/[.!?]$/.test(m[1]))) return { text: line }
  const text = m[3].replace(/^\p{Ll}/u, (c) => c.toUpperCase())
  return { title: m[1].replace(/\s*[.:]$/, ''), text }
}

function notesFor(version: string): Section[] {
  const raw = Object.entries(NOTES).find(([path]) => path.endsWith(`/${version}.md`))?.[1]
  if (!raw) return []
  const sections: Section[] = []
  for (const line of raw.split(/\r?\n/)) {
    const h = /^#{1,3}\s+(.+)/.exec(line)
    const last = sections[sections.length - 1]
    if (h) sections.push({ title: h[1].trim(), items: [] })
    else if (/^\s*[-*]\s+/.test(line) && last) last.items.push(splitItem(line.replace(/^\s*[-*]\s+/, '')))
    // Un paragraphe (« Tu la reçois parce que… ») est un élément sans nom.
    else if (line.trim() && last) last.items.push({ text: line.trim() })
  }
  return sections.filter((s) => s.items.length && !SKIP.test(s.title))
}

// ---------- versions ----------

type Semver = { n: [number, number, number]; pre: Array<string | number> | null }

function semver(v: string): Semver | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v)
  if (!m) return null
  return { n: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split('.').map((p) => (/^\d+$/.test(p) ? +p : p)) : null }
}

/** Ordre semver : 0.9.0-beta.2 < 0.9.0-beta.10 < 0.9.0. */
function compare(a: Semver, b: Semver): number {
  for (let i = 0; i < 3; i++) if (a.n[i] !== b.n[i]) return a.n[i] - b.n[i]
  if (!a.pre || !b.pre) return (a.pre ? -1 : 0) - (b.pre ? -1 : 0)
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i]
    const y = b.pre[i]
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1
    if (x === y) continue
    if (typeof x === 'number' && typeof y === 'number') return x - y
    if (typeof x === 'number') return -1
    if (typeof y === 'number') return 1
    return x < y ? -1 : 1
  }
  return 0
}

interface Release {
  version: string
  sections: Section[]
  /** Les noms des nouveautés, pour la liste des versions. */
  tag: string
  beta: boolean
}

/** Texte brut d'une ligne des notes (sans ** ni `). */
const plain = (t: string): string => t.replace(/\*\*|`/g, '')

/**
 * Versions dont les notes sont dans l'appli, de la plus récente à la plus ancienne, jusqu'à celle qui tourne.
 * Les versions de test n'apparaissent que pour qui est sur la même version de test (canal Bêta).
 */
function releasesUpTo(current: string): Release[] {
  const cur = semver(current)
  if (!cur) return []
  const list: Array<Release & { sv: Semver }> = []
  for (const path of Object.keys(NOTES)) {
    const version = /([^/]+)\.md$/.exec(path)?.[1] ?? ''
    const sv = semver(version)
    if (!sv || compare(sv, cur) > 0) continue
    if (sv.pre && !(cur.pre && sv.n.every((x, i) => x === cur.n[i]))) continue
    const sections = notesFor(version)
    if (!sections.length) continue
    const named = sections.find((s) => s.items.some((it) => it.title)) ?? sections[0]
    const names = named.items.map((it) => it.title).filter((t): t is string => !!t)
    const tag = names.length ? names.map(plain).join(' · ') : plain(named.items[0].text)
    list.push({ version, sections, tag, beta: !!sv.pre, sv })
  }
  return list.sort((a, b) => compare(b.sv, a.sv)).map(({ sv: _sv, ...r }) => r)
}

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
  const [releases] = useState(() => releasesUpTo(version))
  const [open, setOpen] = useState(() => shouldOpen(version) && releases.some((r) => r.version === version))
  const [selected, setSelected] = useState(version)
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
  const shown = (inPreview && releases.length > 0) || (open && revealed && last.loaded)

  // Fermeture : sortie animée (motion.ts useLeave), puis la fenêtre disparaît.
  const scrim = useRef<HTMLDivElement>(null)
  const close = useLeave(scrim, () => {
    setOpen(false)
    if (inPreview) stopPreview()
  })
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

  // Une autre version : les notes repartent du haut.
  const notesRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (notesRef.current) notesRef.current.scrollTop = 0
  }, [selected])

  if (!shown) return null

  // Aperçu : seulement un relevé enregistré pour la version qui tourne. Sinon : l'installation de ce lancement.
  const stored = last.value && last.value.to === version ? last.value : null
  const boot = thisBootUpdate()
  const from = inPreview ? (stored?.from ?? null) : (boot?.from ?? PREVIOUS_VERSION)
  const chips = chipsFor(from, inPreview ? stored : boot)
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
            <p id="wn-lead" className="wn-lead">
              Tu es passé en{' '}
              <b>
                Player X <VersionRoll value={version} base={120} />
              </b>
              . Voici ce qui change.
            </p>
            {chips.length > 0 && (
              <div className="wn-chips">
                {chips.map((c) => (
                  <span key={c.key} className="wn-chip" title={c.title}>
                    {c.node}
                  </span>
                ))}
              </div>
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
                  {isNew(r.version) && <span className="wn-badge">Nouveau</span>}
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
            {version === PREVIEW_INTRO && !inPreview && (
              <button
                className="btn btn-ghost btn-lg"
                disabled={previewBlocked}
                title={
                  isRealUpdateBusy(upd)
                    ? 'Indisponible pendant une vraie mise à jour'
                    : inGame
                      ? busyTitle()
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
            <button className="btn btn-primary btn-lg wn-go" onClick={close} autoFocus>
              C'est parti
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
