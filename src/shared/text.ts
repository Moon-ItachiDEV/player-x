// Petits utilitaires de texte partagés entre le processus principal et l'interface.

/** Nom affichable sans ™/®/© ni suffixe d'édition. */
export function cleanName(name: string): string {
  return name
    .replace(/[™®©]/g, '')
    .replace(/\s*[-–:]?\s*(Standard|Deluxe|Ultimate|Gold|Premium|Complete|Definitive|Game of the Year)\s+Edition$/i, '')
    .trim()
}

/** Clé de comparaison : minuscules, sans accents ni ponctuation. Sert à rapprocher un ami en jeu d'un jeu de la bibliothèque. */
export function norm(name: string): string {
  return cleanName(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Teinte stable (0-359) dérivée d'un nom, pour les jaquettes générées. */
export function hue(name: string): number {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

/** « il y a 2 h », « à l'instant »… (sans majuscule, pour s'insérer dans une phrase). */
export function timeAgo(ts: number, now = Date.now()): string {
  const min = Math.round((now - ts) / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  if (min < 1440) return `il y a ${Math.round(min / 60)} h`
  const days = Math.round(min / 1440)
  if (days < 30) return `il y a ${days} j`
  const months = Math.round(days / 30)
  return months < 12 ? `il y a ${months} mois` : `il y a ${Math.round(months / 12)} an${months >= 24 ? 's' : ''}`
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

/** « 17 oct. 2026, 21:14 » */
export function formatDate(ts: number): string {
  return dateFmt.format(ts)
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** « 1 jeu », « 3 jeux » */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`
}
