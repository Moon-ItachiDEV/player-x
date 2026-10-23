// Résumé des notes d'une mise à jour, pour la carte de mise à jour (« Quoi de neuf : … »).
// electron-updater donne les notes de la release GitHub (docs/release-notes/<version>.md, rendu en HTML par GitHub) :
// on n'en garde que du texte brut, jamais du HTML. Sans dépendance, pour les tests (updateNotes.test.ts).

/** Au plus ce nombre d'éléments, et ce nombre de caractères. */
const MAX_ITEMS = 4
const MAX_CHARS = 200

type Notes = string | ReadonlyArray<{ version: string; note: string | null }> | null | undefined

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Texte brut d'un fragment HTML : balises retirées, entités courantes décodées, espaces resserrés. */
export function htmlText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''
      }
      return ENTITIES[e.toLowerCase()] ?? m
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** Nom d'une nouveauté : son début en gras (« **Canal Bêta** : … »), sinon sa première phrase. */
function itemName(li: string): string {
  const bold = /^\s*(?:<p>\s*)?<strong>([\s\S]*?)<\/strong>/i.exec(li)
  const text = htmlText(bold ? bold[1] : li.split(/<br\s*\/?>/i)[0])
  const name = bold ? text : (/^(.+?)(?: : |[.!?](?:\s|$))/.exec(text)?.[1] ?? text)
  return name.replace(/\s*[:.]\s*$/, '').trim()
}

/**
 * « Canal Bêta · Bilan de fin de match CS2 » : les noms des éléments de la première liste des notes.
 * `undefined` si les notes sont absentes ou sans liste (rien n'est inventé).
 */
export function summarizeReleaseNotes(notes: Notes, version?: string): string | undefined {
  let html: string | null | undefined
  if (typeof notes === 'string') html = notes
  else if (Array.isArray(notes)) html = (notes.find((n) => n.version === version) ?? notes[0])?.note
  if (!html) return undefined
  const list = /<ul[^>]*>([\s\S]*?)<\/ul>/i.exec(html)?.[1]
  if (!list) return undefined
  const names = [...list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => itemName(m[1])).filter(Boolean)
  if (!names.length) return undefined
  let out = names.slice(0, MAX_ITEMS).join(' · ')
  if (out.length > MAX_CHARS) out = `${out.slice(0, MAX_CHARS - 1).replace(/[\s·]+\S*$/, '')}…`
  return out
}
