// Notes de version de « Quoi de neuf » (WhatsNew.tsx) : docs/release-notes/<version>.md, intégrées à l'appli au build.
// Sans dépendance, pour les tests (releaseNotes.test.ts). Rien n'est inventé : seulement le texte des fichiers.
//
// Zéro doublon (demande de Breezydev, 0.9.4-beta.6) :
// - les sections propres à la page GitHub (Installer, Télécharger) et l'encadré répété de chaque version de test
//   (« Version de test (canal Bêta) ») ne s'affichent pas : l'en-tête des notes dit déjà « Version de test · Bêta » ;
// - une phrase déjà dite dans une version plus ancienne n'est gardée que là, la première fois qu'elle apparaît.

/** Un élément des notes : son nom en gras quand il en a un (« **Canal Bêta** : … »), puis le texte. */
export interface NoteItem {
  title?: string
  text: string
}

export interface NoteSection {
  title: string
  items: NoteItem[]
}

export interface Release {
  version: string
  sections: NoteSection[]
  /** Les noms des nouveautés, pour la liste des versions. */
  tag: string
  beta: boolean
}

/** Sections sans intérêt dans l'appli : téléchargement (page GitHub) et encadré répété des versions de test. */
const SKIP = /^(installer|télécharger|version de test)/i

/** « **Nom** : texte » ou « **Nom.** Texte » : le nom à part. Un gras pris dans la phrase reste dans le texte. */
function splitItem(line: string): NoteItem {
  const m = /^\*\*([^*]+)\*\*\s*(:?)\s*(.*)$/.exec(line)
  if (!m || !m[3] || (!m[2] && !/[.!?]$/.test(m[1]))) return { text: line }
  const text = m[3].replace(/^\p{Ll}/u, (c) => c.toUpperCase())
  return { title: m[1].replace(/\s*[.:]$/, ''), text }
}

/** Sections d'un fichier de notes, sans celles de SKIP ni les sections vides. */
export function parseNotes(raw: string): NoteSection[] {
  const sections: NoteSection[] = []
  for (const line of raw.split(/\r?\n/)) {
    const h = /^#{1,3}\s+(.+)/.exec(line)
    const last = sections[sections.length - 1]
    if (h) sections.push({ title: h[1].trim(), items: [] })
    else if (/^\s*[-*]\s+/.test(line) && last) last.items.push(splitItem(line.replace(/^\s*[-*]\s+/, '')))
    // Un paragraphe est un élément sans nom.
    else if (line.trim() && last) last.items.push({ text: line.trim() })
  }
  return sections.filter((s) => s.items.length && !SKIP.test(s.title))
}

// ---------- versions ----------

type Semver = { n: [number, number, number]; pre: Array<string | number> | null }

export function semver(v: string): Semver | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v)
  if (!m) return null
  return { n: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split('.').map((p) => (/^\d+$/.test(p) ? +p : p)) : null }
}

/** Ordre semver : 0.9.0-beta.2 < 0.9.0-beta.10 < 0.9.0. */
export function compare(a: Semver, b: Semver): number {
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

/** Texte brut d'une ligne des notes (sans ** ni `). */
export const plain = (t: string): string => t.replace(/\*\*|`/g, '')

/** Clé de comparaison d'un élément : sans mise en forme, casse, espaces ni ponctuation finale. */
function itemKey(it: NoteItem): string {
  return plain(`${it.title ?? ''} ${it.text}`)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\s.!?:;,…]+$/, '')
    .trim()
}

/**
 * Versions dont les notes sont dans l'appli, de la plus récente à la plus ancienne, jusqu'à celle qui tourne.
 * Les versions de test n'apparaissent que pour qui est sur une version de test de la même version (canal Bêta).
 * `notes` : chemin ou nom de fichier (« …/0.9.3.md ») → contenu.
 */
export function releasesUpTo(notes: Record<string, string>, current: string): Release[] {
  const cur = semver(current)
  if (!cur) return []
  const found: Array<{ version: string; sv: Semver; sections: NoteSection[] }> = []
  for (const [path, raw] of Object.entries(notes)) {
    const version = /([^/\\]+)\.md$/.exec(path)?.[1] ?? ''
    const sv = semver(version)
    if (!sv || compare(sv, cur) > 0) continue
    if (sv.pre && !(cur.pre && sv.n.every((x, i) => x === cur.n[i]))) continue
    found.push({ version, sv, sections: parseNotes(raw) })
  }
  // De la plus ancienne à la plus récente : une phrase reste là où elle est apparue la première fois.
  found.sort((a, b) => compare(a.sv, b.sv))
  const seen = new Set<string>()
  const list: Release[] = []
  for (const { version, sv, sections } of found) {
    const kept = sections
      .map((s) => ({
        title: s.title,
        items: s.items.filter((it) => {
          const key = itemKey(it)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      }))
      .filter((s) => s.items.length)
    if (!kept.length) continue
    const named = kept.find((s) => s.items.some((it) => it.title)) ?? kept[0]
    const names = named.items.map((it) => it.title).filter((t): t is string => !!t)
    const tag = names.length ? names.map(plain).join(' · ') : plain(named.items[0].text)
    list.push({ version, sections: kept, tag, beta: !!sv.pre })
  }
  return list.reverse()
}
