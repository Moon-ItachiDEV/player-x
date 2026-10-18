// Fenêtre « Nouveautés » : s'ouvre une fois au premier lancement d'une nouvelle version (après une mise à jour).
// Les notes sont celles de la release GitHub (docs/release-notes/<version>.md), intégrées à l'appli au build : rien à télécharger.
import { Fragment, useState } from 'react'
import { useEscape } from './ui/Overlay'
import { BrandMark } from './ui/Brand'
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

/** À ouvrir si la version a changé depuis le dernier lancement. Pas au tout premier lancement (installation neuve). */
function shouldOpen(version: string): boolean {
  const seen = read(SEEN_KEY)
  // Les versions d'avant cette fenêtre n'enregistraient rien : l'écran de démarrage déjà passé prouve une mise à jour.
  const updated = seen ? seen !== version : read(SETUP_KEY) !== null
  try {
    localStorage.setItem(SEEN_KEY, version)
  } catch {
    /* stockage indisponible : la fenêtre ne s'ouvrira pas */
  }
  return updated
}

export function WhatsNew(): React.JSX.Element | null {
  const version = window.launcher.version
  const [sections] = useState(() => notesFor(version))
  const [open, setOpen] = useState(() => shouldOpen(version) && sections.length > 0)
  useEscape(open, () => setOpen(false))
  if (!open) return null

  return (
    <div className="dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="dialog wn" role="dialog" aria-modal="true" aria-labelledby="wn-title">
        <header className="wn-head">
          <div className="wn-glow" aria-hidden="true" />
          <BrandMark height={22} />
          <span className="overline wn-kicker">Mise à jour installée</span>
          <h2 id="wn-title" className="wn-title">
            Quoi de neuf dans la <span className="num">{version}</span>
          </h2>
        </header>
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
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={() => window.launcher.openExternal(`https://github.com/Moon-ItachiDEV/player-x/releases/tag/v${version}`)}>
            Voir sur GitHub
          </button>
          <button className="btn btn-primary" onClick={() => setOpen(false)} autoFocus>
            C'est parti
          </button>
        </div>
      </div>
    </div>
  )
}
