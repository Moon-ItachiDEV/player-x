// Tests du résumé des notes (npm run test:update) : lanceur intégré à Node, aucune dépendance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// Node exige l'extension ; TypeScript ne la permet que via allowImportingTsExtensions, absent du tsconfig de l'appli.
// @ts-ignore TS5097
import { htmlText, summarizeReleaseNotes } from './updateNotes.ts'

// Ce que GitHub rend pour docs/release-notes/0.8.0.md (extrait).
const NOTES_080 = `<h2>Nouveautés</h2>
<ul>
<li><strong>Counter-Strike 2 en direct</strong> : pendant un match, la fiche de CS2 montre la carte et le mode.</li>
<li><strong>Bilan de fin de match CS2</strong> : à la fin du match, une carte résume ta partie.</li>
<li><strong>Canal Bêta</strong> : dans <strong>Paramètres › À propos</strong>, choisis <strong>Stable</strong> ou <strong>Bêta</strong>.</li>
</ul>
<h2>Bon à savoir</h2>
<ul>
<li>Les chiffres viennent de CS2 lui-même.</li>
</ul>`

test('résumé : les noms en gras de la première liste, dans l’ordre', () => {
  assert.equal(summarizeReleaseNotes(NOTES_080), 'Counter-Strike 2 en direct · Bilan de fin de match CS2 · Canal Bêta')
})

test('résumé : nom suivi d’un point dans le gras, paragraphe avant la liste, élément sans gras', () => {
  const html = `<h2>Version de test</h2><p>Tu la reçois parce que…</p><h2>Changements</h2><ul>
<li><p><strong>Overlay CS2 : un simple interrupteur.</strong> Dans <strong>Paramètres</strong>…</p></li>
<li>Anneau de focus visible sur les boutons. Au clavier seulement.</li></ul>`
  assert.equal(summarizeReleaseNotes(html), 'Overlay CS2 : un simple interrupteur · Anneau de focus visible sur les boutons')
})

test('résumé : notes en liste (fullChangelog), entités décodées, au plus 4 éléments', () => {
  const li = (s: string): string => `<li><strong>${s}</strong> : x</li>`
  const notes = [
    { version: '0.9.1', note: `<ul>${li('A &amp; B')}${li('L&#39;overlay')}${li('C')}${li('D')}${li('E')}</ul>` },
    { version: '0.9.0', note: `<ul>${li('Ancienne')}</ul>` }
  ]
  assert.equal(summarizeReleaseNotes(notes, '0.9.1'), "A & B · L'overlay · C · D")
  assert.equal(summarizeReleaseNotes(notes, '0.9.0'), 'Ancienne')
})

test('résumé : rien sans notes ni liste', () => {
  assert.equal(summarizeReleaseNotes(null), undefined)
  assert.equal(summarizeReleaseNotes(''), undefined)
  assert.equal(summarizeReleaseNotes('<p>No content.</p>'), undefined)
  assert.equal(summarizeReleaseNotes([]), undefined)
})

test('texte brut : aucune balise ne passe', () => {
  assert.equal(htmlText('<img src=x onerror="alert(1)">Salut <b>toi</b> &lt;3'), 'Salut toi <3')
})
